import { useSupabaseAuthContext } from "@/context/SupabaseAuthContext";

export function useSupabaseAuth() {
  return useSupabaseAuthContext();
}