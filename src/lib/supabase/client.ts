import { createBrowserClient } from "@supabase/ssr";
import { DB_SCHEMA, supabaseEnv } from "./env";

export function createClient() {
  const { url, key } = supabaseEnv();
  return createBrowserClient(url, key, { db: { schema: DB_SCHEMA } });
}
