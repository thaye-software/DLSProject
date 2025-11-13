"use client";

import { useEffect, useState, useCallback } from "react";
import { createClient } from "@/database/supabase/client";
import type { User } from "@supabase/supabase-js";

const supabase = createClient();

export function useSupabaseAuth() {
  const [user, setUser] = useState<User | null>(null);
  const [username, setUsername] = useState<string | null>(null);
  const [role, setRole] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(() => {
    if (typeof window === "undefined") return null;
    return localStorage.getItem("avatarUrl");
  });

  useEffect(() => {
    let mounted = true;

    async function getUser() {
      try {
        const {
          data: { user: currentUser },
        } = await supabase.auth.getUser();

        if (!mounted) return;
        setUser(currentUser ?? null);
        setUsername(currentUser?.user_metadata?.display_name ?? null);
        // fetch avatar and cache it client-side
        if (currentUser?.email && typeof window !== "undefined") {
          void fetch(
            `/api/users/avatar?email=${encodeURIComponent(currentUser.email)}`
          )
            .then((r) => (r.ok ? r.json() : null))
            .then((data) => {
              if (!mounted) return;
              const url = data?.avatarUrl ?? null;
              setAvatarUrl(url);
              try {
                if (url) localStorage.setItem("avatarUrl", url);
                else localStorage.removeItem("avatarUrl");
              } catch {}
            })
            .catch(() => {
              if (!mounted) return;
              setAvatarUrl(null);
            });
        }
        // fetch profile including role from server (secure lookup in our users table)
        if (currentUser?.email) {
          void fetch(`/api/auth/me`)
            .then((r) => (r.ok ? r.json() : null))
            .then((profile) => {
              if (!mounted) return;
              setRole(profile?.role ?? null);
            })
            .catch(() => {
              if (!mounted) return;
              setRole(null);
            });
        }
      } catch (err) {
        if (!mounted) return;
        setUser(null);
      } finally {
        if (!mounted) return;
        setLoading(false);
      }
    }
    getUser();

    // role will be fetched after the user is known above

    const { data: listener } = supabase.auth.onAuthStateChange((_, session) => {
      // session?.user is the current user when signed in
      const newUser = session?.user ?? null;
      setUser(newUser);
      if (newUser?.email && typeof window !== "undefined") {
        void fetch(
          `/api/users/avatar?email=${encodeURIComponent(newUser.email)}`
        )
          .then((r) => (r.ok ? r.json() : null))
          .then((data) => {
            const url = data?.avatarUrl ?? null;
            setAvatarUrl(url);
            try {
              if (url) localStorage.setItem("avatarUrl", url);
              else localStorage.removeItem("avatarUrl");
            } catch {}
          })
          .catch(() => {
            setAvatarUrl(null);
          });
      } else {
        setAvatarUrl(null);
        try {
          if (typeof window !== "undefined")
            localStorage.removeItem("avatarUrl");
        } catch {}
      }
    });

    return () => {
      mounted = false;
      try {
        listener?.subscription.unsubscribe();
      } catch {}
    };
  }, []);

  const signOut = useCallback(async () => {
    await supabase.auth.signOut();
    setUser(null);
    setAvatarUrl(null);
    try {
      if (typeof window !== "undefined") localStorage.removeItem("avatarUrl");
    } catch {}
  }, []);

  return {
    user,
    username,
    role,
    loading,
    avatarUrl,
    isLoggedIn: Boolean(user),
    signOut,
  } as const;
}
