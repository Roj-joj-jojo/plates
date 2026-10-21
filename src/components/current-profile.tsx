"use client";

import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { usePathname } from "next/navigation";
import { createClient } from "@/lib/supabase/browser";
import { isSupabaseConfigured } from "@/lib/supabase/config";

type CurrentProfile = { id: string; name: string; username: string | null; url: string | null };
const ProfileContext = createContext<CurrentProfile | null>(null);
export function useCurrentProfile() { return useContext(ProfileContext); }

export function CurrentProfileProvider({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const [profile, setProfile] = useState<CurrentProfile | null>(null);
  const authId = useRef<string | null>(null);
  const signedPicture = useRef<{ profileId: string; path: string; url: string; renewAt: number } | null>(null);
  useEffect(() => {
    if (!isSupabaseConfigured()) return;
    const client = createClient();
    let disposed = false, revision = 0;
    async function load() {
      if (disposed) return;
      const current = ++revision;
      const { data, error } = await client.from("my_profile").select("id,display_name").maybeSingle();
      if (disposed || current !== revision) return;
      if (error || !data) { signedPicture.current = null; setProfile(null); return; }
      // Never keep another account's avatar during a session change.
      setProfile(previous => previous?.id === data.id ? previous : null);
      const [username, location] = await Promise.all([
        client.rpc("my_username"), client.rpc("picture_locations", { p_kind: "profile", p_ids: [data.id] }),
      ]);
      let url: string | null = null;
      const path = location.data?.[0]?.object_path;
      if (!location.error && path) {
        // Recheck access/location on every load; reuse only this account's still-fresh URL.
        const previous = signedPicture.current;
        if (previous && previous.profileId === data.id && previous.path === path && previous.renewAt > Date.now()) url = previous.url;
        else {
          const signed = await client.storage.from("plate-media").createSignedUrl(path, 300);
          if (!disposed && current === revision && !signed.error) {
            url = signed.data.signedUrl;
            signedPicture.current = { profileId: data.id, path, url, renewAt: Date.now() + 240_000 };
          }
        }
      } else if (!disposed && current === revision) signedPicture.current = null;
      if (!disposed && current === revision) setProfile({ id: data.id, name: data.display_name ?? "You", username: username.error ? null : username.data, url });
    }
    const changed = () => {
      const expected = revision + 1;
      void load().catch(() => { if (!disposed && expected === revision) { signedPicture.current = null; setProfile(null); } });
    };
    const visible = () => { if (document.visibilityState === "visible") changed(); };
    const { data: subscription } = client.auth.onAuthStateChange((event, session) => {
      // Queue work outside the Auth callback's internal lock.
      const nextId = session?.user.id ?? null;
      if (event === "SIGNED_OUT" || nextId !== authId.current) {
        ++revision; authId.current = nextId; signedPicture.current = null; setProfile(null);
      }
      if (event !== "SIGNED_OUT") queueMicrotask(changed);
    });
    changed();
    window.addEventListener("plates:profile-changed", changed);
    window.addEventListener("plates:mentions-changed", changed);
    document.addEventListener("visibilitychange", visible);
    const timer = window.setInterval(visible, 60_000);
    return () => {
      disposed = true; ++revision; subscription.subscription.unsubscribe(); window.clearInterval(timer);
      window.removeEventListener("plates:profile-changed", changed);
      window.removeEventListener("plates:mentions-changed", changed);
      document.removeEventListener("visibilitychange", visible);
    };
  }, [pathname]);
  return <ProfileContext value={profile}>{children}</ProfileContext>;
}
