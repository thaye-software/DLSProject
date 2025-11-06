import { NextResponse } from "next/server";
import { createClient } from "@/database/supabase/server";
import { userService } from "@/services/userService";

export async function GET(request: Request) {
  const supabase = await createClient();

  // Validate session and get the authenticated user's email
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user || !user.email) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const result = await userService.getUserByEmail(user.email);

  if (!result.success) {
    return NextResponse.json({ error: result.error }, { status: 500 });
  }

  if (!result.data) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  return NextResponse.json({
    username: result.data.username,
    role: result.data.role,
    avatarUrl: result.data.avatarUrl ?? null,
  });
}
