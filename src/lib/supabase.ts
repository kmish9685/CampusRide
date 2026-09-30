import { createClient, SupabaseClient } from "@supabase/supabase-js";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

export const isSupabaseConfigured = Boolean(
  supabaseUrl &&
  supabaseAnonKey &&
  supabaseUrl.startsWith("http") &&
  supabaseAnonKey.length > 20
);

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export let supabase: SupabaseClient<any, "public", any> | null = null;

if (isSupabaseConfigured) {
  supabase = createClient(supabaseUrl!, supabaseAnonKey!, {
    realtime: {
      params: {
        eventsPerSecond: 10,
      },
    },
  });
}

export type CrowdLevel = "seats" | "standing" | "full";
export type BusStatus = "on_time" | "delayed" | "breakdown";
export type CrowdSource = "auto" | "manual";

export interface BusRow {
  id: string;
  name: string;
  route_name: string;
  lat: number;
  lng: number;
  crowd_level: CrowdLevel;
  is_active: boolean;
  capacity?: number;
  occupancy?: number;
  status?: BusStatus;
  crowd_source?: CrowdSource;
  updated_at: string;
}

export interface StopWait {
  id: string;
  bus_id: string;
  stop_name: string;
  device_id?: string;
  created_at: string;
}

/**
 * Automatically compute crowd level from occupancy and capacity.
 * < 70% -> seats, 70-95% -> standing, > 95% -> full
 */
export function computeAutoCrowd(occupancy: number, capacity = 50): CrowdLevel {
  const ratio = occupancy / capacity;
  if (ratio < 0.7) return "seats";
  if (ratio <= 0.95) return "standing";
  return "full";
}

/**
 * Upsert bus record. Guarantees bus is created if missing, and updated otherwise.
 */
export async function upsertBus(payload: Partial<BusRow> & { id: string }) {
  if (!supabase) return { data: null, error: new Error("Supabase is not configured") };
  return supabase.from("buses").upsert(
    {
      name: payload.id === "BUS-02" ? "Campus Shuttle 2" : "Campus Express",
      route_name: "City Route 1",
      capacity: 50,
      status: "on_time",
      crowd_source: "auto",
      updated_at: new Date().toISOString(),
      ...payload,
    },
    { onConflict: "id" }
  );
}

/**
 * Fetch active student waits within last 20 minutes.
 */
export async function fetchActiveWaits(busId = "BUS-01") {
  if (!supabase) return { data: [] as StopWait[], error: null };
  const cutoff = new Date(Date.now() - 20 * 60 * 1000).toISOString();
  return supabase
    .from("stop_waits")
    .select("*")
    .eq("bus_id", busId)
    .gte("created_at", cutoff);
}

/**
 * Mark student as waiting at a stop.
 */
export async function markStopWait(waitId: string, stopName: string, deviceId = "", busId = "BUS-01") {
  if (!supabase) return { data: null, error: new Error("Supabase is not configured") };
  return supabase.from("stop_waits").upsert({
    id: waitId,
    bus_id: busId,
    stop_name: stopName,
    device_id: deviceId,
    created_at: new Date().toISOString(),
  });
}

/**
 * Cancel student wait.
 */
export async function cancelStopWait(waitId: string) {
  if (!supabase) return { data: null, error: new Error("Supabase is not configured") };
  return supabase.from("stop_waits").delete().eq("id", waitId);
}

/**
 * Clear waits for a specific stop when the bus picks up students.
 */
export async function clearWaitsForStop(stopName: string, busId = "BUS-01") {
  if (!supabase) return { data: null, error: new Error("Supabase is not configured") };
  return supabase.from("stop_waits").delete().eq("bus_id", busId).eq("stop_name", stopName);
}

/**
 * Shared Realtime Demo Channel for instant multi-page demo control synchronization
 */
export const demoChannel = supabase
  ? supabase.channel("campusride-demo-sync", {
      config: { broadcast: { self: true } },
    })
  : null;

if (demoChannel) {
  demoChannel.subscribe((status) => {
    console.log("[CampusRide Demo Channel Status]:", status);
  });
}

/**
 * Broadcast demo control event via both Supabase Realtime & localStorage (for same-browser tabs)
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function broadcastDemoEvent(event: string, payload: any = {}) {
  if (demoChannel) {
    demoChannel.send({
      type: "broadcast",
      event,
      payload,
    });
  }

  try {
    localStorage.setItem(
      "campusride_demo_event",
      JSON.stringify({ event, payload, timestamp: Date.now() })
    );
  } catch (e) {
    console.warn("localStorage demo event error:", e);
  }
}

