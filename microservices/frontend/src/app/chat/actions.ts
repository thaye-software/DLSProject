"use server";

import { withLoginRedirect } from "@/lib/gateway";
import { problemMessage } from "@/lib/problemMessage";
import * as svc from "@/services/conversationService";

// Server action errors are masked in production, so failures come back as data.
// redirect("/login") from withLoginRedirect is not caught here: it must propagate.
export type Result<T> = { ok: true; data: T } | { ok: false; error: string };

async function run<T>(label: string, call: () => Promise<T>): Promise<Result<T>> {
  try {
    return { ok: true, data: await withLoginRedirect(call) };
  } catch (e) {
    if (e instanceof Error && (e as { digest?: string }).digest?.startsWith("NEXT_REDIRECT")) throw e;
    return { ok: false, error: problemMessage(e, "Chat is unavailable right now. Please try again.", label) };
  }
}

export async function openConversation(productId: string) {
  return run("openConversation failed", () => svc.openConversation(productId));
}
export async function listConversations() {
  return run("listConversations failed", () => svc.listConversations());
}
export async function listMessages(id: string, before?: string) {
  return run("listMessages failed", () => svc.listMessages(id, before));
}
export async function sendMessage(id: string, body: string, key: string) {
  return run("sendMessage failed", () => svc.sendMessage(id, body, key));
}
export async function markRead(id: string) {
  return run("markRead failed", () => svc.markRead(id));
}
