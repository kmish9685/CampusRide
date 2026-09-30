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

export interface BusRow {
  id: string;
  name: string;
  route_name: string;
  lat: number;
  lng: number;
  crowd_level: CrowdLevel;
  is_active: boolean;
  updated_at: string;
}

export interface StopWait {
  id: string;
  bus_id: string;
  stop_name: string;
  created_at: string;
}

/**
 * Upsert bus record. Guarantees BUS-01 is created if missing, and updated otherwise.
 */
export async function upsertBus(payload: Partial<BusRow> & { id: string }) {
  if (!supabase) return { data: null, error: new Error("Supabase is not configured") };
  return supabase.from("buses").upsert(
    {
      name: "Campus Express",
      route_name: "City Route 1",
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
export async function markStopWait(waitId: string, stopName: string, busId = "BUS-01") {
  if (!supabase) return { data: null, error: new Error("Supabase is not configured") };
  return supabase.from("stop_waits").upsert({
    id: waitId,
    bus_id: busId,
    stop_name: stopName,
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
