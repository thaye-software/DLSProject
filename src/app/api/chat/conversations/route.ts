import { NextResponse } from "next/server";
import { createClient } from "@/database/supabase/server";
import { db } from "@/database/drizzle";
import { conversationService } from "@/services/conversationService";
import { userService } from "@/services/userService";

export async function GET() {
  try {
    const supabase = await createClient();
    console.log("Fetching conversations");

    const {
      data: { user },
      error: userErr,
    } = await supabase.auth.getUser();
    console.log("Supabase auth user:", user);
    
    

    if (userErr || !user || !user.id || !user.email) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    const tempUser = await userService.getUserByEmail(user.email)

    const data = await conversationService.getConversationsByCustomerId(parseInt(tempUser.data.id));

    if (!data) {
      return NextResponse.json({ error: "Failed to fetch conversations" }, { status: 500 });
    }

    return NextResponse.json({ conversations: data ?? [] });
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message ?? String(err) },
      { status: 500 }
    );
  }
}
