"use client";

import { useEffect, useState, useCallback } from "react";
import { createClient } from "@/database/supabase/client";
import type { User } from "@supabase/supabase-js";

const supabase = createClient();

export function useSupabaseAuth() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;

    async function getUser() {
      try {
        const {
          data: { user: currentUser },
        } = await supabase.auth.getUser();

        if (!mounted) return;
        setUser(currentUser ?? null);
      } catch (err) {
        if (!mounted) return;
        setUser(null);
      } finally {
        if (!mounted) return;
        setLoading(false);
      }
    }

    getUser();

    const { data: listener } = supabase.auth.onAuthStateChange((_, session) => {
      // session?.user is the current user when signed in
      setUser(session?.user ?? null);
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
  }, []);

  return {
    user,
    loading,
    isLoggedIn: Boolean(user),
    signOut,
  } as const;
}
