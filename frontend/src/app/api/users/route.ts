import { NextResponse } from "next/server";
import { userService } from "@/services/userService";

export async function GET() {
  const result = await userService.getAllUsers();

  if (result.success) {
    return NextResponse.json(result.data);
  } else {
    return NextResponse.json({ error: result.error }, { status: 500 });
  }
}
