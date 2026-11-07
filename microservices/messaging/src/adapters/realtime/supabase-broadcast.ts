import { messageJson } from "../http/chat-json.js";
import type { ChatBroadcaster } from "../../application/ports/chat-broadcaster.js";
import type { Message } from "../../domain/chat.js";

const REQUEST_TIMEOUT_MS = 5000;

export type SupabaseBroadcastOptions = {
  url: string;
  secretKey: string;
  fetchImpl?: typeof fetch;
};

export class SupabaseBroadcast implements ChatBroadcaster {
  private readonly endpoint: URL;
  private readonly secretKey: string;
  private readonly fetchImpl: typeof fetch;

  constructor({ url, secretKey, fetchImpl = fetch }: SupabaseBroadcastOptions) {
    const base = new URL(url.endsWith("/") ? url : `${url}/`);
    this.endpoint = new URL("realtime/v1/api/broadcast", base);
    this.secretKey = secretKey;
    this.fetchImpl = fetchImpl;
  }

  async messageCreated(message: Message): Promise<void> {
    const response = await this.fetchImpl(this.endpoint, {
      method: "POST",
      headers: {
        apikey: this.secretKey,
        authorization: `Bearer ${this.secretKey}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        messages: [
          {
            topic: `conversation:${message.conversationId}`,
            event: "message_created",
            payload: messageJson(message),
          },
        ],
      }),
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });

    if (!response.ok) {
      throw new Error(`Supabase Realtime answered ${response.status} broadcasting message ${message.messageId}`);
    }
  }
}
