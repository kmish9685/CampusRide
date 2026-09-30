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
