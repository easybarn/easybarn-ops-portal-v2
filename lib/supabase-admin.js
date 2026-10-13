import "server-only";
import { createClient } from "@supabase/supabase-js";

// Service client using the secret key. Bypasses row-level security, so only
// call it from server code AFTER confirming the caller is an admin.
export function createAdminClient() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SECRET_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
