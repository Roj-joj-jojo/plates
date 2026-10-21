import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { getSupabaseConfig } from "./config";

// Use only in Route Handlers or Server Actions, where cookies are writable.
// Server Component reads and session refresh need their own integration next.
export async function createActionClient() {
  const { url, publishableKey } = getSupabaseConfig();
  const cookieStore = await cookies();

  return createServerClient(url, publishableKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value, options }) => {
          cookieStore.set(name, value, options);
        });
      },
    },
  });
}

// Server Components can read cookies; the Proxy refreshes sessions and writes
// updated cookies before these components run.
export async function createReadClient() {
  const { url, publishableKey } = getSupabaseConfig();
  const cookieStore = await cookies();

  return createServerClient(url, publishableKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll() {
        // Server Components cannot write cookies.
      },
    },
  });
}
