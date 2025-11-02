import { NextResponse } from "next/server";
import { userService } from "@/services/userService";

export async function GET(
  request: Request,
  { params }: { params: { id: string } }
) {
  const id = parseInt(params.id);

  // Validate the ID
  if (isNaN(id)) {
    return NextResponse.json({ error: "Invalid user ID" }, { status: 400 });
  }

  const result = await userService.getUserById(id);

  if (result.success) {
    if (result.data) {
      return NextResponse.json(result.data);
    } else {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }
  } else {
    return NextResponse.json({ error: result.error }, { status: 500 });
  }
}

// TODO: Add other HTTP methods
export async function DELETE(
  request: Request,
  { params }: { params: { id: string } }
) {
  const id = parseInt(params.id);

  if (isNaN(id)) {
    return NextResponse.json({ error: "Invalid user ID" }, { status: 400 });
  }

  // TODO: Add delete logic to userService
  return NextResponse.json({ message: "User deleted successfully" });
}
