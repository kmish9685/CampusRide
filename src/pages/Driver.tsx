import React, { useState, useEffect, useRef } from "react";
import {
  supabase,
  isSupabaseConfigured,
  upsertBus,
  type CrowdLevel,
  type BusRow,
  type BusStatus,
  type CrowdSource,
  type StopWait,
  fetchActiveWaits,
  computeAutoCrowd,
  clearWaitsForStop,
  demoChannel,
} from "../lib/supabase";
import { BUS_ID, STOPS } from "../data/route";
import { lerpOnRoute } from "../lib/routeUtils";

export default function Driver() {
  const [isTripActive, setIsTripActive] = useState<boolean>(false);
  const [isSimulateMode, setIsSimulateMode] = useState<boolean>(true); // default to simulate mode for smooth hackathon demo
  const [crowdLevel, setCrowdLevel] = useState<CrowdLevel>("seats");
  const [crowdSource, setCrowdSource] = useState<CrowdSource>("auto");
  const [occupancy, setOccupancy] = useState<number>(18);
  const [busStatus, setBusStatus] = useState<BusStatus>("on_time");
  const [saveFeedback, setSaveFeedback] = useState<string | null>(null);
  const [isConnected, setIsConnected] = useState<boolean>(false);
  const [activeWaits, setActiveWaits] = useState<StopWait[]>([]);
  const [lastSentTime, setLastSentTime] = useState<Date | null>(null);
  const [updatesSent, setUpdatesSent] = useState<number>(0);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Network loss simulation & offline queue
  const [isSimulatingNetworkLoss, setIsSimulatingNetworkLoss] = useState<boolean>(false);
  const [networkLossSecondsLeft, setNetworkLossSecondsLeft] = useState<number>(0);
  const [offlineQueue, setOfflineQueue] = useState<any[]>(() => {
    try {
      const q = localStorage.getItem("campusride_driver_queue");
      return q ? JSON.parse(q) : [];
    } catch {
      return [];
    }
  });

  // First-time visitor hint
  const [showHint, setShowHint] = useState<boolean>(() => {
    return !localStorage.getItem("campusride_driver_hint_dismissed");
  });

  const watchIdRef = useRef<number | null>(null);
  const simIntervalRef = useRef<number | null>(null);
  const simProgressRef = useRef<number>(0);
  const lastPassedStopIdxRef = useRef<number>(-1);
  const offlineQueueRef = useRef(offlineQueue);
  offlineQueueRef.current = offlineQueue;
  // Speed multiplier for demo mode (controlled by Admin Demo Controls)
  const demoSpeedRef = useRef<number>(
    localStorage.getItem("campusride_demo_speed_x3") === "1" ? 3 : 1
  );

  // Persist offline queue
  useEffect(() => {
    try {
      localStorage.setItem("campusride_driver_queue", JSON.stringify(offlineQueue));
    } catch (e) {
      console.warn("localStorage error:", e);
    }
  }, [offlineQueue]);

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

  // Flush offline queue when network is available
  const flushQueue = async () => {
    if (offlineQueueRef.current.length === 0 || isSimulatingNetworkLoss || !isSupabaseConfigured) return;
    const items = [...offlineQueueRef.current];
    setOfflineQueue([]);
    for (const item of items) {
      try {
        await upsertBus(item);
      } catch (err) {
        console.warn("Queue replay error:", err);
      }
    }
    setSaveFeedback("Synced queued updates");
    setTimeout(() => setSaveFeedback(null), 2500);
  };

  // Demo broadcast event listener (from Admin Demo Controls)
  useEffect(() => {
    const handleDemoEvent = (event: string, payload: Record<string, unknown>) => {
      if (event === "demo_reset") {
        // Reset simulate trip progress back to start
        simProgressRef.current = 0;
        lastPassedStopIdxRef.current = -1;
        setOccupancy(0);
        setCrowdLevel("seats");
        setCrowdSource("auto");
        setBusStatus("on_time");
      } else if (event === "demo_speed") {
        demoSpeedRef.current = (payload.x3 as boolean) ? 3 : 1;
      }
    };

    if (demoChannel) {
      demoChannel.on("broadcast", { event: "demo_reset" }, ({ payload }) => handleDemoEvent("demo_reset", payload || {}));
      demoChannel.on("broadcast", { event: "demo_speed" }, ({ payload }) => handleDemoEvent("demo_speed", payload || {}));
    }

    const onStorage = (e: StorageEvent) => {
      if (e.key !== "campusride_demo_event" || !e.newValue) return;
      try {
        const { event, payload } = JSON.parse(e.newValue);
        handleDemoEvent(event, payload || {});
      } catch {}
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);


  // Realtime subscription & initial fetch
  useEffect(() => {
    if (!isSupabaseConfigured || !supabase) {
      setIsConnected(false);
      return;
    }

    const channel = supabase
      .channel("driver-status-channel")
      .subscribe((status) => {
        console.log("[CampusRide Driver Realtime Status]:", status);
        setIsConnected(status === "SUBSCRIBED");
        if (status === "SUBSCRIBED") {
          flushQueue();
        }
      });

    const waitsChannel = supabase
      .channel("driver-waits-channel")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "stop_waits" },
        () => {
          reloadWaits();
        }
      )
      .subscribe();

    supabase
      .from("buses")
      .select("*")
      .eq("id", BUS_ID)
      .maybeSingle()
      .then(({ data }) => {
        if (data) {
          const row = data as BusRow;
          setCrowdLevel(row.crowd_level || "seats");
          if (row.occupancy !== undefined) setOccupancy(row.occupancy);
          if (row.status) setBusStatus(row.status);
          if (row.crowd_source) setCrowdSource(row.crowd_source);
        }
      });

    reloadWaits();

    return () => {
      supabase?.removeChannel(channel);
      supabase?.removeChannel(waitsChannel);
    };
  }, []);

  // Timer for network loss simulation (30s)
  useEffect(() => {
    if (!isSimulatingNetworkLoss) return;
    setNetworkLossSecondsLeft(30);

    const interval = setInterval(() => {
      setNetworkLossSecondsLeft((prev) => {
        if (prev <= 1) {
          clearInterval(interval);
          setIsSimulatingNetworkLoss(false);
          flushQueue();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [isSimulatingNetworkLoss]);

  // Update Bus Operational Status (On Time / Delayed / Breakdown)
  const handleSetStatus = async (status: BusStatus) => {
    setBusStatus(status);
    setSaveFeedback("Status updating...");

    const payload = { id: BUS_ID, status };

    if (isSimulatingNetworkLoss || !isSupabaseConfigured) {
      setOfflineQueue((prev) => [...prev, payload]);
      setSaveFeedback("Queued offline");
      setTimeout(() => setSaveFeedback(null), 2000);
      return;
    }

    try {
      const { error } = await upsertBus(payload);
      if (!error) {
        setSaveFeedback("Saved!");
        setTimeout(() => setSaveFeedback(null), 2000);
      }
    } catch {
      setOfflineQueue((prev) => [...prev, payload]);
      setSaveFeedback("Queued offline");
      setTimeout(() => setSaveFeedback(null), 2000);
    }
  };

  // Manual Override Crowd Level
  const handleSetCrowdManual = async (level: CrowdLevel) => {
    setCrowdLevel(level);
    setCrowdSource("manual");
    setSaveFeedback("Manual override saving...");

    const payload = {
      id: BUS_ID,
      crowd_level: level,
      crowd_source: "manual" as CrowdSource,
    };

    if (isSimulatingNetworkLoss || !isSupabaseConfigured) {
      setOfflineQueue((prev) => [...prev, payload]);
      setSaveFeedback("Queued offline");
      setTimeout(() => setSaveFeedback(null), 2000);
      return;
    }

    try {
      const { error } = await upsertBus(payload);
      if (!error) {
        setSaveFeedback("Saved!");
        setTimeout(() => setSaveFeedback(null), 2000);
      }
    } catch {
      setOfflineQueue((prev) => [...prev, payload]);
      setSaveFeedback("Queued offline");
      setTimeout(() => setSaveFeedback(null), 2000);
    }
  };

  // Push Location & Occupancy
  const broadcastUpdate = async (lat: number, lng: number, occ: number, crowd: CrowdLevel) => {
    const payload = {
      id: BUS_ID,
      lat,
      lng,
      occupancy: occ,
      crowd_level: crowd,
      status: busStatus,
      crowd_source: crowdSource,
      is_active: true,
    };

    if (isSimulatingNetworkLoss || !isSupabaseConfigured) {
      setOfflineQueue((prev) => [...prev, payload]);
      setLastSentTime(new Date());
      setUpdatesSent((prev) => prev + 1);
      return;
    }

    try {
      const { error } = await upsertBus(payload);
      if (!error) {
        setLastSentTime(new Date());
        setUpdatesSent((prev) => prev + 1);
        if (offlineQueueRef.current.length > 0) {
          flushQueue();
        }
      } else {
        setOfflineQueue((prev) => [...prev, payload]);
      }
    } catch {
      setOfflineQueue((prev) => [...prev, payload]);
    }
  };

  // Start Trip
  const handleStartTrip = () => {
    setErrorMessage(null);
    setIsTripActive(true);

    if (isSimulateMode) {
      const initialPos = lerpOnRoute(simProgressRef.current);
      broadcastUpdate(initialPos.lat, initialPos.lng, occupancy, crowdLevel);

      if (simIntervalRef.current) clearInterval(simIntervalRef.current);

      simIntervalRef.current = window.setInterval(() => {
        const speedMult = demoSpeedRef.current;
        // Advance by speedMult × base step (3s per tick at normal speed)
        const newProgress = (simProgressRef.current + (speedMult * 3) / 120) % 1;
        simProgressRef.current = newProgress;
        const nextPos = lerpOnRoute(newProgress);

        // Check if passing any of the 5 stops
        // 5 stops roughly at progress [0, 0.22, 0.48, 0.74, 0.98]
        const stopProgresses = [0, 0.22, 0.48, 0.74, 0.98];
        let currentOcc = occupancy;
        let currentCrowd = crowdLevel;

        for (let i = 0; i < stopProgresses.length; i++) {
          const sp = stopProgresses[i];
          if (
            Math.abs(newProgress - sp) < 0.03 &&
            lastPassedStopIdxRef.current !== i
          ) {
            lastPassedStopIdxRef.current = i;
            const stop = STOPS[i];

            if (i === 4) {
              // Last stop: College Main Gate -> occupancy resets to 0
              currentOcc = 0;
            } else {
              // Add waiting students to occupancy
              const waitingCount = activeWaits.filter((w) => w.stop_name === stop.name).length;
              currentOcc = Math.min(50, currentOcc + waitingCount);
              clearWaitsForStop(stop.name, BUS_ID);
              reloadWaits();
            }

            setOccupancy(currentOcc);

            // Recompute auto crowd if driver hasn't locked manual override
            if (crowdSource === "auto") {
              currentCrowd = computeAutoCrowd(currentOcc, 50);
              setCrowdLevel(currentCrowd);
            }
            break;
          }
        }

        broadcastUpdate(nextPos.lat, nextPos.lng, currentOcc, currentCrowd);
      }, 3000);
      return;
    }

    // Real GPS Mode
    if (!navigator.geolocation) {
      setErrorMessage("GPS not supported. Use Simulate Trip instead.");
      setIsTripActive(false);
      return;
    }

    watchIdRef.current = navigator.geolocation.watchPosition(
      (pos) => {
        broadcastUpdate(pos.coords.latitude, pos.coords.longitude, occupancy, crowdLevel);
      },
      () => {
        setErrorMessage("GPS signal weak. Switch to Simulate Trip for demo.");
      },
      { enableHighAccuracy: true, timeout: 10000 }
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
    upsertBus({ id: BUS_ID, is_active: false });
  };

  // Clean up
  useEffect(() => {
    return () => {
      if (watchIdRef.current !== null) navigator.geolocation.clearWatch(watchIdRef.current);
      if (simIntervalRef.current !== null) clearInterval(simIntervalRef.current);
    };
  }, []);

  const totalWaiting = activeWaits.length;

  return (
    <div className="flex-1 flex flex-col items-center p-4 sm:p-6 max-w-lg mx-auto w-full space-y-4">
      {/* Dismissable First-Time Hint */}
      {showHint && (
        <div className="w-full bg-indigo-950/80 border border-indigo-800/80 rounded-2xl p-3 text-xs text-indigo-200 flex items-center justify-between shadow-sm">
          <span>Tap <strong>Start Trip</strong> or <strong>Simulate Trip</strong> to broadcast your location.</span>
          <button
            type="button"
            onClick={() => {
              setShowHint(false);
              localStorage.setItem("campusride_driver_hint_dismissed", "1");
            }}
            className="text-indigo-400 hover:text-white ml-2 font-bold px-1.5 py-0.5 rounded"
          >
            ✕
          </button>
        </div>
      )}

      {/* Connection & Offline Queue Status Bar */}
      <div className="w-full flex items-center justify-between bg-gray-900/90 border border-gray-800 rounded-2xl px-4 py-2.5 shadow-sm text-xs">
        <div className="flex items-center gap-2">
          <span
            className={`w-2.5 h-2.5 rounded-full ${
              isSimulatingNetworkLoss
                ? "bg-amber-400 animate-pulse"
                : isConnected
                ? "bg-emerald-400 animate-pulse"
                : "bg-gray-500"
            }`}
          />
          <span className="font-semibold text-gray-300">
            {isSimulatingNetworkLoss
              ? `Simulating Network Loss (${networkLossSecondsLeft}s left)`
              : isConnected
              ? "Connected"
              : "Offline"}
          </span>
        </div>

        {offlineQueue.length > 0 ? (
          <span className="text-amber-400 font-bold bg-amber-950/80 border border-amber-800/60 px-2 py-0.5 rounded-full text-[11px]">
            {offlineQueue.length} queued
          </span>
        ) : (
          <span className="text-emerald-400 font-medium text-[11px]">Synced</span>
        )}
      </div>

      {/* Network Loss Simulation Button for Jury Demo */}
      <div className="w-full bg-gray-900/90 border border-gray-800 rounded-2xl p-3 flex items-center justify-between shadow-sm">
        <div>
          <span className="text-xs font-semibold text-white block">Network Drop Simulation</span>
          <span className="text-[11px] text-gray-400">Pause sending for 30s to demonstrate offline queueing</span>
        </div>
        <button
          type="button"
          onClick={() => {
            if (isSimulatingNetworkLoss) {
              setIsSimulatingNetworkLoss(false);
              flushQueue();
            } else {
              setIsSimulatingNetworkLoss(true);
            }
          }}
          className={`px-3 py-1.5 rounded-xl font-bold text-xs transition-all ${
            isSimulatingNetworkLoss
              ? "bg-amber-600 text-white shadow-lg shadow-amber-950/50"
              : "bg-gray-800 text-gray-300 hover:bg-gray-700"
          }`}
        >
          {isSimulatingNetworkLoss ? "Reconnect Now" : "Simulate Network Loss"}
        </button>
      </div>

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
          Simulate Trip (Demo Mode)
        </button>
      </div>

      {/* Vehicle Status & Active Duty Header */}
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

      {/* Trip Control: Start / End Trip (Big Buttons) */}
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
            {isSimulateMode ? "Broadcast Road Path" : "Broadcast GPS"}
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

      {/* Bus Status Buttons: On Time / Delayed / Breakdown */}
      <div className="w-full bg-gray-900/90 border border-gray-800 rounded-2xl p-4 sm:p-5 shadow-lg space-y-2.5">
        <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider block">
          Bus Status
        </span>
        <div className="grid grid-cols-3 gap-2">
          <button
            type="button"
            onClick={() => handleSetStatus("on_time")}
            className={`h-11 rounded-xl font-bold text-xs sm:text-sm border transition-all ${
              busStatus === "on_time"
                ? "bg-emerald-600 text-white border-emerald-400 ring-2 ring-emerald-400/40"
                : "bg-gray-800 text-gray-300 border-gray-700 hover:bg-gray-750"
            }`}
          >
            On time
          </button>
          <button
            type="button"
            onClick={() => handleSetStatus("delayed")}
            className={`h-11 rounded-xl font-bold text-xs sm:text-sm border transition-all ${
              busStatus === "delayed"
                ? "bg-amber-600 text-white border-amber-400 ring-2 ring-amber-400/40"
                : "bg-gray-800 text-gray-300 border-gray-700 hover:bg-gray-750"
            }`}
          >
            Delayed
          </button>
          <button
            type="button"
            onClick={() => handleSetStatus("breakdown")}
            className={`h-11 rounded-xl font-bold text-xs sm:text-sm border transition-all ${
              busStatus === "breakdown"
                ? "bg-rose-600 text-white border-rose-400 ring-2 ring-rose-400/40"
                : "bg-gray-800 text-gray-300 border-gray-700 hover:bg-gray-750"
            }`}
          >
            Breakdown
          </button>
        </div>
      </div>

      {/* Crowd Level & Occupancy Card */}
      <div className="w-full bg-gray-900/90 border border-gray-800 rounded-2xl p-4 sm:p-5 shadow-lg space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider block">
              Crowd Status ({crowdSource === "auto" ? "Auto" : "Set by driver"})
            </span>
            <p className="text-sm font-bold text-white mt-0.5">
              Estimated {occupancy}/50 on board
            </p>
          </div>
          {saveFeedback && (
            <span className="text-xs font-semibold text-emerald-400 bg-emerald-950/80 px-2 py-0.5 rounded-full border border-emerald-800/60">
              {saveFeedback}
            </span>
          )}
        </div>

        <div className="space-y-1.5">
          <span className="text-[11px] text-gray-400 font-medium block">
            Override crowd level:
          </span>
          <div className="grid grid-cols-3 gap-2">
            <button
              type="button"
              onClick={() => handleSetCrowdManual("seats")}
              className={`min-h-[50px] p-2 rounded-xl flex flex-col items-center justify-center font-bold text-xs transition-all border ${
                crowdLevel === "seats"
                  ? "bg-emerald-600 text-white border-emerald-400 shadow-md ring-2 ring-emerald-400/40"
                  : "bg-gray-800 text-emerald-300/80 border-gray-700 hover:bg-gray-750"
              }`}
            >
              <span>Seats</span>
              <span className="text-[10px] font-normal opacity-90">Available</span>
            </button>

            <button
              type="button"
              onClick={() => handleSetCrowdManual("standing")}
              className={`min-h-[50px] p-2 rounded-xl flex flex-col items-center justify-center font-bold text-xs transition-all border ${
                crowdLevel === "standing"
                  ? "bg-amber-600 text-white border-amber-400 shadow-md ring-2 ring-amber-400/40"
                  : "bg-gray-800 text-amber-300/80 border-gray-700 hover:bg-gray-750"
              }`}
            >
              <span>Standing</span>
              <span className="text-[10px] font-normal opacity-90">Only</span>
            </button>

            <button
              type="button"
              onClick={() => handleSetCrowdManual("full")}
              className={`min-h-[50px] p-2 rounded-xl flex flex-col items-center justify-center font-bold text-xs transition-all border ${
                crowdLevel === "full"
                  ? "bg-rose-600 text-white border-rose-400 shadow-md ring-2 ring-rose-400/40"
                  : "bg-gray-800 text-rose-300/80 border-gray-700 hover:bg-gray-750"
              }`}
            >
              <span>Full</span>
              <span className="text-[10px] font-normal opacity-90">Bus full</span>
            </button>
          </div>
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

      {/* Broadcast Telemetry (Clean words: Location updates & Last update) */}
      <div className="w-full bg-gray-900/90 border border-gray-800 rounded-2xl p-4 sm:p-5 shadow-lg space-y-3">
        <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider">
          Location Updates
        </span>

        <div className="grid grid-cols-2 gap-3 text-xs">
          <div className="bg-gray-950/60 border border-gray-800 rounded-xl p-3">
            <span className="text-gray-400 text-[11px] block">Last update</span>
            <p className="font-mono font-bold text-gray-200 mt-1">
              {lastSentTime ? lastSentTime.toLocaleTimeString() : "Awaiting start"}
            </p>
          </div>

          <div className="bg-gray-950/60 border border-gray-800 rounded-xl p-3">
            <span className="text-gray-400 text-[11px] block">Updates sent</span>
            <p className="font-mono font-bold text-indigo-400 mt-1">
              {updatesSent} {updatesSent === 1 ? "update" : "updates"}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
