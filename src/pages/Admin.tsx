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
import { BUS_ID } from "../data/route";
import {
  supabase,
  isSupabaseConfigured,
  type BusRow,
  type CrowdLevel,
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
      updated_at: new Date().toISOString(),
    },
  ]);

  const [tripLogs, setTripLogs] = useState<TripLogRow[]>(SAMPLE_TRIP_LOGS);
  const [isUsingSupabaseLogs, setIsUsingSupabaseLogs] = useState<boolean>(false);

  // Compute metrics from current tripLogs (Supabase or local sample fallback)
  const metrics = computeTripLogMetrics(tripLogs);

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

    return () => {
      supabase?.removeChannel(busesChannel);
    };
  }, []);

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
    <div className="flex-1 w-full max-w-6xl mx-auto p-4 sm:p-6 space-y-6">
      {/* Header with Source Badge */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
            Transport Admin Dashboard
          </h1>
          <p className="text-gray-400 text-xs sm:text-sm mt-0.5">
            Operational analytics, stop delays, and crowd management for City Route 1.
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

      {/* Live Buses Card (Updates Realtime from 'buses' table) */}
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

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {buses.map((bus) => {
            const badge = crowdStyles[bus.crowd_level] || crowdStyles.seats;
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
                  </div>
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
                    {bus.is_active ? "Active" : "Off Duty"}
                  </span>
                </div>

                <div className="flex items-center justify-between pt-2 border-t border-gray-800/80 text-xs">
                  <span className="text-gray-400">Crowd Level:</span>
                  <span
                    className={`px-2 py-0.5 rounded-full border ${badge.bg} ${badge.border} ${badge.text} font-semibold text-[11px] flex items-center gap-1.5`}
                  >
                    <span className="w-1.5 h-1.5 rounded-full bg-current"></span>
                    <span>{badge.label}</span>
                  </span>
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
    </div>
  );
}
