import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL ?? import.meta.env.EXPO_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY ?? import.meta.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
export const supabaseInitError = !supabaseUrl || !supabaseAnonKey
  ? new Error("[supabase] Missing URL or anon key. Check VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY env vars.")
  : null;

if (supabaseInitError) {
  // eslint-disable-next-line no-console
  console.error(supabaseInitError.message);
}

export const supabase = supabaseInitError
  ? (new Proxy(
      {},
      {
        get() {
          throw supabaseInitError;
        },
      }
    ) as unknown) as SupabaseClient<Database>
  : createClient<Database>(supabaseUrl, supabaseAnonKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
        flowType: "implicit",
      },
    });

export const SUPABASE_URL = supabaseUrl ?? "";
