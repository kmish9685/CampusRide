import React, { useState, useEffect } from "react";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from "recharts";
import { BUS_ID, STOPS } from "../data/route";
import {
  supabase,
  isSupabaseConfigured,
  upsertBus,
  type BusRow,
  type CrowdLevel,
  type StopWait,
  fetchActiveWaits,
  broadcastDemoEvent,
} from "../lib/supabase";
import {
  SAMPLE_TRIP_LOGS,
  computeTripLogMetrics,
  type TripLogRow,
} from "../data/sampleTripLogs";

export default function Admin() {
  const [buses, setBuses] = useState<BusRow[]>([
    {
      id: BUS_ID,
      name: "Campus Express",
      route_name: "City Route 1",
      lat: 18.5204,
      lng: 73.8567,
      crowd_level: "seats",
      is_active: false,
      capacity: 50,
      occupancy: 24,
      status: "on_time",
      crowd_source: "auto",
      updated_at: new Date().toISOString(),
    },
    {
      id: "BUS-02",
      name: "Campus Shuttle 2",
      route_name: "City Route 1",
      lat: 18.5147,
      lng: 73.8490,
      crowd_level: "seats",
      is_active: true,
      capacity: 50,
      occupancy: 18,
      status: "on_time",
      crowd_source: "auto",
      updated_at: new Date().toISOString(),
    },
  ]);

  const [tripLogs, setTripLogs] = useState<TripLogRow[]>(SAMPLE_TRIP_LOGS);
  const [isUsingSupabaseLogs, setIsUsingSupabaseLogs] = useState<boolean>(false);
  const [activeWaits, setActiveWaits] = useState<StopWait[]>([]);
  const [showHint, setShowHint] = useState<boolean>(() => {
    return !localStorage.getItem("campusride_admin_hint_dismissed");
  });

  // Compute metrics from current tripLogs (Supabase or local sample fallback)
  const metrics = computeTripLogMetrics(tripLogs);

  // Reload active waits
  const reloadWaits = async () => {
    try {
      const { data } = await fetchActiveWaits(BUS_ID);
      if (data) {
        setActiveWaits(data as StopWait[]);
      }
    } catch (err) {
      console.warn("Error fetching admin active waits:", err);
    }
  };

  // Fetch initial trip_logs & buses from Supabase
  useEffect(() => {
    if (!isSupabaseConfigured || !supabase) return;

    // Fetch trip_logs
    supabase
      .from("trip_logs")
      .select("*")
      .order("scheduled_time", { ascending: true })
      .then(({ data, error }) => {
        if (data && data.length > 0 && !error) {
          setTripLogs(data as TripLogRow[]);
          setIsUsingSupabaseLogs(true);
        }
      });

    // Fetch buses
    supabase
      .from("buses")
      .select("*")
      .then(({ data, error }) => {
        if (data && data.length > 0 && !error) {
          setBuses(data as BusRow[]);
        }
      });

    reloadWaits();

    // Realtime channel for buses table
    const busesChannel = supabase
      .channel("admin-buses-realtime")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "buses",
        },
        (payload) => {
          const updated = payload.new as BusRow;
          if (updated) {
            setBuses((prev) => {
              const existingIndex = prev.findIndex((b) => b.id === updated.id);
              if (existingIndex >= 0) {
                const next = [...prev];
                next[existingIndex] = updated;
                return next;
              }
              return [...prev, updated];
            });
          }
        }
      )
      .subscribe();

    // Realtime channel for stop_waits table
    const waitsChannel = supabase
      .channel("admin-waits-realtime")
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
      supabase?.removeChannel(busesChannel);
      supabase?.removeChannel(waitsChannel);
    };
  }, []);

  // Primary bus (BUS-01) capacity & remaining seats
  const bus01 = buses.find((b) => b.id === BUS_ID) || buses[0];
  const bus01Capacity = bus01?.capacity || 50;
  const bus01Occupancy = bus01?.occupancy || 0;
  const bus01SeatsLeft = Math.max(0, bus01Capacity - bus01Occupancy);

  // Generate Realtime Operational Alerts
  const alerts: { id: string; type: "critical" | "warning" | "info"; title: string; message: string }[] = [];

  // 1. Bus operational alerts
  buses.forEach((b) => {
    if (b.status === "breakdown") {
      alerts.push({
        id: `breakdown-${b.id}`,
        type: "critical",
        title: `${b.id} Reported Breakdown`,
        message: `${b.id} has reported a vehicle breakdown. BUS-02 is covering passenger pickups on City Route 1.`,
      });
    } else if (b.status === "delayed") {
      alerts.push({
        id: `delayed-${b.id}`,
        type: "warning",
        title: `${b.id} Running Delayed`,
        message: `${b.id} reported heavy congestion delays (~6-10 min behind scheduled arrival).`,
      });
    }
  });

  // 2. Stop seat shortages vs waiting demand
  STOPS.forEach((stop, idx) => {
    const waitingCount = activeWaits.filter((w) => w.stop_name === stop.name).length;
    if (waitingCount > bus01SeatsLeft && waitingCount > 0) {
      alerts.push({
        id: `shortage-${stop.id}`,
        type: "critical",
        title: `Seat Shortage at Stop ${idx + 1}`,
        message: `Stop ${idx + 1} (${stop.name}): ${waitingCount} waiting, only ${bus01SeatsLeft} seats left on ${bus01.id}. Consider sending an extra bus.`,
      });
    }
  });

  // Crowd badge styles
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

  return (
    <div className="flex-1 w-full max-w-6xl mx-auto p-4 sm:p-6 space-y-5">
      {/* Dismissable First-Time Hint for Admin */}
      {showHint && (
        <div className="w-full bg-indigo-950/80 border border-indigo-800/80 rounded-2xl p-3 text-xs text-indigo-200 flex items-center justify-between shadow-sm">
          <span>Monitor fleet capacity, live student demand alerts, and operational delays in real time.</span>
          <button
            type="button"
            onClick={() => {
              setShowHint(false);
              localStorage.setItem("campusride_admin_hint_dismissed", "1");
            }}
            className="text-indigo-400 hover:text-white ml-2 font-bold px-1.5 py-0.5 rounded"
          >
            ✕
          </button>
        </div>
      )}

      {/* Header with Source Badge */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
            Transport Admin Dashboard
          </h1>
          <p className="text-gray-400 text-xs sm:text-sm mt-0.5">
            Operational analytics, stop delays, and fleet capacity management.
          </p>
        </div>
        <div>
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-gray-900 border border-gray-800 text-gray-300">
            <span
              className={`w-2 h-2 rounded-full ${
                isUsingSupabaseLogs ? "bg-emerald-400 animate-pulse" : "bg-indigo-400"
              }`}
            />
            {isUsingSupabaseLogs ? "Supabase Live DB" : "Sample Seed Data (Offline)"}
          </span>
        </div>
      </div>

      {/* Live Alerts Card at Top (Updates in Realtime) */}
      <div className="bg-gray-900/90 border border-gray-800 rounded-2xl p-4 sm:p-5 shadow-lg space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="flex h-2.5 w-2.5 relative">
              <span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${alerts.length > 0 ? "bg-rose-400" : "bg-emerald-400"}`} />
              <span className={`relative inline-flex rounded-full h-2.5 w-2.5 ${alerts.length > 0 ? "bg-rose-500" : "bg-emerald-500"}`} />
            </span>
            <h2 className="text-sm font-bold text-white uppercase tracking-wider">
              Live Fleet Alerts ({alerts.length})
            </h2>
          </div>
          <span className="text-xs text-gray-400 font-medium">Realtime updates</span>
        </div>

        {alerts.length > 0 ? (
          <div className="space-y-2.5">
            {alerts.map((alert) => (
              <div
                key={alert.id}
                className={`p-3.5 rounded-xl border flex items-start gap-3 ${
                  alert.type === "critical"
                    ? "bg-rose-950/70 border-rose-800/80 text-rose-200"
                    : alert.type === "warning"
                    ? "bg-amber-950/70 border-amber-800/80 text-amber-200"
                    : "bg-indigo-950/70 border-indigo-800/80 text-indigo-200"
                }`}
              >
                <span className="text-base mt-0.5">
                  {alert.type === "critical" ? "🚨" : alert.type === "warning" ? "⚠️" : "ℹ️"}
                </span>
                <div className="flex-1 text-xs">
                  <p className="font-bold text-sm text-white">{alert.title}</p>
                  <p className="mt-0.5 opacity-90 leading-relaxed">{alert.message}</p>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="p-3.5 rounded-xl border border-emerald-800/50 bg-emerald-950/40 text-emerald-300 text-xs flex items-center gap-2.5">
            <svg className="w-4 h-4 text-emerald-400 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <polyline points="20 6 9 17 4 12" />
            </svg>
            <span>All operations normal. Sufficient seat capacity across all 5 stops.</span>
          </div>
        )}
      </div>

      {/* Top Row: 3 Summary Cards (1 col mobile, 2 col tablet, 3 col desktop) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {/* Card 1: Average Delay */}
        <div className="bg-gray-900/90 border border-gray-800 rounded-2xl p-5 shadow-lg flex flex-col justify-between">
          <div className="flex items-center justify-between text-xs font-semibold text-gray-400 uppercase tracking-wider">
            <span>Average Delay</span>
            <div className="w-8 h-8 rounded-lg bg-indigo-600/20 flex items-center justify-center text-indigo-400">
              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="10" />
                <polyline points="12 6 12 12 16 14" />
              </svg>
            </div>
          </div>
          <div className="mt-4 flex items-baseline gap-2">
            <span className="text-3xl sm:text-4xl font-extrabold text-white tracking-tight">
              {metrics.avgDelayAll}
            </span>
            <span className="text-sm font-semibold text-gray-400">min / stop</span>
          </div>
          <p className="text-xs text-indigo-400 font-medium mt-2">
            Highest at {metrics.highestDelayStop}
          </p>
        </div>

        {/* Card 2: Busiest Stop */}
        <div className="bg-gray-900/90 border border-gray-800 rounded-2xl p-5 shadow-lg flex flex-col justify-between">
          <div className="flex items-center justify-between text-xs font-semibold text-gray-400 uppercase tracking-wider">
            <span>Busiest Stop</span>
            <div className="w-8 h-8 rounded-lg bg-indigo-600/20 flex items-center justify-center text-indigo-400">
              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" />
                <circle cx="9" cy="7" r="4" />
              </svg>
            </div>
          </div>
          <div className="mt-4">
            <span className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight truncate block">
              {metrics.busiestStopName}
            </span>
          </div>
          <p className="text-xs text-emerald-400 font-medium mt-2">
            Primary college commuter pickup point
          </p>
        </div>

        {/* Card 3: Peak Hour */}
        <div className="bg-gray-900/90 border border-gray-800 rounded-2xl p-5 shadow-lg flex flex-col justify-between sm:col-span-2 lg:col-span-1">
          <div className="flex items-center justify-between text-xs font-semibold text-gray-400 uppercase tracking-wider">
            <span>Peak Hour</span>
            <div className="w-8 h-8 rounded-lg bg-indigo-600/20 flex items-center justify-center text-indigo-400">
              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
              </svg>
            </div>
          </div>
          <div className="mt-4">
            <span className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight block">
              {metrics.peakHour}
            </span>
          </div>
          <p className="text-xs text-amber-400 font-medium mt-2">
            Morning inbound lecture rush
          </p>
        </div>
      </div>

      {/* Live Buses Card: Status & "Not started" indicator */}
      <div className="bg-gray-900/90 border border-gray-800 rounded-2xl p-5 shadow-lg space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <svg className="w-4 h-4 text-indigo-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <rect x="3" y="4" width="18" height="13" rx="2" />
              <path d="M16 17v2a1 1 0 01-1 1H9a1 1 0 01-1-1v-2" />
              <circle cx="7.5" cy="13.5" r="1.5" fill="currentColor" />
              <circle cx="16.5" cy="13.5" r="1.5" fill="currentColor" />
            </svg>
            <h2 className="text-sm font-bold text-white uppercase tracking-wider">
              Live Fleet Status
            </h2>
          </div>
          <span className="text-xs text-gray-400 font-medium">
            {buses.length} {buses.length === 1 ? "vehicle" : "vehicles"} monitored
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {buses.map((bus) => {
            const badge = crowdStyles[bus.crowd_level] || crowdStyles.seats;
            const opStatus = bus.status || "on_time";
            return (
              <div
                key={bus.id}
                className="bg-gray-950/70 border border-gray-800/90 rounded-xl p-4 flex flex-col justify-between space-y-3"
              >
                <div className="flex items-start justify-between">
                  <div>
                    <h3 className="text-base font-bold text-white tracking-tight">
                      {bus.id} · {bus.name}
                    </h3>
                    <p className="text-xs text-gray-400 mt-0.5">{bus.route_name}</p>
                    <p className="text-xs font-semibold text-indigo-300 mt-1">
                      Estimated {bus.occupancy ?? 0}/{bus.capacity ?? 50} on board
                    </p>
                  </div>

                  <div className="flex flex-col items-end gap-1.5">
                    {/* Activity: Active vs Not started */}
                    <span
                      className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-bold ${
                        bus.is_active
                          ? "bg-emerald-950/80 text-emerald-400 border border-emerald-700/60"
                          : "bg-gray-800 text-gray-400 border border-gray-700"
                      }`}
                    >
                      <span
                        className={`w-1.5 h-1.5 rounded-full ${
                          bus.is_active ? "bg-emerald-400 animate-pulse" : "bg-gray-500"
                        }`}
                      />
                      {bus.is_active ? "Active" : "Not started"}
                    </span>

                    {/* Operational Status: On time / Delayed / Breakdown */}
                    <span
                      className={`px-2 py-0.5 rounded-full border text-[10px] font-bold uppercase tracking-wider ${
                        opStatus === "breakdown"
                          ? "bg-rose-950/80 border-rose-700/80 text-rose-300"
                          : opStatus === "delayed"
                          ? "bg-amber-950/80 border-amber-700/80 text-amber-300"
                          : "bg-emerald-950/80 border-emerald-700/80 text-emerald-300"
                      }`}
                    >
                      {opStatus === "breakdown"
                        ? "Breakdown"
                        : opStatus === "delayed"
                        ? "Delayed"
                        : "On time"}
                    </span>
                  </div>
                </div>

                <div className="flex items-center justify-between pt-2 border-t border-gray-800/80 text-xs">
                  <span className="text-gray-400">Crowd Level:</span>
                  <div className="flex items-center gap-1.5">
                    <span
                      className={`px-2 py-0.5 rounded-full border ${badge.bg} ${badge.border} ${badge.text} font-semibold text-[11px] flex items-center gap-1.5`}
                    >
                      <span className="w-1.5 h-1.5 rounded-full bg-current"></span>
                      <span>{badge.label}</span>
                    </span>
                    <span className="text-[10px] text-gray-500 font-medium">
                      ({bus.crowd_source === "manual" ? "Driver" : "Auto"})
                    </span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Auto-Generated Insights Box */}
      <div className="bg-indigo-950/40 border border-indigo-900/60 rounded-2xl p-5 shadow-lg space-y-2.5">
        <div className="flex items-center gap-2 text-indigo-400">
          <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="12" cy="12" r="10" />
            <line x1="12" y1="16" x2="12" y2="12" />
            <line x1="12" y1="8" x2="12.01" y2="8" />
          </svg>
          <h2 className="text-sm font-bold uppercase tracking-wider text-indigo-300">
            System Operational Insights
          </h2>
        </div>
        <div className="space-y-1.5 text-xs sm:text-sm text-gray-300 leading-relaxed pl-7">
          <p>
            • <strong className="text-white">{metrics.highestDelayStop}</strong> has the highest delay along the route, averaging <strong className="text-indigo-300">{metrics.maxStopDelay} minutes</strong> behind schedule due to junction bottlenecks.
          </p>
          <p>
            • College buses are most crowded between <strong className="text-white">08:00 and 09:00 AM</strong>; consider adding one more morning shuttle trip to prevent standing-room overflow.
          </p>
          <p>
            • <strong className="text-white">{metrics.busiestStopName}</strong> generates the largest share of total passenger boardings; boarding dwell times can be reduced by queuing tickets in advance.
          </p>
        </div>
      </div>

      {/* Recharts Analytics Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Chart 1: Average Delay per Stop */}
        <div className="bg-gray-900/90 border border-gray-800 rounded-2xl p-4 sm:p-5 shadow-lg space-y-2">
          <h3 className="text-sm font-bold text-white uppercase tracking-wider">
            Average Delay per Stop
          </h3>
          <p className="text-xs text-gray-400">
            Minutes difference between scheduled and actual arrival time.
          </p>
          <div className="h-64 sm:h-72 w-full pt-2">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={metrics.delayChartData}
                margin={{ top: 10, right: 10, left: -20, bottom: 20 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" vertical={false} />
                <XAxis
                  dataKey="stop"
                  stroke="#6b7280"
                  fontSize={10}
                  angle={-15}
                  textAnchor="end"
                  interval={0}
                />
                <YAxis stroke="#6b7280" fontSize={11} unit="m" />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "#111827",
                    borderColor: "#374151",
                    borderRadius: "0.75rem",
                    fontSize: "12px",
                  }}
                  itemStyle={{ color: "#818cf8" }}
                  formatter={(value: any) => [`${value} min`, "Avg Delay"]}
                />
                <Bar
                  dataKey="delay"
                  fill="#6366f1"
                  radius={[6, 6, 0, 0]}
                  name="Delay (min)"
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Chart 2: Students Boarding per Stop */}
        <div className="bg-gray-900/90 border border-gray-800 rounded-2xl p-4 sm:p-5 shadow-lg space-y-2">
          <h3 className="text-sm font-bold text-white uppercase tracking-wider">
            Students Boarding per Stop
          </h3>
          <p className="text-xs text-gray-400">
            Total passenger volume across logged historical runs.
          </p>
          <div className="h-64 sm:h-72 w-full pt-2">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={metrics.boardingChartData}
                margin={{ top: 10, right: 10, left: -15, bottom: 20 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" vertical={false} />
                <XAxis
                  dataKey="stop"
                  stroke="#6b7280"
                  fontSize={10}
                  angle={-15}
                  textAnchor="end"
                  interval={0}
                />
                <YAxis stroke="#6b7280" fontSize={11} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "#111827",
                    borderColor: "#374151",
                    borderRadius: "0.75rem",
                    fontSize: "12px",
                  }}
                  itemStyle={{ color: "#34d399" }}
                  formatter={(value: any) => [`${value} students`, "Total Boardings"]}
                />
                <Bar
                  dataKey="boardings"
                  fill="#10b981"
                  radius={[6, 6, 0, 0]}
                  name="Students"
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Chart 3: Boardings by Hour of Day (Full Width on desktop) */}
        <div className="bg-gray-900/90 border border-gray-800 rounded-2xl p-4 sm:p-5 shadow-lg space-y-2 lg:col-span-2">
          <h3 className="text-sm font-bold text-white uppercase tracking-wider">
            Commuter Demand by Hour of Day
          </h3>
          <p className="text-xs text-gray-400">
            Identifies daily peak travel hours (08:00 morning rush & 16:00 college dismissal).
          </p>
          <div className="h-64 sm:h-72 w-full pt-2">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart
                data={metrics.hourlyChartData}
                margin={{ top: 10, right: 20, left: -15, bottom: 5 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" vertical={false} />
                <XAxis dataKey="hour" stroke="#6b7280" fontSize={11} />
                <YAxis stroke="#6b7280" fontSize={11} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "#111827",
                    borderColor: "#374151",
                    borderRadius: "0.75rem",
                    fontSize: "12px",
                  }}
                  itemStyle={{ color: "#818cf8" }}
                  formatter={(value: any) => [`${value} students`, "Boardings"]}
                />
                <Line
                  type="monotone"
                  dataKey="boardings"
                  stroke="#6366f1"
                  strokeWidth={3}
                  dot={{ fill: "#6366f1", r: 4 }}
                  activeDot={{ r: 6 }}
                  name="Boardings"
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* ─── Demo Controls Panel (hidden by default) ─── */}
      <DemoControlsPanel />
    </div>
  );
}

