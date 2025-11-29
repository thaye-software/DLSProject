import { useAuthContext } from "@/context/AuthContext";

export function useSupabaseAuth() {
  return useAuthContext();
}