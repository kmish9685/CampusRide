import React, { useState, useEffect, useRef } from "react";
import { MapContainer, TileLayer, Polyline, Marker, Popup, useMap, ZoomControl } from "react-leaflet";
import L from "leaflet";
import { STOPS, ROUTE_POLYLINE, MAP_CENTER, MAP_ZOOM, type RoutePoint } from "../data/route";
import { lerpOnRoute, distanceToStop, etaMinutes, haversine, getRouteSegments } from "../lib/routeUtils";
import { supabase, isSupabaseConfigured, type CrowdLevel, type BusRow } from "../lib/supabase";

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

// Modern SVG-based DivIcon for the bus with pulsing halo
const createBusIcon = () => {
  return L.divIcon({
    className: "custom-bus-marker",
    html: `
      <div class="bus-pulse-marker" style="
        display: flex;
        align-items: center;
        justify-content: center;
        width: 36px;
        height: 36px;
        background: #4f46e5;
        border: 2.5px solid #ffffff;
        border-radius: 9999px;
        box-shadow: 0 8px 16px rgba(79, 70, 229, 0.6);
      ">
        <svg style="width: 20px; height: 20px; color: #ffffff;" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
          <rect x="3" y="4" width="18" height="13" rx="2" />
          <path d="M16 17v2a1 1 0 01-1 1H9a1 1 0 01-1-1v-2" />
          <circle cx="7.5" cy="13.5" r="1.5" fill="currentColor" />
          <circle cx="16.5" cy="13.5" r="1.5" fill="currentColor" />
        </svg>
      </div>
    `,
    iconSize: [36, 36],
    iconAnchor: [18, 18],
  });
};

