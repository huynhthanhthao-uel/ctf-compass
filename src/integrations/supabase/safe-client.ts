import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";

export type TypedSupabaseClient = SupabaseClient<Database>;

let cachedClient: TypedSupabaseClient | null = null;

export function isSupabaseConfigured(): boolean {
  return Boolean(
    import.meta.env.VITE_SUPABASE_URL &&
      import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY
  );
}

/**
 * Lazy-load the Supabase client.
 *
 * Important: do NOT import "@/integrations/supabase/client" at module load time,
 * otherwise self-hosted deployments without VITE_SUPABASE_URL will crash.
 */
export async function getSupabaseClient(): Promise<TypedSupabaseClient | null> {
  if (!isSupabaseConfigured()) return null;
  if (cachedClient) return cachedClient;

  try {
    const mod = await import("./client");
    cachedClient = mod.supabase as TypedSupabaseClient;
    return cachedClient;
  } catch (err) {
    console.warn("[supabase] Client unavailable:", err);
    return null;
  }
}
