import React, { useState, useEffect, useRef } from "react";
import {
  supabase,
  isSupabaseConfigured,
  upsertBus,
  type CrowdLevel,
  type BusRow,
  type StopWait,
  fetchActiveWaits,
} from "../lib/supabase";
import { BUS_ID, ROUTE_POLYLINE, STOPS } from "../data/route";
import { lerpOnRoute } from "../lib/routeUtils";

export default function Driver() {
  const [isTripActive, setIsTripActive] = useState<boolean>(false);
  const [isSimulateMode, setIsSimulateMode] = useState<boolean>(false);
  const [crowdLevel, setCrowdLevel] = useState<CrowdLevel>("seats");
  const [saveFeedback, setSaveFeedback] = useState<string | null>(null);
  const [isConnected, setIsConnected] = useState<boolean>(false);
  const [activeWaits, setActiveWaits] = useState<StopWait[]>([]);
  const [gpsLocation, setGpsLocation] = useState<{
    lat: number;
    lng: number;
    accuracy?: number;
  } | null>(null);
  const [lastSentTime, setLastSentTime] = useState<Date | null>(null);
  const [pingsSent, setPingsSent] = useState<number>(0);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // References for tracking GPS & Simulation intervals
  const watchIdRef = useRef<number | null>(null);
  const simIntervalRef = useRef<number | null>(null);
  const simProgressRef = useRef<number>(0);

  // Fetch active student waits
  const reloadWaits = async () => {
    try {
      const { data } = await fetchActiveWaits(BUS_ID);
      if (data) {
        setActiveWaits(data as StopWait[]);
      }
    } catch (err) {
      console.warn("Error fetching driver active waits:", err);
    }
  };

  // Supabase Realtime channel status & initial fetch
  useEffect(() => {
    if (!isSupabaseConfigured || !supabase) {
      setIsConnected(false);
      return;
    }

    const channel = supabase
      .channel("driver-status-channel")
      .subscribe((status) => {
        console.log("[CampusRide Driver Realtime Channel Status]:", status);
        setIsConnected(status === "SUBSCRIBED");
      });

    // Realtime channel for live student waits
    const waitsChannel = supabase
      .channel("driver-waits-channel")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "stop_waits",
        },
        () => {
          reloadWaits();
        }
      )
      .subscribe();

    // Fetch initial state
    supabase
      .from("buses")
      .select("*")
      .eq("id", BUS_ID)
      .maybeSingle()
      .then(({ data }) => {
        if (data) {
          const row = data as BusRow;
          setCrowdLevel(row.crowd_level || "seats");
          if (row.lat && row.lng) {
            setGpsLocation({ lat: row.lat, lng: row.lng });
          }
        }
      });

    reloadWaits();

    return () => {
      supabase?.removeChannel(channel);
      supabase?.removeChannel(waitsChannel);
    };
  }, []);

  // Update Crowd Level Immediately via upsertBus
  const handleSetCrowd = async (level: CrowdLevel) => {
    setCrowdLevel(level);
    setSaveFeedback("Saving...");

    try {
      const { error } = await upsertBus({
        id: BUS_ID,
        crowd_level: level,
      });

      if (!error) {
        setSaveFeedback("Saved!");
        setTimeout(() => setSaveFeedback(null), 2000);
      } else {
        console.error("Failed to update crowd level:", error);
        setSaveFeedback("Save failed!");
        setTimeout(() => setSaveFeedback(null), 3000);
      }
    } catch (err) {
      console.error("Supabase crowd update error:", err);
      setSaveFeedback("Save error!");
      setTimeout(() => setSaveFeedback(null), 3000);
    }
  };

  // Helper to push location
  const pushLocation = async (lat: number, lng: number, accuracy?: number) => {
    setGpsLocation({ lat, lng, accuracy });
    try {
      const { error } = await upsertBus({
        id: BUS_ID,
        lat,
        lng,
        is_active: true,
      });

      if (!error) {
        setLastSentTime(new Date());
        setPingsSent((prev) => prev + 1);
      } else {
        console.warn("Location push error:", error.message);
      }
    } catch (err) {
      console.error("Failed to broadcast location:", err);
    }
  };

  // Start Trip
  const handleStartTrip = () => {
    setErrorMessage(null);
    setIsTripActive(true);

    // If Simulate Trip Mode is active
    if (isSimulateMode) {
      const initialPos = lerpOnRoute(simProgressRef.current);
      pushLocation(initialPos.lat, initialPos.lng, 5);

      if (simIntervalRef.current) clearInterval(simIntervalRef.current);
      simIntervalRef.current = window.setInterval(() => {
        simProgressRef.current = (simProgressRef.current + 3 / 120) % 1;
        const nextPos = lerpOnRoute(simProgressRef.current);
        pushLocation(nextPos.lat, nextPos.lng, 5);
      }, 3000);
      return;
    }

    // Real GPS Mode
    const isSecure = window.isSecureContext;
    if (!isSecure && window.location.hostname !== "localhost" && window.location.hostname !== "127.0.0.1") {
      setErrorMessage("Real GPS needs HTTPS. Use Simulate Trip, or open the deployed Vercel link.");
      setIsTripActive(false);
      return;
    }

    if (!navigator.geolocation) {
      setErrorMessage("Geolocation is not supported by your browser. Use Simulate Trip instead.");
      setIsTripActive(false);
      return;
    }

    watchIdRef.current = navigator.geolocation.watchPosition(
      (pos) => {
        pushLocation(pos.coords.latitude, pos.coords.longitude, pos.coords.accuracy);
        setErrorMessage(null);
      },
      (err) => {
        if (err.code === err.PERMISSION_DENIED) {
          setErrorMessage("GPS permission was denied. Use Simulate Trip to demo without GPS.");
        } else {
          setErrorMessage("GPS signal weak or unavailable. Switch to Simulate Trip.");
        }
      },
      { enableHighAccuracy: true, maximumAge: 3000, timeout: 10000 }
    );
  };

  // End Trip
  const handleEndTrip = () => {
    setIsTripActive(false);

    if (watchIdRef.current !== null) {
      navigator.geolocation.clearWatch(watchIdRef.current);
      watchIdRef.current = null;
    }

    if (simIntervalRef.current !== null) {
      clearInterval(simIntervalRef.current);
      simIntervalRef.current = null;
    }

    upsertBus({
      id: BUS_ID,
      is_active: false,
    });
  };

  // Clean up watchers on unmount
  useEffect(() => {
    return () => {
      if (watchIdRef.current !== null) navigator.geolocation.clearWatch(watchIdRef.current);
      if (simIntervalRef.current !== null) clearInterval(simIntervalRef.current);
    };
  }, []);

  const totalWaiting = activeWaits.length;

  return (
    <div className="flex-1 flex flex-col items-center p-4 sm:p-6 max-w-lg mx-auto w-full space-y-4">
      {/* Realtime Connection Status & DB notice */}
      <div className="w-full flex items-center justify-between bg-gray-900/90 border border-gray-800 rounded-2xl px-4 py-2.5 shadow-sm text-xs">
        <div className="flex items-center gap-2">
          <span
            className={`w-2.5 h-2.5 rounded-full ${
              isConnected ? "bg-emerald-400 animate-pulse" : "bg-gray-500"
            }`}
          />
          <span className="font-semibold text-gray-300">
            {isConnected ? "Connected (Realtime)" : "Offline / Connecting"}
          </span>
        </div>
        <span className="text-gray-400 font-mono text-[11px]">{BUS_ID}</span>
      </div>

      {!isSupabaseConfigured && (
        <div className="w-full bg-amber-950/80 border border-amber-800/80 rounded-2xl p-3.5 text-xs text-amber-300 flex items-start gap-2.5">
          <svg className="w-4 h-4 shrink-0 text-amber-400 mt-0.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
          <div>
            <p className="font-semibold text-amber-200">Database not configured</p>
            <p className="text-amber-400/90 mt-0.5">
              Add Supabase keys in <code className="bg-amber-900/60 px-1 py-0.5 rounded text-[11px]">.env</code> to sync live data across devices.
            </p>
          </div>
        </div>
      )}

      {/* GPS Error / Warning Banner */}
      {errorMessage && (
        <div className="w-full bg-rose-950/80 border border-rose-800/80 rounded-2xl p-3.5 text-xs text-rose-300 flex items-start gap-2.5">
          <svg className="w-4 h-4 shrink-0 text-rose-400 mt-0.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="12" cy="12" r="10" />
            <line x1="12" y1="8" x2="12" y2="12" />
            <line x1="12" y1="16" x2="12.01" y2="16" />
          </svg>
          <div>
            <p className="font-semibold text-rose-200">Notice</p>
            <p className="text-rose-300 mt-0.5 leading-relaxed">{errorMessage}</p>
          </div>
        </div>
      )}

      {/* Trip Mode Switch: Real GPS vs Simulate Trip */}
      <div className="w-full bg-gray-900/90 border border-gray-800 rounded-2xl p-2 flex items-center gap-1.5 shadow-md">
        <button
          type="button"
          disabled={isTripActive}
          onClick={() => {
            setIsSimulateMode(false);
            setErrorMessage(null);
          }}
          className={`flex-1 h-10 rounded-xl text-xs font-semibold transition-all ${
            !isSimulateMode
              ? "bg-indigo-600 text-white shadow-sm"
              : "text-gray-400 hover:text-gray-200"
          } ${isTripActive ? "opacity-60 cursor-not-allowed" : ""}`}
        >
          Real GPS
        </button>

        <button
          type="button"
          disabled={isTripActive}
          onClick={() => {
            setIsSimulateMode(true);
            setErrorMessage(null);
          }}
          className={`flex-1 h-10 rounded-xl text-xs font-semibold transition-all ${
            isSimulateMode
              ? "bg-indigo-600 text-white shadow-sm"
              : "text-gray-400 hover:text-gray-200"
          } ${isTripActive ? "opacity-60 cursor-not-allowed" : ""}`}
        >
          Simulate Trip (No GPS needed)
        </button>
      </div>

      {/* Trip Status Header Card */}
      <div className="w-full bg-gray-900/90 border border-gray-800 rounded-2xl p-4 sm:p-5 shadow-lg flex items-center justify-between">
        <div>
          <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider">
            Vehicle & Mode
          </span>
          <h1 className="text-xl font-bold text-white tracking-tight mt-0.5">
            {BUS_ID} · {isSimulateMode ? "Simulation" : "Live GPS"}
          </h1>
        </div>
        <div className="text-right">
          <span
            className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold ${
              isTripActive
                ? "bg-emerald-950/80 text-emerald-400 border border-emerald-700/60"
                : "bg-gray-800 text-gray-400 border border-gray-700"
            }`}
          >
            <span
              className={`w-2 h-2 rounded-full ${
                isTripActive ? "bg-emerald-400 animate-pulse" : "bg-gray-500"
              }`}
            />
            {isTripActive ? "ON TRIP" : "OFF DUTY"}
          </span>
        </div>
      </div>

      {/* Trip Control: Start / End Trip (Big Buttons for Driver in Phone Mount) */}
      <div className="w-full grid grid-cols-2 gap-3">
        <button
          type="button"
          onClick={handleStartTrip}
          disabled={isTripActive}
          className={`h-16 rounded-2xl font-bold text-base sm:text-lg flex flex-col items-center justify-center transition-all shadow-lg ${
            isTripActive
              ? "bg-gray-900 text-gray-600 border border-gray-800 cursor-not-allowed"
              : "bg-indigo-600 hover:bg-indigo-500 text-white shadow-indigo-900/50 active:scale-[0.98]"
          }`}
        >
          <span>Start Trip</span>
          <span className="text-[11px] font-normal opacity-80">
            {isSimulateMode ? "Broadcast Simulated Path" : "Broadcast Real GPS"}
          </span>
        </button>

        <button
          type="button"
          onClick={handleEndTrip}
          disabled={!isTripActive}
          className={`h-16 rounded-2xl font-bold text-base sm:text-lg flex flex-col items-center justify-center transition-all shadow-lg ${
            !isTripActive
              ? "bg-gray-900 text-gray-600 border border-gray-800 cursor-not-allowed"
              : "bg-rose-700 hover:bg-rose-600 text-white shadow-rose-900/50 active:scale-[0.98]"
          }`}
        >
          <span>End Trip</span>
          <span className="text-[11px] font-normal opacity-80">Stop Broadcasting</span>
        </button>
      </div>

      {/* Crowd Level Selector (Three Large Buttons, Immediate Upsert) */}
      <div className="w-full bg-gray-900/90 border border-gray-800 rounded-2xl p-4 sm:p-5 shadow-lg space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider">
            Current Bus Crowd Level
          </span>
          {saveFeedback && (
            <span
              className={`text-xs font-semibold ${
                saveFeedback === "Saved!" ? "text-emerald-400" : "text-indigo-400"
              }`}
            >
              {saveFeedback}
            </span>
          )}
        </div>

        <div className="grid grid-cols-3 gap-2.5">
          {/* Seats Available (Green) */}
          <button
            type="button"
            onClick={() => handleSetCrowd("seats")}
            className={`min-h-[58px] p-2 rounded-xl flex flex-col items-center justify-center text-center font-bold text-xs sm:text-sm transition-all border ${
              crowdLevel === "seats"
                ? "bg-emerald-600 text-white border-emerald-400 shadow-lg shadow-emerald-950/60 ring-2 ring-emerald-400/40"
                : "bg-gray-800/80 text-emerald-300/80 border-gray-700/60 hover:bg-gray-800"
            }`}
          >
            <span>Seats</span>
            <span className="text-[10px] font-normal opacity-90">Available</span>
          </button>

          {/* Standing Only (Yellow) */}
          <button
            type="button"
            onClick={() => handleSetCrowd("standing")}
            className={`min-h-[58px] p-2 rounded-xl flex flex-col items-center justify-center text-center font-bold text-xs sm:text-sm transition-all border ${
              crowdLevel === "standing"
                ? "bg-amber-600 text-white border-amber-400 shadow-lg shadow-amber-950/60 ring-2 ring-amber-400/40"
                : "bg-gray-800/80 text-amber-300/80 border-gray-700/60 hover:bg-gray-800"
            }`}
          >
            <span>Standing</span>
            <span className="text-[10px] font-normal opacity-90">Only</span>
          </button>

          {/* Full (Red) */}
          <button
            type="button"
            onClick={() => handleSetCrowd("full")}
            className={`min-h-[58px] p-2 rounded-xl flex flex-col items-center justify-center text-center font-bold text-xs sm:text-sm transition-all border ${
              crowdLevel === "full"
                ? "bg-rose-600 text-white border-rose-400 shadow-lg shadow-rose-950/60 ring-2 ring-rose-400/40"
                : "bg-gray-800/80 text-rose-300/80 border-gray-700/60 hover:bg-gray-800"
            }`}
          >
            <span>Bus Full</span>
            <span className="text-[10px] font-normal opacity-90">No Entry</span>
          </button>
        </div>
      </div>

      {/* Live Demand Card: Students Waiting Along Route */}
      <div className="w-full bg-gray-900/90 border border-gray-800 rounded-2xl p-4 sm:p-5 shadow-lg space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <svg className="w-4 h-4 text-indigo-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" />
              <circle cx="9" cy="7" r="4" />
              <path d="M23 21v-2a4 4 0 00-3-3.87" />
              <path d="M16 3.13a4 4 0 010 7.75" />
            </svg>
            <span className="text-xs font-semibold text-gray-300 uppercase tracking-wider">
              Students Waiting
            </span>
          </div>
          <span className="text-xs font-bold text-indigo-400 bg-indigo-950/80 border border-indigo-800/60 px-2 py-0.5 rounded-full">
            {totalWaiting} total
          </span>
        </div>

        <div className="divide-y divide-gray-800/80 text-xs">
          {STOPS.map((stop, idx) => {
            const count = activeWaits.filter((w) => w.stop_name === stop.name).length;
            return (
              <div key={stop.id} className="py-2.5 flex items-center justify-between">
                <span className="text-gray-300 font-medium">
                  {idx + 1}. {stop.name}
                </span>
                <span
                  className={`px-2.5 py-0.5 rounded-full font-bold text-xs ${
                    count > 0
                      ? "bg-indigo-600 text-white shadow-sm"
                      : "text-gray-500 bg-gray-800/60"
                  }`}
                >
                  {count} waiting
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Live Telemetry / GPS Details Screen */}
      <div className="w-full bg-gray-900/90 border border-gray-800 rounded-2xl p-4 sm:p-5 shadow-lg space-y-3">
        <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider">
          Broadcast Telemetry ({isSimulateMode ? "Every 3s" : "Every 5s"})
        </span>

        <div className="grid grid-cols-2 gap-3 text-xs">
          <div className="bg-gray-950/60 border border-gray-800 rounded-xl p-3">
            <span className="text-gray-400 text-[11px] block">Latitude / Longitude</span>
            <p className="font-mono font-bold text-gray-200 mt-1 truncate">
              {gpsLocation
                ? `${gpsLocation.lat.toFixed(5)}, ${gpsLocation.lng.toFixed(5)}`
                : "Awaiting Start..."}
            </p>
          </div>

          <div className="bg-gray-950/60 border border-gray-800 rounded-xl p-3">
            <span className="text-gray-400 text-[11px] block">Accuracy</span>
            <p className="font-mono font-bold text-gray-200 mt-1">
              {gpsLocation?.accuracy
                ? `±${Math.round(gpsLocation.accuracy)} m`
                : isTripActive
                ? "Simulated"
                : "Idle"}
            </p>
          </div>

          <div className="bg-gray-950/60 border border-gray-800 rounded-xl p-3">
            <span className="text-gray-400 text-[11px] block">Last Sent</span>
            <p className="font-mono font-bold text-gray-200 mt-1">
              {lastSentTime ? lastSentTime.toLocaleTimeString() : "None"}
            </p>
          </div>

          <div className="bg-gray-950/60 border border-gray-800 rounded-xl p-3">
            <span className="text-gray-400 text-[11px] block">Pings Broadcast</span>
            <p className="font-mono font-bold text-indigo-400 mt-1">
              {pingsSent} {pingsSent === 1 ? "ping" : "pings"}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
