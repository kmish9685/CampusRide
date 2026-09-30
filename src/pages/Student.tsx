import React, { useState, useEffect, useRef } from "react";
import { MapContainer, TileLayer, Polyline, Marker, Popup, useMap, ZoomControl } from "react-leaflet";
import L from "leaflet";
import { STOPS, ROUTE_POLYLINE, MAP_CENTER, MAP_ZOOM, BUS_ID, type RoutePoint } from "../data/route";
import { lerpOnRoute, distanceToStop, etaMinutes, haversine, getRouteSegments } from "../lib/routeUtils";
import {
  supabase,
  isSupabaseConfigured,
  type CrowdLevel,
  type BusRow,
  type BusStatus,
  type CrowdSource,
  type StopWait,
  fetchActiveWaits,
  markStopWait,
  cancelStopWait,
  computeAutoCrowd,
  demoChannel,
} from "../lib/supabase";

// Modern SVG-based DivIcons for stops
const createStopIcon = (index: number, isSelected: boolean) => {
  return L.divIcon({
    className: "custom-stop-marker",
    html: `
      <div style="
        display: flex;
        align-items: center;
        justify-content: center;
        width: ${isSelected ? "28px" : "22px"};
        height: ${isSelected ? "28px" : "22px"};
        background-color: ${isSelected ? "#4f46e5" : "#1f2937"};
        border: 2px solid ${isSelected ? "#ffffff" : "#9ca3af"};
        border-radius: 9999px;
        color: #ffffff;
        font-weight: 700;
        font-size: ${isSelected ? "13px" : "11px"};
        box-shadow: 0 4px 8px rgba(0, 0, 0, 0.5);
      ">
        ${index + 1}
      </div>
    `,
    iconSize: [28, 28],
    iconAnchor: [14, 14],
  });
};

// Modern SVG-based DivIcon for the bus with heading rotation & pulsing halo
const createBusIcon = (bearing = 0, isBus2 = false, isFaded = false) => {
  const bg = isBus2 ? "#7c3aed" : "#4f46e5";
  return L.divIcon({
    className: "custom-bus-marker",
    html: `
      <div class="bus-pulse-marker" style="
        display: flex;
        align-items: center;
        justify-content: center;
        width: 38px;
        height: 38px;
        background: ${bg};
        border: 2.5px solid #ffffff;
        border-radius: 9999px;
        box-shadow: 0 8px 16px rgba(79, 70, 229, 0.6);
        transform: rotate(${Math.round(bearing)}deg);
        transition: transform 0.35s ease-out;
        opacity: ${isFaded ? "0.6" : "1"};
      ">
        <svg style="width: 18px; height: 18px; fill: #ffffff;" viewBox="0 0 24 24">
          <path d="M12 2L4.5 20.29l.71.71L12 18l6.79 3 .71-.71z" />
        </svg>
      </div>
    `,
    iconSize: [38, 38],
    iconAnchor: [19, 19],
  });
};

// Lifecycle manager for map: initial fitBounds with bottom padding, invalidateSize on mount & resize
function MapLifecycle() {
  const map = useMap();
  const hasFitBoundsRef = useRef(false);

  useEffect(() => {
    map.invalidateSize();
    const timer = setTimeout(() => {
      map.invalidateSize();
    }, 250);

    if (!hasFitBoundsRef.current) {
      const bounds = L.latLngBounds(ROUTE_POLYLINE.map((p) => [p.lat, p.lng]));
      map.fitBounds(bounds, {
        paddingTopLeft: [30, 30],
        paddingBottomRight: [30, 260],
        animate: false,
      });
      hasFitBoundsRef.current = true;
    }

    const handleResize = () => {
      map.invalidateSize();
    };

    window.addEventListener("resize", handleResize);
    window.addEventListener("orientationchange", handleResize);

    return () => {
      clearTimeout(timer);
      window.removeEventListener("resize", handleResize);
      window.removeEventListener("orientationchange", handleResize);
    };
  }, [map]);

  return null;
}

