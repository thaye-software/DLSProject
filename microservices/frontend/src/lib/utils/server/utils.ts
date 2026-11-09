import "server-only";

import { createClient } from "@/lib/supabase/server";

export async function getAuthUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { user: null, loading: false, role: null, username: null };
  }

  const username = user.user_metadata?.display_name || null;
  const role = user.app_metadata?.role === "admin" ? "admin" : "customer";

  return { user, loading: false, role, username };
}
