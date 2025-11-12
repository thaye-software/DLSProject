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

  try {
    const costumer = await userService.getUserByEmail(user.email);
    if (!costumer) {
     return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    return NextResponse.json({
      username: costumer.username,
      role: costumer.role,
      avatarUrl: costumer.avatarUrl ?? null,
    });

  }catch(error) {
    return NextResponse.json({ error }, { status: 500 });
  }
}
