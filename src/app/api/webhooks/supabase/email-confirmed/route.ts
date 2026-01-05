import { NextRequest, NextResponse } from "next/server";
import { db } from "@/database/drizzle";
import { users } from "@/database/schema";
import { eq } from "drizzle-orm";



export async function POST(request: NextRequest) {

  try {
    console.log("Received Supabase email change confirmed webhook");
    const payload = await validateSupabaseWebhookCall(request);

    const newEmail = payload.record.email_change;
    const oldEmail = payload.old_record.email;
    const userId = payload.record.id;


    if (newEmail === oldEmail) {
      throw new Error(`(server) detected no changes to the email`);
    }

    const updatedLimitedWatchesUser = await db
      .update(users)
      .set({email: newEmail})
      .where(eq(users.id, userId))
      .returning();

    if (updatedLimitedWatchesUser.length === 0) {
      console.error(`User ${userId} not found in database`);
      return NextResponse.json(
        { error: "User not found" },
        { status: 404 }
      );
    }

    return NextResponse.json({
      message: "Email synced successfully",
      data: updatedLimitedWatchesUser
    });


  } catch (error) {
    console.error("Webhook processing error:", error);
    return NextResponse.json(
      { error: "Internal server erroræøå", message: (error as Error).message },
      { status: 500 }
    );
  }
}



//-------------------------------------------- helper function --------------------------------------------

async function validateSupabaseWebhookCall(request: NextRequest) {

  const env = process.env.APP_ENV!.toLowerCase();
  const webhookSecret = env == "prod" ? process.env.SUPABASE_WEBHOOK_SECRET_PROD! : env == "dev" ? process.env.SUPABASE_WEBHOOK_SECRET_DEV! : process.env.SUPABASE_WEBHOOK_SECRET_LOCAL!
  if (!webhookSecret) {
    console.error("SUPABASE_WEBHOOK_SECRET not configured");
    throw new Error("SUPABASE_WEBHOOK_SECRET not configured");
  }
    
  const incomingSecret = request.headers.get("x-supabasewebhook-secret");
  if (incomingSecret !== webhookSecret) {
    throw new Error("Unauthorized: Invalid webhook secret. Status: 401");
  }

  const payload = await request.json();
  console.log("Received Supabase webhook payload:", payload);
  if (payload.type !== "UPDATE" || payload.table !== "users") {
    throw new Error(`(server) unexpected error, reciveced webhook call from supabase, even though either no UPDATE or table that triggered was not users table`)
  }

  return payload;
}