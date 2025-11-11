import "server-only"

import { createClient } from "@/database/supabase/server";

export async function getSignedInUser() {
  const supabase = await createClient();
  const { 
    data: { user },
    error,
  } = await supabase.auth.getUser();

	return {data: { user }, error}
} 
