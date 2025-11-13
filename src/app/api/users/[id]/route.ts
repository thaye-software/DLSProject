import { NextResponse, NextRequest } from "next/server";
import { userService } from "@/services/userService";

async function resolveParams(params: any) {
  // Some Next versions/types provide params as a Promise, others as a plain object.
  if (!params) return {};
  if (typeof params.then === "function") {
    return await params;
  }
  return params;
}

export async function GET(request: NextRequest, context: { params?: any }) {
  const params = await resolveParams(context.params);
  const id = params.id;

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
export async function DELETE(request: NextRequest, context: { params?: any }) {
  const params = await resolveParams(context.params);
  const id = parseInt(params.id);

  if (isNaN(id)) {
    return NextResponse.json({ error: "Invalid user ID" }, { status: 400 });
  }

  // TODO: Add delete logic to userService
  return NextResponse.json({ message: "User deleted successfully" });
}
