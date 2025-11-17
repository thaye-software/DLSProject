"use client";

import { useEffect, useState, useCallback } from "react";
import { createClient } from "@/database/supabase/client";
import type { User } from "@supabase/supabase-js";
import { getUserById } from "@/services/userService";

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
        const { data: { user: currentUser } } = await supabase.auth.getUser();
        console.log("Supabase current user:", currentUser);
        const dbUser = await getUserById(currentUser?.id || "");

        if (!mounted) return;
        setUser(currentUser ?? null);
        setUsername(currentUser?.user_metadata?.display_name ?? null);
        // fetch role and avatar from server (secure lookup in our users table)
        if (dbUser && !('error' in dbUser)) {
          setRole(dbUser.role);
          setAvatarUrl(dbUser.avatarUrl || null);
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

    // Listen for auth state changes
    const { data: listener } = supabase.auth.onAuthStateChange(async (_, session) => {
      // session?.user is the current user when signed in
      const newUser = session?.user ?? null;
      setUser(newUser);
      setUsername(newUser?.user_metadata?.display_name ?? null);
      console.log("Supabase auth state changed, new user:", newUser);
      const dbUser = await getUserById(newUser?.id || "");
      if (dbUser && !('error' in dbUser)) {
        setRole(dbUser.role);
        setAvatarUrl(dbUser.avatarUrl || null);
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
    setRole(null);
    setUsername(null);
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