// ─── Demo Controls Panel Component ────────────────────────────────────────────
function DemoControlsPanel() {
  const [isOpen, setIsOpen] = useState<boolean>(false);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [isSpeedX3, setIsSpeedX3] = useState<boolean>(() => {
    return localStorage.getItem("campusride_demo_speed_x3") === "1";
  });

  const showFeedback = (msg: string) => {
    setFeedback(msg);
    setTimeout(() => setFeedback(null), 3500);
  };

  // 1. Reset Demo
  const handleResetDemo = async () => {
    showFeedback("Resetting...");
    try {
      if (supabase) {
        await supabase.from("stop_waits").delete().neq("id", "__none__");
      }
      await upsertBus({
        id: "BUS-01",
        lat: 18.520374,
        lng: 73.856481,
        occupancy: 0,
        crowd_level: "seats",
        crowd_source: "auto",
        status: "on_time",
        is_active: true,
      });
      await upsertBus({
        id: "BUS-02",
        lat: 18.507999,
        lng: 73.842014,
        occupancy: 0,
        crowd_level: "seats",
        crowd_source: "auto",
        status: "on_time",
        is_active: true,
      });
      broadcastDemoEvent("demo_reset", { ts: Date.now() });
      showFeedback("✓ Reset — both buses at start, waits cleared");
    } catch (err) {
      showFeedback("Reset failed — check Supabase");
      console.error(err);
    }
  };

  // 2. Peak Hour Rush
  const handlePeakRush = async () => {
    showFeedback("Adding peak crowd...");
    try {
      const ts = Date.now();
      const stop3 = Array.from({ length: 20 }, (_, i) => ({
        id: `demo_s3_${i}_${ts}`,
        bus_id: "BUS-01",
        stop_name: "Residential Colony",
        device_id: `demo_dev_s3_${i}`,
        created_at: new Date().toISOString(),
      }));
      const stop4 = Array.from({ length: 15 }, (_, i) => ({
        id: `demo_s4_${i}_${ts}`,
        bus_id: "BUS-01",
        stop_name: "Science Park Junction",
        device_id: `demo_dev_s4_${i}`,
        created_at: new Date().toISOString(),
      }));
      if (supabase) {
        await supabase.from("stop_waits").upsert([...stop3, ...stop4]);
      }
      // Fill BUS-01 to 44/50 so shortage alert triggers for stops with >6 waiting
      await upsertBus({ id: "BUS-01", occupancy: 44, crowd_level: "standing", crowd_source: "auto" });
      broadcastDemoEvent("demo_peak_rush", { stop3: 20, stop4: 15 });
      showFeedback("✓ Peak rush — 20 at Stop 3, 15 at Stop 4. Alerts card should fire.");
    } catch (err) {
      showFeedback("Peak rush failed");
      console.error(err);
    }
  };

  // 3. Breakdown
  const handleBreakdown = async () => {
    showFeedback("Setting breakdown...");
    try {
      await upsertBus({ id: "BUS-01", status: "breakdown" });
      broadcastDemoEvent("demo_breakdown", { busId: "BUS-01" });
      showFeedback("✓ BUS-01 breakdown — student page shows alert & next bus time");
    } catch (err) {
      showFeedback("Breakdown failed");
      console.error(err);
    }
  };

  // 4. Network Loss
  const handleNetworkLoss = () => {
    broadcastDemoEvent("demo_network_loss", { duration: 30, ts: Date.now() });
    showFeedback("✓ Network loss broadcast — student sees faded bus & 'estimated position' for 30s");
  };

  // 5. Speed x3 toggle
  const handleSpeedToggle = () => {
    const next = !isSpeedX3;
    setIsSpeedX3(next);
    localStorage.setItem("campusride_demo_speed_x3", next ? "1" : "0");
    broadcastDemoEvent("demo_speed", { x3: next });
    showFeedback(next ? "✓ Speed x3 enabled — buses move faster" : "✓ Speed reset to normal");
  };

  return (
    <div className="border border-dashed border-gray-700/60 rounded-2xl overflow-hidden">
      {/* Toggle */}
      <button
        type="button"
        onClick={() => setIsOpen((v) => !v)}
        className="w-full flex items-center justify-between px-5 py-3 bg-gray-900/60 hover:bg-gray-900 transition-colors"
      >
        <div className="flex items-center gap-2.5">
          <span className="text-base">🎮</span>
          <div className="text-left">
            <span className="text-sm font-bold text-gray-400">Demo Controls</span>
            <span className="text-[11px] text-gray-600 block">Jury shortcuts — hidden from students</span>
          </div>
        </div>
        <svg
          className={`w-4 h-4 text-gray-600 transition-transform ${isOpen ? "rotate-180" : ""}`}
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
        >
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </button>

      {isOpen && (
        <div className="bg-gray-950/90 border-t border-gray-800/50 p-4 sm:p-5 space-y-4">
          {feedback && (
            <div className="bg-indigo-950/80 border border-indigo-800/60 text-indigo-200 text-xs font-medium px-4 py-2.5 rounded-xl animate-pulse">
              {feedback}
            </div>
          )}

          <p className="text-[11px] text-gray-500 leading-relaxed">
            These buttons write directly to Supabase and broadcast realtime events to every open tab — Student, Driver, and Admin pages all update instantly.
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {/* 1. Reset */}
            <button
              type="button"
              id="demo-btn-reset"
              onClick={handleResetDemo}
              className="flex items-start gap-3 bg-gray-800 hover:bg-gray-700 border border-gray-700 rounded-xl px-4 py-3.5 text-left transition-all active:scale-[0.97]"
            >
              <span className="text-xl pt-0.5">🔄</span>
              <div>
                <p className="text-sm font-bold text-white">Reset demo</p>
                <p className="text-[11px] text-gray-400 mt-0.5">Clears waiting students, resets both buses to start, occupancy 0, On time</p>
              </div>
            </button>

            {/* 2. Peak Rush */}
            <button
              type="button"
              id="demo-btn-peak"
              onClick={handlePeakRush}
              className="flex items-start gap-3 bg-amber-950/40 hover:bg-amber-950/70 border border-amber-800/50 rounded-xl px-4 py-3.5 text-left transition-all active:scale-[0.97]"
            >
              <span className="text-xl pt-0.5">🚦</span>
              <div>
                <p className="text-sm font-bold text-amber-200">Peak hour rush</p>
                <p className="text-[11px] text-amber-400/80 mt-0.5">20 waiting at Stop 3, 15 at Stop 4 → Alerts card shows "send extra bus"</p>
              </div>
            </button>

            {/* 3. Breakdown */}
            <button
              type="button"
              id="demo-btn-breakdown"
              onClick={handleBreakdown}
              className="flex items-start gap-3 bg-rose-950/40 hover:bg-rose-950/70 border border-rose-800/50 rounded-xl px-4 py-3.5 text-left transition-all active:scale-[0.97]"
            >
              <span className="text-xl pt-0.5">🛑</span>
              <div>
                <p className="text-sm font-bold text-rose-200">Breakdown</p>
                <p className="text-[11px] text-rose-400/80 mt-0.5">Sets BUS-01 to Breakdown → student sees banner &amp; next bus time</p>
              </div>
            </button>

            {/* 4. Network Loss */}
            <button
              type="button"
              id="demo-btn-netloss"
              onClick={handleNetworkLoss}
              className="flex items-start gap-3 bg-gray-800 hover:bg-gray-700 border border-gray-700 rounded-xl px-4 py-3.5 text-left transition-all active:scale-[0.97]"
            >
              <span className="text-xl pt-0.5">📡</span>
              <div>
                <p className="text-sm font-bold text-white">Network loss (30 s)</p>
                <p className="text-[11px] text-gray-400 mt-0.5">Pauses BUS-01 broadcasts → student sees dead-reckoning &amp; faded bus</p>
              </div>
            </button>

            {/* 5. Speed x3 — full width */}
            <button
              type="button"
              id="demo-btn-speed"
              onClick={handleSpeedToggle}
              className={`sm:col-span-2 flex items-center gap-3 rounded-xl px-4 py-3.5 text-left transition-all active:scale-[0.97] border ${
                isSpeedX3
                  ? "bg-indigo-600/30 border-indigo-500/60 hover:bg-indigo-600/50"
                  : "bg-gray-800 border-gray-700 hover:bg-gray-700"
              }`}
            >
              <span className="text-xl">⚡</span>
              <div className="flex-1">
                <p className={`text-sm font-bold ${isSpeedX3 ? "text-indigo-200" : "text-white"}`}>
                  Speed ×3 — {isSpeedX3 ? "ON" : "OFF"}
                </p>
                <p className={`text-[11px] mt-0.5 ${isSpeedX3 ? "text-indigo-400/80" : "text-gray-400"}`}>
                  Makes demo buses move 3× faster — no waiting during live demo
                </p>
              </div>
              <span className={`text-xs font-bold px-2.5 py-1 rounded-full border shrink-0 ${
                isSpeedX3
                  ? "bg-indigo-600 border-indigo-400 text-white"
                  : "bg-gray-700 border-gray-600 text-gray-400"
              }`}>
                {isSpeedX3 ? "ON" : "OFF"}
              </span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