// Recenter on bus round floating button at top right
function RecenterButton({ busPosition }: { busPosition: RoutePoint }) {
  const map = useMap();

  const handleRecenter = () => {
    map.panTo([busPosition.lat, busPosition.lng], {
      animate: true,
      duration: 0.6,
    });
  };

  return (
    <div
      className="leaflet-top leaflet-right"
      style={{ marginTop: "72px", marginRight: "10px", pointerEvents: "auto", zIndex: 999 }}
    >
      <button
        type="button"
        onClick={handleRecenter}
        className="w-10 h-10 rounded-full bg-gray-900/90 border border-gray-700 text-indigo-400 hover:text-white hover:bg-gray-800 shadow-xl flex items-center justify-center active:scale-90 transition-all backdrop-blur-md"
        title="Recenter on bus"
        aria-label="Recenter on bus"
      >
        <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <polygon points="3 11 22 2 13 21 11 13 3 11" />
        </svg>
      </button>
    </div>
  );
}

export default function Student() {
  const [isDemoMode, setIsDemoMode] = useState<boolean>(true);

  // Remember selected stop in localStorage
  const [selectedStopId, setSelectedStopId] = useState<string>(() => {
    return localStorage.getItem("campusride_selected_stop") || STOPS[4].id;
  });

  const [busPosition, setBusPosition] = useState<RoutePoint>(ROUTE_POLYLINE[0]);
  const [bus2Position, setBus2Position] = useState<RoutePoint>(ROUTE_POLYLINE[0]);
  const [crowdLevel, setCrowdLevel] = useState<CrowdLevel>("seats");
  const [crowdSource, setCrowdSource] = useState<CrowdSource>("auto");
  const [occupancy, setOccupancy] = useState<number>(24);
  const [busStatus, setBusStatus] = useState<BusStatus>("on_time");
  const [lastUpdatedAt, setLastUpdatedAt] = useState<number>(Date.now());
  const [secondsAgo, setSecondsAgo] = useState<number>(0);
  const [isConnected, setIsConnected] = useState<boolean>(false);
  const [hasReceivedLiveUpdate, setHasReceivedLiveUpdate] = useState<boolean>(false);
  const [useOsmFallback, setUseOsmFallback] = useState<boolean>(false);

  // Demand / Stop Wait State
  const [activeWaits, setActiveWaits] = useState<StopWait[]>([]);
  const [isUserWaiting, setIsUserWaiting] = useState<boolean>(false);

  // Dismissable first-time hint
  const [showHint, setShowHint] = useState<boolean>(() => {
    return !localStorage.getItem("campusride_student_hint_dismissed");
  });

  const tileErrorsRef = useRef<number>(0);
  const demoProgressRef = useRef<number>(0);
  const bus2ProgressRef = useRef<number>(0.88); // BUS-02 runs ~10-12 mins behind BUS-01
  const animationFrameRef = useRef<number | null>(null);
  const lastTickRef = useRef<number>(Date.now());
  // Speed multiplier: default 1, or 3 when demo_speed x3 is active
  const demoSpeedRef = useRef<number>(
    localStorage.getItem("campusride_demo_speed_x3") === "1" ? 3 : 1
  );
  // Network-loss simulation state (triggered from Admin Demo Controls)
  const [isDemoNetworkLoss, setIsDemoNetworkLoss] = useState<boolean>(false);
  const demoNetworkLossTimerRef = useRef<number | null>(null);

  // Save selected stop to localStorage
  const handleSelectStop = (stopId: string) => {
    setSelectedStopId(stopId);
    localStorage.setItem("campusride_selected_stop", stopId);
  };

  const handleTileError = () => {
    tileErrorsRef.current += 1;
    if (tileErrorsRef.current > 3 && !useOsmFallback) {
      setUseOsmFallback(true);
    }
  };

  // Demo broadcast event listener (from Admin Demo Controls)
  useEffect(() => {
    const handleDemoEvent = (event: string, payload: Record<string, unknown>) => {
      if (event === "demo_reset") {
        // Snap buses back to start positions
        demoProgressRef.current = 0;
        bus2ProgressRef.current = 0.62; // ~10 min behind on reset
        setBusPosition(lerpOnRoute(0));
        setBus2Position(lerpOnRoute(0.62));
        setCrowdLevel("seats");
        setOccupancy(0);
        setBusStatus("on_time");
        setActiveWaits([]);
        setIsDemoNetworkLoss(false);
      } else if (event === "demo_breakdown") {
        setBusStatus("breakdown");
      } else if (event === "demo_network_loss") {
        const duration = (payload.duration as number) || 30;
        setIsDemoNetworkLoss(true);
        setLastUpdatedAt(Date.now() - 16000); // Immediately show stale
        if (demoNetworkLossTimerRef.current) clearTimeout(demoNetworkLossTimerRef.current);
        demoNetworkLossTimerRef.current = window.setTimeout(() => {
          setIsDemoNetworkLoss(false);
          setLastUpdatedAt(Date.now());
        }, duration * 1000);
      } else if (event === "demo_speed") {
        demoSpeedRef.current = (payload.x3 as boolean) ? 3 : 1;
      }
    };

    // Supabase Realtime broadcast listener
    if (demoChannel) {
      demoChannel.on("broadcast", { event: "demo_reset" }, ({ payload }) => handleDemoEvent("demo_reset", payload || {}));
      demoChannel.on("broadcast", { event: "demo_breakdown" }, ({ payload }) => handleDemoEvent("demo_breakdown", payload || {}));
      demoChannel.on("broadcast", { event: "demo_network_loss" }, ({ payload }) => handleDemoEvent("demo_network_loss", payload || {}));
      demoChannel.on("broadcast", { event: "demo_speed" }, ({ payload }) => handleDemoEvent("demo_speed", payload || {}));
      demoChannel.on("broadcast", { event: "demo_peak_rush" }, () => { reloadWaits(); });
    }

    // localStorage cross-tab fallback
    const onStorage = (e: StorageEvent) => {
      if (e.key !== "campusride_demo_event" || !e.newValue) return;
      try {
        const { event, payload } = JSON.parse(e.newValue);
        handleDemoEvent(event, payload || {});
        if (event === "demo_peak_rush") reloadWaits();
      } catch {}
    };
    window.addEventListener("storage", onStorage);

    return () => {
      window.removeEventListener("storage", onStorage);
      if (demoNetworkLossTimerRef.current) clearTimeout(demoNetworkLossTimerRef.current);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);


  const selectedStop = STOPS.find((s) => s.id === selectedStopId) || STOPS[4];

  // Device ID for single wait per browser
  const getDeviceId = () => {
    let devId = localStorage.getItem("campusride_device_id");
    if (!devId) {
      devId = "dev_" + Math.random().toString(36).substring(2, 9) + "_" + Date.now();
      localStorage.setItem("campusride_device_id", devId);
    }
    return devId;
  };

  // Check user's active wait status in localStorage
  useEffect(() => {
    const savedStop = localStorage.getItem("campusride_wait_stop");
    const savedTime = localStorage.getItem("campusride_wait_time");
    if (savedStop && savedTime) {
      const ageMs = Date.now() - parseInt(savedTime, 10);
      if (ageMs < 20 * 60 * 1000) {
        setIsUserWaiting(savedStop === selectedStop.name);
      } else {
        localStorage.removeItem("campusride_wait_stop");
        localStorage.removeItem("campusride_wait_time");
        setIsUserWaiting(false);
      }
    } else {
      setIsUserWaiting(false);
    }
  }, [selectedStop.name]);

  // Fetch active waits from database
  const reloadWaits = async () => {
    try {
      const { data } = await fetchActiveWaits(BUS_ID);
      if (data) {
        setActiveWaits(data as StopWait[]);
      }
    } catch (err) {
      console.warn("Error fetching active waits:", err);
    }
  };

  // Toggle "I'm waiting at this stop"
  const handleToggleWait = async () => {
    const deviceId = getDeviceId();
    let waitId = localStorage.getItem("campusride_wait_id");
    if (!waitId) {
      waitId = "wait_" + Math.random().toString(36).substring(2, 9) + "_" + Date.now();
      localStorage.setItem("campusride_wait_id", waitId);
    }

    if (isUserWaiting) {
      setIsUserWaiting(false);
      localStorage.removeItem("campusride_wait_stop");
      localStorage.removeItem("campusride_wait_time");
      await cancelStopWait(waitId);
      reloadWaits();
    } else {
      setIsUserWaiting(true);
      localStorage.setItem("campusride_wait_stop", selectedStop.name);
      localStorage.setItem("campusride_wait_time", Date.now().toString());
      await markStopWait(waitId, selectedStop.name, deviceId, BUS_ID);
      reloadWaits();
    }
  };

  // Seconds ago timer
  useEffect(() => {
    const timer = setInterval(() => {
      setSecondsAgo(Math.floor((Date.now() - lastUpdatedAt) / 1000));
    }, 1000);
    return () => clearInterval(timer);
  }, [lastUpdatedAt]);

  // Dead Reckoning & Bus animation loop
  // In Demo Mode: continuously advances BUS-01 and BUS-02
  // In Live Mode: if network drops (>15s), dead-reckoning keeps moving bus at 25km/h along route!
  useEffect(() => {
    lastTickRef.current = Date.now();

    const loop = () => {
      const now = Date.now();
      const delta = (now - lastTickRef.current) / 1000;
      lastTickRef.current = now;

      // In Demo Mode: advance both buses smoothly at demoSpeedRef rate
      if (isDemoMode && !isDemoNetworkLoss) {
        const speedMult = demoSpeedRef.current;
        const newProgress1 = (demoProgressRef.current + (delta * speedMult) / 120) % 1;
        demoProgressRef.current = newProgress1;
        setBusPosition(lerpOnRoute(newProgress1));

        const newProgress2 = (bus2ProgressRef.current + (delta * speedMult) / 120) % 1;
        bus2ProgressRef.current = newProgress2;
        setBus2Position(lerpOnRoute(newProgress2));

        setLastUpdatedAt(Date.now());
      } else if (isDemoMode && isDemoNetworkLoss) {
        // Demo network loss: freeze bus updates (dead reckoning will show on student side)
      } else {
        // In Live Mode: if no updates for > 15s, continue dead-reckoning along the route
        const elapsedSinceUpdate = (now - lastUpdatedAt) / 1000;
        if (elapsedSinceUpdate > 15) {
          const deadProgress = (demoProgressRef.current + delta / 120) % 1;
          demoProgressRef.current = deadProgress;
          setBusPosition(lerpOnRoute(deadProgress));
        }
      }

      animationFrameRef.current = requestAnimationFrame(loop);
    };

    animationFrameRef.current = requestAnimationFrame(loop);

    return () => {
      if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
    };
  }, [isDemoMode, lastUpdatedAt]);

  // Supabase Realtime synchronization
  useEffect(() => {
    if (!isSupabaseConfigured || !supabase) {
      setIsConnected(false);
      return;
    }

    // Initial fetch of current bus row & active waits
    supabase
      .from("buses")
      .select("*")
      .eq("id", BUS_ID)
      .maybeSingle()
      .then(({ data, error }) => {
        if (data && !error) {
          const row = data as BusRow;
          if (row.crowd_level) setCrowdLevel(row.crowd_level);
          if (row.occupancy !== undefined) setOccupancy(row.occupancy);
          if (row.status) setBusStatus(row.status);
          if (row.crowd_source) setCrowdSource(row.crowd_source);
          if (row.lat && row.lng) {
            if (row.is_active) {
              setHasReceivedLiveUpdate(true);
              if (!isDemoMode) {
                setBusPosition({ lat: row.lat, lng: row.lng });
                setLastUpdatedAt(new Date(row.updated_at).getTime() || Date.now());
              }
            }
          }
        }
      });

    reloadWaits();

    // Realtime channel for buses
    const busChannel = supabase
      .channel("student-buses-sync")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "buses",
          filter: `id=eq.${BUS_ID}`,
        },
        (payload) => {
          const updated = payload.new as BusRow;
          if (updated) {
            if (updated.crowd_level) setCrowdLevel(updated.crowd_level);
            if (updated.occupancy !== undefined) setOccupancy(updated.occupancy);
            if (updated.status) setBusStatus(updated.status);
            if (updated.crowd_source) setCrowdSource(updated.crowd_source);
            if (updated.lat && updated.lng) {
              setHasReceivedLiveUpdate(Boolean(updated.is_active));
              if (!isDemoMode) {
                setBusPosition({ lat: updated.lat, lng: updated.lng });
                setLastUpdatedAt(Date.now());
              }
            }
          }
        }
      )
      .subscribe((status) => {
        setIsConnected(status === "SUBSCRIBED");
      });

    // Realtime channel for stop_waits
    const waitsChannel = supabase
      .channel("student-waits-realtime")
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

    return () => {
      supabase?.removeChannel(busChannel);
      supabase?.removeChannel(waitsChannel);
    };
  }, [isDemoMode]);

  // ETA and distance calculations for BUS-01
  const remainingKm1 = isDemoMode
    ? distanceToStop(demoProgressRef.current, selectedStopId)
    : haversine(busPosition, selectedStop);
  const etaMins1 = Math.max(1, Math.round(etaMinutes(remainingKm1)));

  // ETA for BUS-02 (Next Bus)
  const remainingKm2 = distanceToStop(bus2ProgressRef.current, selectedStopId);
  const etaMins2 = Math.max(1, Math.round(etaMinutes(remainingKm2) + 9)); // runs ~9-11 min behind

  // Live count waiting at currently selected stop
  const waitingAtSelectedStop = activeWaits.filter(
    (w) => w.stop_name === selectedStop.name
  ).length;

  // Capacity calculation (50 max)
  const seatsRemaining = Math.max(0, 50 - occupancy);
  const isCrowdShortage = waitingAtSelectedStop > seatsRemaining && seatsRemaining < 15;

  // Calculate covered vs remaining segments along the route
  const routeSegments = getRouteSegments(
    isDemoMode ? demoProgressRef.current : 0.25,
    busPosition
  );

  // Crowd status styles
  const crowdStyles: Record<CrowdLevel, { bg: string; text: string; label: string; border: string }> = {
    seats: {
      bg: "bg-emerald-950/70",
      text: "text-emerald-400",
      label: "Seats available",
      border: "border-emerald-700/60",
    },
    standing: {
      bg: "bg-amber-950/70",
      text: "text-amber-400",
      label: "Standing only",
      border: "border-amber-700/60",
    },
    full: {
      bg: "bg-rose-950/70",
      text: "text-rose-400",
      label: "Full",
      border: "border-rose-700/60",
    },
  };

  const crowdBadge = crowdStyles[crowdLevel] || crowdStyles.seats;
  const isWeakNetwork = secondsAgo > 15;

  return (
    <div className="relative w-full h-[calc(100dvh-56px)] overflow-hidden bg-gray-950" style={{ height: "calc(100dvh - 56px)" }}>
      {/* Full Map Canvas with explicit height */}
      <div className="absolute inset-0 z-0 w-full h-full" style={{ height: "100%", width: "100%" }}>
        <MapContainer
          center={[MAP_CENTER.lat, MAP_CENTER.lng]}
          zoom={MAP_ZOOM}
          maxZoom={16}
          zoomControl={false}
          className="w-full h-full"
          style={{ height: "100%", width: "100%" }}
        >
          <ZoomControl position="topright" />

          {/* Esri Dark Canvas with OpenStreetMap automatic fallback */}
          {!useOsmFallback ? (
            <>
              <TileLayer
                attribution="Tiles &copy; Esri"
                url="https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Base/MapServer/tile/{z}/{y}/{x}"
                maxZoom={16}
                eventHandlers={{ tileerror: handleTileError }}
              />
              <TileLayer
                attribution="Tiles &copy; Esri"
                url="https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Reference/MapServer/tile/{z}/{y}/{x}"
                maxZoom={16}
                pane="overlayPane"
              />
            </>
          ) : (
            <TileLayer
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
              url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
              maxZoom={19}
            />
          )}

          <MapLifecycle />
          <RecenterButton busPosition={busPosition} />

          {/* Covered Route Segment (Faded Grey) */}
          {routeSegments.covered.length > 1 && (
            <Polyline
              positions={routeSegments.covered.map((p) => [p.lat, p.lng])}
              pathOptions={{
                color: "#4b5563",
                weight: 6,
                opacity: 0.5,
                lineCap: "round",
                lineJoin: "round",
              }}
            />
          )}

          {/* Remaining Route Segment (Accent Indigo) */}
          {routeSegments.remaining.length > 1 && (
            <Polyline
              positions={routeSegments.remaining.map((p) => [p.lat, p.lng])}
              pathOptions={{
                color: "#6366f1",
                weight: 6,
                opacity: 0.95,
                lineCap: "round",
                lineJoin: "round",
              }}
            />
          )}

          {/* Stops Markers */}
          {STOPS.map((stop, idx) => (
            <Marker
              key={stop.id}
              position={[stop.lat, stop.lng]}
              icon={createStopIcon(idx, stop.id === selectedStopId)}
              eventHandlers={{
                click: () => handleSelectStop(stop.id),
              }}
            >
              <Popup>
                <div className="text-gray-100 p-1">
                  <div className="font-bold text-sm text-indigo-400">
                    Stop #{idx + 1}: {stop.name}
                  </div>
                  <div className="text-xs text-gray-300 mt-1">
                    {stop.id === selectedStopId ? "Selected destination" : "Tap to select destination"}
                  </div>
                </div>
              </Popup>
            </Marker>
          ))}

          {/* BUS-01 Marker (with dead-reckoning fade if weak network) */}
          <Marker
            position={[busPosition.lat, busPosition.lng]}
            icon={createBusIcon(busPosition.bearing || 0, false, !isDemoMode && isWeakNetwork)}
          >
            <Popup>
              <div className="text-gray-100 p-1">
                <div className="font-bold text-sm text-indigo-400">{BUS_ID} (Campus Express)</div>
                <div className="text-xs text-gray-300 mt-0.5">Occupancy: {occupancy}/50</div>
                <div className="text-xs text-gray-300">Status: {crowdBadge.label}</div>
              </div>
            </Popup>
          </Marker>

          {/* BUS-02 Marker in Demo Mode (Running ~10 min behind) */}
          {isDemoMode && (
            <Marker
              position={[bus2Position.lat, bus2Position.lng]}
              icon={createBusIcon(bus2Position.bearing || 0, true, false)}
            >
              <Popup>
                <div className="text-gray-100 p-1">
                  <div className="font-bold text-sm text-purple-400">BUS-02 (Campus Shuttle 2)</div>
                  <div className="text-xs text-gray-300 mt-0.5">Following ~10 min behind</div>
                  <div className="text-xs text-emerald-400">Seats available</div>
                </div>
              </Popup>
            </Marker>
          )}
        </MapContainer>
      </div>

      {/* Fixed Bottom Sheet (Uber/Rapido style) */}
      <div className="absolute bottom-0 left-0 right-0 z-[1000] pointer-events-none flex justify-center">
        <div
          className="pointer-events-auto w-full sm:max-w-[420px] bg-gray-950/95 backdrop-blur-xl border-t sm:border border-gray-800 rounded-t-3xl sm:rounded-2xl p-4 sm:p-5 shadow-2xl space-y-3 sm:mb-4"
          style={{ paddingBottom: "max(1.25rem, env(safe-area-inset-bottom))" }}
        >
          {/* Dismissable First-Time Hint for Students */}
          {showHint && (
            <div className="bg-indigo-950/70 border border-indigo-800/60 rounded-xl px-3 py-1.5 text-xs text-indigo-200 flex items-center justify-between">
              <span>Pick your stop to see when the bus will arrive.</span>
              <button
                type="button"
                onClick={() => {
                  setShowHint(false);
                  localStorage.setItem("campusride_student_hint_dismissed", "1");
                }}
                className="text-indigo-400 hover:text-white ml-2 font-bold px-1"
              >
                ✕
              </button>
            </div>
          )}

          {/* Bottom Sheet Drag Indicator & Realtime status */}
          <div className="flex items-center justify-between">
            <div className="w-10 h-1 bg-gray-700 rounded-full sm:hidden" />
            <div className="flex items-center gap-1.5 text-[11px] text-gray-400 ml-auto">
              <span
                className={`w-2 h-2 rounded-full ${
                  isConnected ? "bg-emerald-400 animate-pulse" : "bg-gray-500"
                }`}
              />
              <span className="font-medium">
                {isConnected ? "Connected" : "Offline"}
              </span>
            </div>
          </div>

          {/* Integrated Controls Row: Stop Selector & Demo/Live Toggle */}
          <div className="flex items-center gap-2">
            <div className="flex-1 min-w-0">
              <label htmlFor="bottom-stop-select" className="sr-only">
                Select My Stop
              </label>
              <div className="relative">
                <select
                  id="bottom-stop-select"
                  value={selectedStopId}
                  onChange={(e) => handleSelectStop(e.target.value)}
                  className="w-full h-11 bg-gray-900 border border-gray-800 text-white text-xs sm:text-sm font-medium rounded-xl px-3 pr-8 appearance-none focus:outline-none focus:border-indigo-500 transition-colors truncate"
                >
                  {STOPS.map((s, idx) => (
                    <option key={s.id} value={s.id}>
                      Stop {idx + 1}: {s.name}
                    </option>
                  ))}
                </select>
                <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2.5 text-gray-400">
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
                  </svg>
                </div>
              </div>
            </div>

            <div className="h-11 bg-gray-900 border border-gray-800 rounded-xl p-1 flex items-center shrink-0">
              <button
                type="button"
                onClick={() => setIsDemoMode(true)}
                className={`h-full px-2.5 sm:px-3 rounded-lg text-xs font-semibold transition-all ${
                  isDemoMode ? "bg-indigo-600 text-white shadow-sm" : "text-gray-400 hover:text-gray-200"
                }`}
              >
                Demo
              </button>
              <button
                type="button"
                onClick={() => {
                  if (!isSupabaseConfigured) {
                    alert("Supabase not configured. Add keys in .env to enable Live Mode.");
                    return;
                  }
                  setIsDemoMode(false);
                }}
                className={`h-full px-2.5 sm:px-3 rounded-lg text-xs font-semibold transition-all ${
                  !isDemoMode ? "bg-indigo-600 text-white shadow-sm" : "text-gray-400 hover:text-gray-200"
                }`}
                title="Live Mode"
              >
                Live
              </button>
            </div>
          </div>

          {/* Operational Status Alerts (Breakdown / Delayed) */}
          {busStatus === "breakdown" && (
            <div className="bg-rose-950/90 border border-rose-800 rounded-xl p-3 text-xs text-rose-200 space-y-0.5">
              <div className="font-bold flex items-center gap-1.5 text-rose-300">
                <span>⚠️</span> BUS-01 reported a breakdown
              </div>
              <p>Next bus (BUS-02) arriving in ~{etaMins2} min.</p>
            </div>
          )}

          {busStatus === "delayed" && (
            <div className="bg-amber-950/80 border border-amber-800/70 rounded-xl p-2.5 text-xs text-amber-200 flex items-center gap-2">
              <span className="text-amber-400 font-bold">⏱</span>
              <span>BUS-01 is delayed by heavy traffic.</span>
            </div>
          )}

          {/* Dead Reckoning / Weak Network Warning Banner */}
          {!isDemoMode && isWeakNetwork && (
            <div className="flex items-center gap-2 bg-amber-950/80 border border-amber-800/60 rounded-xl px-3 py-2 text-xs text-amber-300">
              <svg className="w-4 h-4 shrink-0 text-amber-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
              <span>Estimated position, weak network ({secondsAgo}s ago)</span>
            </div>
          )}

          {/* Peak Hour Shortage Alert: Waiting > Remaining Seats */}
          {isCrowdShortage && (
            <div className="bg-amber-950/80 border border-amber-800/80 rounded-xl p-2.5 text-xs text-amber-200 flex items-start gap-2">
              <span className="text-amber-400 font-bold mt-0.5">⚠️</span>
              <div>
                <p className="font-semibold text-amber-300">High Demand Warning</p>
                <p className="text-[11px] text-amber-400/90 mt-0.5">
                  This bus may be full when it reaches you ({seatsRemaining} seats left). Next bus in ~{etaMins2} min.
                </p>
              </div>
            </div>
          )}

          {/* Live Mode "Waiting for driver" state */}
          {!isDemoMode && !hasReceivedLiveUpdate ? (
            <div className="bg-gray-900 border border-gray-800 rounded-xl p-4 text-center space-y-1">
              <p className="text-sm font-semibold text-white">Waiting for driver to start trip</p>
              <p className="text-xs text-gray-400">
                Switch to Demo Mode above to preview simulated movement, or tap Start Trip on the Driver page.
              </p>
            </div>
          ) : (
            <>
              {/* Primary ETA Display */}
              <div className="flex items-start justify-between pt-1">
                <div className="min-w-0 pr-2">
                  <p className="text-[11px] uppercase tracking-wider text-gray-400 font-semibold">
                    Bus arriving at
                  </p>
                  <h2 className="text-base sm:text-lg font-bold text-white tracking-tight truncate">
                    {selectedStop.name}
                  </h2>
                  {/* Students waiting count under ETA */}
                  <div className="flex items-center gap-1.5 text-xs text-indigo-300 font-medium mt-0.5">
                    <svg className="w-3.5 h-3.5 text-indigo-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" />
                      <circle cx="9" cy="7" r="4" />
                      <path d="M23 21v-2a4 4 0 00-3-3.87" />
                      <path d="M16 3.13a4 4 0 010 7.75" />
                    </svg>
                    <span>
                      {waitingAtSelectedStop} {waitingAtSelectedStop === 1 ? "student" : "students"} waiting here
                    </span>
                  </div>
                </div>

                <div className="text-right shrink-0">
                  <span className="text-3xl sm:text-4xl font-extrabold text-indigo-400 tracking-tight">
                    ~{etaMins1}
                  </span>
                  <span className="text-xs text-gray-400 font-semibold ml-1.5">min</span>
                  {isDemoMode && (
                    <div className="text-[11px] text-purple-400 font-medium mt-0.5">
                      Next in ~{etaMins2}m
                    </div>
                  )}
                </div>
              </div>

              {/* Waiting Button: "I'm waiting at this stop" / "You're marked as waiting" */}
              <button
                type="button"
                onClick={handleToggleWait}
                className={`w-full min-h-[44px] rounded-xl font-semibold text-xs sm:text-sm flex items-center justify-center gap-2 transition-all shadow-md ${
                  isUserWaiting
                    ? "bg-emerald-950/80 border border-emerald-500/60 text-emerald-300 hover:bg-emerald-900/60"
                    : "bg-indigo-600 hover:bg-indigo-500 text-white shadow-indigo-950/50 active:scale-[0.98]"
                }`}
              >
                {isUserWaiting ? (
                  <>
                    <svg className="w-4 h-4 text-emerald-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                      <polyline points="20 6 9 17 4 12" />
                    </svg>
                    <span>You're marked as waiting (Tap to cancel)</span>
                  </>
                ) : (
                  <>
                    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <circle cx="12" cy="12" r="10" />
                      <polyline points="12 6 12 12 16 14" />
                    </svg>
                    <span>I'm waiting at this stop</span>
                  </>
                )}
              </button>

              {/* Details Row: Distance, Estimated Occupancy & Crowd Badge */}
              <div className="pt-2 border-t border-gray-800/80 flex items-center justify-between text-xs flex-wrap gap-2">
                <div className="flex items-center gap-2">
                  <div className="flex items-center gap-1.5 text-gray-300 font-medium">
                    <svg className="w-3.5 h-3.5 text-gray-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l5.447 2.724A1 1 0 0021 18.382V7.618a1 1 0 00-1.447-.894L15 4m0 13V4m0 0L9 7" />
                    </svg>
                    <span>{remainingKm1.toFixed(1)} km</span>
                  </div>

                  <div className="text-[11px] text-gray-400">
                    Estimated {occupancy}/50 on board
                  </div>
                </div>

                {/* Crowd Badge with Auto / Driver indicator */}
                <div className="flex items-center gap-1.5 shrink-0">
                  <div className={`px-2.5 py-1 rounded-full border ${crowdBadge.bg} ${crowdBadge.border} ${crowdBadge.text} font-semibold flex items-center gap-1 text-[11px]`}>
                    <span className="w-1.5 h-1.5 rounded-full bg-current"></span>
                    <span>{crowdBadge.label}</span>
                  </div>
                  <span className="text-[10px] text-gray-500 font-medium">
                    ({crowdSource === "auto" ? "Auto" : "Set by driver"})
                  </span>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
