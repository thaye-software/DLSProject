"use client";

import { createContext, useContext, useEffect, useState, useCallback, ReactNode } from "react";
import { createClient } from "@/lib/supabase/client";
import type { User } from "@supabase/supabase-js";

interface AuthContextType {
  user: User | null;
  username: string | null;
  role: string | null;
  loading: boolean;
  isLoggedIn: boolean;
  signOut: () => Promise<void>;
  refreshUser: () => Promise<void>;
}

const SupabaseAuthContext = createContext<AuthContextType | undefined>(undefined);
const supabase = createClient();

export function SupabaseAuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [username, setUsername] = useState<string | null>(null);
  const [role, setRole] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  
//---------- helper funciton -------------
  const fetchUserData = useCallback(async (currentUser: User | null) => {
    try {
      if (!currentUser) {
        setUser(null);
        setUsername(null);
        setRole(null);
        return;
      }

      setUser(currentUser);
      setUsername(currentUser.user_metadata?.display_name ?? null);


      setRole(currentUser.app_metadata?.role === "admin" ? "admin" : "customer");
    } catch (error) {
      console.error("Error fetching user data:", error);
    }
  }, []);

  const refreshUser = useCallback(async () => {
    // Force a session refresh to get the latest metadata (like display_name)
    const { data: { session }, error } = await supabase.auth.refreshSession();
    if(error) {
      throw error;
    }
    if (session?.user) {
      await fetchUserData(session.user);
    }
  }, [fetchUserData]);

  useEffect(() => {
    let mounted = true;

    async function initialize() {
      try {
        const { data: { user: currentUser } } = await supabase.auth.getUser();
        if (mounted) await fetchUserData(currentUser);
      } catch (err) {
        console.error(err);
      } finally {
        if (mounted) setLoading(false);
      }
    }

    initialize();
    
    // Listen for auth state changes
    const { data: listener } = supabase.auth.onAuthStateChange(async (event: any, session: any) => {
      // Standard auth change
      if (mounted) {
        await fetchUserData(session?.user ?? null);
      }
    });

    return () => {
      mounted = false;
      listener?.subscription.unsubscribe();
    };
  }, [fetchUserData]);

  const signOut = useCallback(async () => {
    await supabase.auth.signOut();
    setUser(null);
    setRole(null);
    setUsername(null);
  }, []);



  const value = {
    user,
    username,
    role,
    loading,
    isLoggedIn: !!user,
    signOut,
    refreshUser
  };

  return <SupabaseAuthContext.Provider value={value}>{children}</SupabaseAuthContext.Provider>;
}



export function useSupabaseAuthContext() {
  const context = useContext(SupabaseAuthContext);
  if (context === undefined) {
    throw new Error("useAuthContext must be used within an AuthProvider");
  }
  return context;
}
