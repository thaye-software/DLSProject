import { NextResponse } from "next/server";
import { userService } from "@/services/userService";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const email = url.searchParams.get("email");

  if (!email) {
    return NextResponse.json(
      { error: "Email query parameter is required" },
      { status: 400 }
    );
  }

  const result = await userService.getUserByEmail(email);

  if (!result.success) {
    return NextResponse.json({ error: result.error }, { status: 500 });
  }

  if (!result.data) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  return NextResponse.json({ avatarUrl: result.data.avatarUrl ?? null });
}
