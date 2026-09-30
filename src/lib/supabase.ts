import { createClient, SupabaseClient } from "@supabase/supabase-js";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

export const isSupabaseConfigured = Boolean(supabaseUrl && supabaseAnonKey);

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export let supabase: SupabaseClient<any, "public", any> | null = null;

if (isSupabaseConfigured) {
  supabase = createClient(supabaseUrl!, supabaseAnonKey!);
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
