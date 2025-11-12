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

  try {
    const costumer = await userService.getUserByEmail(email);
    if(!costumer) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    return NextResponse.json({ avatarUrl: costumer.avatarUrl ?? null });

  } catch (error) {
    return NextResponse.json({ error }, { status: 500 });
  }
}