// Lifecycle manager for map: initial fitBounds with bottom padding, invalidateSize on mount & resize
function MapLifecycle() {
  const map = useMap();
  const hasFitBoundsRef = useRef(false);

  useEffect(() => {
    // Initial size calculation
    map.invalidateSize();
    const timer = setTimeout(() => {
      map.invalidateSize();
    }, 250);

    // Initial fitBounds with extra bottom padding for the bottom sheet card
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
  const [selectedStopId, setSelectedStopId] = useState<string>(STOPS[4].id); // default: College Main Gate
  const [busPosition, setBusPosition] = useState<RoutePoint>(ROUTE_POLYLINE[0]);
  const [crowdLevel, setCrowdLevel] = useState<CrowdLevel>("seats");
  const [lastUpdatedAt, setLastUpdatedAt] = useState<number>(Date.now());
  const [secondsAgo, setSecondsAgo] = useState<number>(0);
  const [useOsmFallback, setUseOsmFallback] = useState<boolean>(false);
  const tileErrorsRef = useRef<number>(0);

  const handleTileError = () => {
    tileErrorsRef.current += 1;
    if (tileErrorsRef.current > 3 && !useOsmFallback) {
      setUseOsmFallback(true);
    }
  };

  // Demo loop animation: 120 seconds full loop
  const demoProgressRef = useRef<number>(0);
  const animationFrameRef = useRef<number | null>(null);
  const lastTickRef = useRef<number>(Date.now());

  // Seconds ago timer
  useEffect(() => {
    const timer = setInterval(() => {
      setSecondsAgo(Math.floor((Date.now() - lastUpdatedAt) / 1000));
    }, 1000);
    return () => clearInterval(timer);
  }, [lastUpdatedAt]);

  // Demo mode bus movement
  useEffect(() => {
    if (!isDemoMode) {
      if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
      return;
    }

    lastTickRef.current = Date.now();

    const loop = () => {
      const now = Date.now();
      const delta = (now - lastTickRef.current) / 1000;
      lastTickRef.current = now;

      const newProgress = (demoProgressRef.current + delta / 120) % 1;
      demoProgressRef.current = newProgress;

      const pos = lerpOnRoute(newProgress);
      setBusPosition(pos);
      setLastUpdatedAt(Date.now());

      animationFrameRef.current = requestAnimationFrame(loop);
    };

    animationFrameRef.current = requestAnimationFrame(loop);

    return () => {
      if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
    };
  }, [isDemoMode]);

  // Supabase Realtime synchronization
  useEffect(() => {
    if (!isSupabaseConfigured || !supabase) return;

    const fetchBus = async () => {
      try {
        const { data, error } = await supabase!
          .from("buses")
          .select("*")
          .eq("id", "BUS-01")
          .single();

        if (data && !error) {
          const row = data as BusRow;
          setCrowdLevel(row.crowd_level);
          if (!isDemoMode && row.lat && row.lng) {
            setBusPosition({ lat: row.lat, lng: row.lng });
            setLastUpdatedAt(new Date(row.updated_at).getTime() || Date.now());
          }
        }
      } catch (err) {
        console.warn("Supabase fetch error:", err);
      }
    };

    fetchBus();

    const channel = supabase
      .channel("student-bus-tracker")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "buses",
          filter: "id=eq.BUS-01",
        },
        (payload) => {
          const updated = payload.new as BusRow;
          if (updated) {
            if (updated.crowd_level) {
              setCrowdLevel(updated.crowd_level);
            }
            if (!isDemoMode && updated.lat && updated.lng) {
              setBusPosition({ lat: updated.lat, lng: updated.lng });
              setLastUpdatedAt(Date.now());
            }
          }
        }
      )
      .subscribe();

    return () => {
      supabase!.removeChannel(channel);
    };
  }, [isDemoMode]);

  // ETA and distance calculations
  const selectedStop = STOPS.find((s) => s.id === selectedStopId) || STOPS[4];
  const remainingKm = isDemoMode
    ? distanceToStop(demoProgressRef.current, selectedStopId)
    : haversine(busPosition, selectedStop);
  const etaMins = Math.max(1, Math.round(etaMinutes(remainingKm)));

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
  const isWeakNetwork = secondsAgo > 30;

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
          {/* Zoom controls at top right */}
          <ZoomControl position="topright" />

          {/* Esri Dark Canvas with OpenStreetMap automatic fallback */}
          {!useOsmFallback ? (
            <>
              {/* Esri Dark Gray Base */}
              <TileLayer
                attribution="Tiles &copy; Esri"
                url="https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Base/MapServer/tile/{z}/{y}/{x}"
                maxZoom={16}
                eventHandlers={{
                  tileerror: handleTileError,
                }}
              />
              {/* Esri Dark Gray Reference Labels on top */}
              <TileLayer
                attribution="Tiles &copy; Esri"
                url="https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Reference/MapServer/tile/{z}/{y}/{x}"
                maxZoom={16}
                pane="overlayPane"
              />
            </>
          ) : (
            /* Automatic fallback to standard OpenStreetMap */
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
                click: () => setSelectedStopId(stop.id),
              }}
            >
              <Popup>
                <div className="text-gray-100 p-1">
                  <div className="font-bold text-sm text-indigo-400">
                    Stop #{idx + 1}: {stop.name}
                  </div>
                  <div className="text-xs text-gray-300 mt-1">
                    {stop.id === selectedStopId
                      ? "Selected stop"
                      : "Tap to select this stop"}
                  </div>
                </div>
              </Popup>
            </Marker>
          ))}

          {/* Bus Marker */}
          <Marker position={[busPosition.lat, busPosition.lng]} icon={createBusIcon()}>
            <Popup>
              <div className="text-gray-100 p-1">
                <div className="font-bold text-sm text-indigo-400">BUS-01 (Campus Express)</div>
                <div className="text-xs text-gray-300 mt-1">Status: {crowdBadge.label}</div>
              </div>
            </Popup>
          </Marker>
        </MapContainer>
      </div>

      {/* Fixed Bottom Sheet (Uber/Rapido style) */}
      <div className="absolute bottom-0 left-0 right-0 z-[1000] pointer-events-none flex justify-center">
        <div
          className="pointer-events-auto w-full sm:max-w-[420px] bg-gray-950/95 backdrop-blur-xl border-t sm:border border-gray-800 rounded-t-3xl sm:rounded-2xl p-4 sm:p-5 shadow-2xl space-y-3.5 sm:mb-4"
          style={{ paddingBottom: "max(1.25rem, env(safe-area-inset-bottom))" }}
        >
          {/* Bottom Sheet Drag Indicator (mobile) */}
          <div className="w-12 h-1 bg-gray-700 rounded-full mx-auto sm:hidden" />

          {/* Integrated Controls Row: Stop Selector & Demo/Live Toggle inside bottom card */}
          <div className="flex items-center gap-2">
            {/* My Stop Dropdown (min 44px height) */}
            <div className="flex-1 min-w-0">
              <label htmlFor="bottom-stop-select" className="sr-only">
                Select My Stop
              </label>
              <div className="relative">
                <select
                  id="bottom-stop-select"
                  value={selectedStopId}
                  onChange={(e) => setSelectedStopId(e.target.value)}
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

            {/* Demo / Live Toggle (min 44px height) */}
            <div className="h-11 bg-gray-900 border border-gray-800 rounded-xl p-1 flex items-center shrink-0">
              <button
                type="button"
                onClick={() => setIsDemoMode(true)}
                className={`h-full px-2.5 sm:px-3 rounded-lg text-xs font-semibold transition-all ${
                  isDemoMode
                    ? "bg-indigo-600 text-white shadow-sm"
                    : "text-gray-400 hover:text-gray-200"
                }`}
              >
                Demo
              </button>
              <button
                type="button"
                onClick={() => {
                  if (!isSupabaseConfigured) {
                    alert("Supabase is not configured yet. Add VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY to .env to enable Live GPS mode.");
                    return;
                  }
                  setIsDemoMode(false);
                }}
                className={`h-full px-2.5 sm:px-3 rounded-lg text-xs font-semibold transition-all ${
                  !isDemoMode
                    ? "bg-indigo-600 text-white shadow-sm"
                    : "text-gray-400 hover:text-gray-200"
                }`}
                title={!isSupabaseConfigured ? "Connect Supabase to enable Live Mode" : "Switch to Live GPS"}
              >
                Live
              </button>
            </div>
          </div>

          {/* Weak network warning banner if > 30s */}
          {isWeakNetwork && (
            <div className="flex items-center gap-2 bg-amber-950/80 border border-amber-800/60 rounded-xl px-3 py-2 text-xs text-amber-300">
              <svg className="w-4 h-4 shrink-0 text-amber-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
              <span>Weak network, showing last known location</span>
            </div>
          )}

          {/* Primary ETA Display */}
          <div className="flex items-center justify-between pt-1">
            <div className="min-w-0 pr-2">
              <p className="text-[11px] uppercase tracking-wider text-gray-400 font-semibold">
                Bus arriving at
              </p>
              <h2 className="text-base sm:text-lg font-bold text-white tracking-tight truncate">
                {selectedStop.name}
              </h2>
            </div>
            <div className="text-right shrink-0">
              <span className="text-3xl sm:text-4xl font-extrabold text-indigo-400 tracking-tight">
                ~{etaMins}
              </span>
              <span className="text-xs text-gray-400 font-semibold ml-1.5">min</span>
            </div>
          </div>

          {/* Details Row: Distance, Crowd Badge, Network status */}
          <div className="pt-2 border-t border-gray-800/80 flex items-center justify-between text-xs">
            <div className="flex items-center gap-2.5">
              <div className="flex items-center gap-1.5 text-gray-300 font-medium">
                <svg className="w-3.5 h-3.5 text-gray-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l5.447 2.724A1 1 0 0021 18.382V7.618a1 1 0 00-1.447-.894L15 4m0 13V4m0 0L9 7" />
                </svg>
                <span>{remainingKm.toFixed(1)} km</span>
              </div>

              {/* Crowd Badge */}
              <div className={`px-2.5 py-1 rounded-full border ${crowdBadge.bg} ${crowdBadge.border} ${crowdBadge.text} font-semibold flex items-center gap-1.5 text-[11px]`}>
                <span className="w-1.5 h-1.5 rounded-full bg-current"></span>
                <span>{crowdBadge.label}</span>
              </div>
            </div>

            {/* Last updated indicator */}
            <div className="text-gray-400 text-[11px] shrink-0 font-medium">
              {secondsAgo === 0 ? "Just now" : `${secondsAgo}s ago`}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
