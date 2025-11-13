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

// export async function POST(request: Request) {
//   const body = await request.json();
//   const { username, email, password } = body;

//   if (!username || !email || !password) {
//     return NextResponse.json(
//       { error: "Username, email, and password are required" },
//       { status: 400 }
//     );
//   }

//   const result = await userService.createUser({ id, username, email });

//   if (result.success) {
//     return NextResponse.json(result.data, { status: 201 });
//   } else {
//     return NextResponse.json({ error: result.error }, { status: 500 });
//   }
// }
