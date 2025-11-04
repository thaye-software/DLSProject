import { NextResponse } from "next/server";
import { userService } from "@/services/userService";

export async function GET(
  request: Request,
  { params }: { params: { id: number } }
) {
  const id = params.id;

  if (!id) {
    return NextResponse.json({ error: "Invalid id" }, { status: 400 });
  }

  const result = await userService.getUserById(id);

  if (!result.success) {
    return NextResponse.json({ error: result.error }, { status: 500 });
  }

  if (!result.data) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  // Return only avatarUrl
  return NextResponse.json({ avatarUrl: result.data.avatarUrl ?? null });
}
