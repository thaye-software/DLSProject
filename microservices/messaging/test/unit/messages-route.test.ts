import { describe, expect, it, vi } from "vitest";
import { encodeCursor } from "../../src/domain/chat.js";
import { CONVERSATION_ID, USER_ID, message } from "../fixtures/chat.js";
import { contractSchema } from "../support/contract.js";
import { serve } from "../support/serve.js";

const gatewayHeaders = { "x-user-id": USER_ID };

function expectProblem(json: unknown, code: string) {
  expect((json as { type: string }).type).toBe(`https://limitedwatches.dk/problems/${code}`);
}

describe("GET /conversations/{id}/messages", () => {
  it("answers 200 with a MessagePage that matches the contract", async () => {
    const listMessages = vi.fn(async () => ({ outcome: "ok" as const, page: { items: [message()], nextCursor: null } }));
    const baseUrl = await serve({ listMessages });

    const response = await fetch(`${baseUrl}/conversations/${CONVERSATION_ID}/messages?limit=50`, { headers: gatewayHeaders });
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(contractSchema("MessagePage")(json), JSON.stringify(contractSchema("MessagePage").errors)).toBe(true);
    expect(json.next_cursor).toBeNull();
    expect(listMessages).toHaveBeenCalledWith(expect.objectContaining({ userId: USER_ID }), CONVERSATION_ID, 50, null);
  });

  it("passes a before cursor through", async () => {
    const cursor = { createdAt: message().createdAt, messageId: message().messageId };
    const listMessages = vi.fn(async () => ({ outcome: "ok" as const, page: { items: [], nextCursor: cursor } }));
    const baseUrl = await serve({ listMessages });

    const response = await fetch(
      `${baseUrl}/conversations/${CONVERSATION_ID}/messages?before=${encodeURIComponent(encodeCursor(cursor))}`,
      { headers: gatewayHeaders },
    );
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(json.next_cursor).toBe(encodeCursor(cursor));
    expect(listMessages).toHaveBeenCalledWith(expect.anything(), CONVERSATION_ID, 50, cursor);
  });

  it.each([
    { name: "not found", outcome: "not_found" as const, status: 404, code: "not_found" },
    { name: "forbidden", outcome: "forbidden" as const, status: 403, code: "forbidden" },
  ])("answers $status when $name", async ({ outcome, status, code }) => {
    const baseUrl = await serve({ listMessages: async () => ({ outcome }) });
    const response = await fetch(`${baseUrl}/conversations/${CONVERSATION_ID}/messages`, { headers: gatewayHeaders });

    expect(response.status).toBe(status);
    expectProblem(await response.json(), code);
  });

  it("answers 422 for a bad cursor", async () => {
    const listMessages = vi.fn();
    const baseUrl = await serve({ listMessages });
    const response = await fetch(`${baseUrl}/conversations/${CONVERSATION_ID}/messages?before=nope`, { headers: gatewayHeaders });

    expect(response.status).toBe(422);
    expectProblem(await response.json(), "validation_error");
    expect(listMessages).not.toHaveBeenCalled();
  });
});

describe("POST /conversations/{id}/read", () => {
  it("answers 204", async () => {
    const markRead = vi.fn(async () => ({ outcome: "read" as const }));
    const baseUrl = await serve({ markRead });
    const response = await fetch(`${baseUrl}/conversations/${CONVERSATION_ID}/read`, {
      method: "POST",
      headers: gatewayHeaders,
    });

    expect(response.status).toBe(204);
    expect(markRead).toHaveBeenCalledWith(expect.objectContaining({ userId: USER_ID, isAdmin: false }), CONVERSATION_ID);
  });

  it("treats X-User-Role admin as an admin viewer", async () => {
    const markRead = vi.fn(async () => ({ outcome: "read" as const }));
    const baseUrl = await serve({ markRead });
    await fetch(`${baseUrl}/conversations/${CONVERSATION_ID}/read`, {
      method: "POST",
      headers: { "x-user-id": USER_ID, "x-user-role": "admin" },
    });

    expect(markRead).toHaveBeenCalledWith(expect.objectContaining({ isAdmin: true }), CONVERSATION_ID);
  });
});
