// import { NextResponse } from "next/server";
// import { createClient } from "@/database/supabase/server";
// import { db } from "@/database/drizzle";
// import { userService } from "@/services/userService";
// import { getAllConversations, getConversationsByCustomerId } from "@/services/conversationService";

// export async function GET() {
//   try {
//     const supabase = await createClient();

//     const {
//       data: { user },
//       error: userErr,
//     } = await supabase.auth.getUser();

//     if (userErr || !user || !user.id || !user.email) {
//       return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
//     }

//     const tempUser = await userService.getUserByEmail(user.email)
//     if (!tempUser.success || !tempUser.data) {
//       return NextResponse.json({ error: "User not found" }, { status: 404 });
//     }
//     let data;

//     if (tempUser.data?.role === 'admin') {
//       data = await getAllConversations();
//     } else {
//       data = await getConversationsByCustomerId(tempUser.data.id);
//     }

//     if (!data) {
//       return NextResponse.json({ error: "Failed to fetch conversations" }, { status: 500 });
//     }

//     return NextResponse.json({ conversations: data ?? [] });
//   } catch (err: any) {
//     return NextResponse.json(
//       { error: err.message ?? String(err) },
//       { status: 500 }
//     );
//   }
// }
