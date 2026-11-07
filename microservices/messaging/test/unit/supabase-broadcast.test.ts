import { describe, expect, it, vi } from "vitest";
import { messageJson } from "../../src/adapters/http/chat-json.js";
import { SupabaseBroadcast } from "../../src/adapters/realtime/supabase-broadcast.js";
import { message } from "../fixtures/chat.js";

describe("SupabaseBroadcast", () => {
  it("POSTs message_created to the Broadcast REST API", async () => {
    const fetchImpl = vi.fn(async () => new Response(null, { status: 202 }));
    const broadcaster = new SupabaseBroadcast({
      url: "http://localhost:54321",
      secretKey: "service-role",
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });

    await broadcaster.messageCreated(message());

    expect(fetchImpl).toHaveBeenCalledWith(
      new URL("http://localhost:54321/realtime/v1/api/broadcast"),
      expect.objectContaining({
        method: "POST",
        headers: {
          apikey: "service-role",
          authorization: "Bearer service-role",
          "content-type": "application/json",
        },
      }),
    );
    const [, init] = fetchImpl.mock.calls[0] as unknown as [URL, RequestInit];
    const body = JSON.parse(init.body as string);
    expect(body).toEqual({
      messages: [
        {
          topic: `conversation:${message().conversationId}`,
          event: "message_created",
          payload: messageJson(message()),
        },
      ],
    });
  });

  it("throws when Realtime answers an error", async () => {
    const broadcaster = new SupabaseBroadcast({
      url: "http://localhost:54321",
      secretKey: "service-role",
      fetchImpl: vi.fn(async () => new Response("nope", { status: 500 })) as unknown as typeof fetch,
    });

    await expect(broadcaster.messageCreated(message())).rejects.toThrow(/500/);
  });
});
