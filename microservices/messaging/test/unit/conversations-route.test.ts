import { describe, expect, it, vi } from "vitest";
import { conversationJson, messageJson } from "../../src/adapters/http/chat-json.js";
import type { OpenConversationResult } from "../../src/application/open-conversation.js";
import { conversation, customer, IDEMPOTENCY_KEY, message, PRODUCT_ID, USER_ID } from "../fixtures/chat.js";
import { contractSchema, openApi } from "../support/contract.js";
import { serve } from "../support/serve.js";

const gatewayHeaders = {
  "x-user-id": USER_ID,
  "x-user-email": "mette@example.com",
};

async function postConversations({
  result = { outcome: "created", conversation: conversation() } as OpenConversationResult,
  headers = gatewayHeaders as Record<string, string | undefined>,
  body = { product_id: PRODUCT_ID } as unknown,
} = {}) {
  const openConversation = vi.fn(async () => result);
  const baseUrl = await serve({ openConversation });
  const definedHeaders = Object.fromEntries(Object.entries(headers).filter(([, value]) => value !== undefined)) as Record<string, string>;
  const response = await fetch(`${baseUrl}/conversations`, {
    method: "POST",
    headers: { "content-type": "application/json", ...definedHeaders },
    body: typeof body === "string" ? body : JSON.stringify(body),
  });
  const json = response.status === 204 ? null : await response.json();
  return { response, json, openConversation };
}

function expectProblem(json: unknown, code: string) {
  const validate = contractSchema("Problem");
  expect(validate(json), JSON.stringify(validate.errors)).toBe(true);
  expect((json as { type: string }).type).toBe(`https://limitedwatches.dk/problems/${code}`);
}

describe("POST /conversations", () => {
  it("answers 201 with a Conversation that matches the contract", async () => {
    const { response, json } = await postConversations();

    expect(response.status).toBe(201);
    const validate = contractSchema("Conversation");
    expect(validate(json), JSON.stringify(validate.errors)).toBe(true);
    const example = openApi.paths["/conversations"].post.responses["201"].content["application/json"].example;
    expect(json).toEqual(example);
  });

  it("answers 200 for an existing conversation", async () => {
    const { response, json } = await postConversations({ result: { outcome: "existing", conversation: conversation() } });

    expect(response.status).toBe(200);
    expect(contractSchema("Conversation")(json)).toBe(true);
  });

  it("passes the gateway user and product id to the use case", async () => {
    const { openConversation } = await postConversations();

    expect(openConversation).toHaveBeenCalledWith(customer, PRODUCT_ID);
  });

  it.each([
    { name: "X-User-Id missing", headers: { ...gatewayHeaders, "x-user-id": undefined }, code: "unauthorized", status: 401 },
    { name: "X-User-Id not a UUID", headers: { ...gatewayHeaders, "x-user-id": "mette" }, code: "unauthorized", status: 401 },
  ])("answers $status when $name", async ({ headers, code, status }) => {
    const { response, json, openConversation } = await postConversations({ headers });

    expect(response.status).toBe(status);
    expectProblem(json, code);
    expect(openConversation).not.toHaveBeenCalled();
  });

  it.each([
    { name: "forbidden", result: { outcome: "forbidden" as const }, status: 403, code: "forbidden" },
    { name: "product missing", result: { outcome: "product_not_found" as const }, status: 404, code: "not_found" },
    { name: "Catalog down", result: { outcome: "catalog_unavailable" as const }, status: 502, code: "catalog_unavailable" },
  ])("answers $status when $name", async ({ result, status, code }) => {
    const { response, json } = await postConversations({ result });

    expect(response.status).toBe(status);
    expectProblem(json, code);
  });

  it.each([
    { name: "product_id missing (EP)", body: {} },
    { name: "product_id not a uuid (EP)", body: { product_id: "submariner" } },
    { name: "unknown field (EP)", body: { product_id: PRODUCT_ID, extra: true } },
  ])("$name → 422", async ({ body }) => {
    const { response, json, openConversation } = await postConversations({ body });

    expect(response.status).toBe(422);
    expectProblem(json, "validation_error");
    expect(openConversation).not.toHaveBeenCalled();
  });
});

describe("GET /conversations", () => {
  it("answers 200 with ConversationList matching the contract", async () => {
    const withMessage = conversation({ lastMessage: message(), updatedAt: message().createdAt, shopUnreadCount: 0 });
    const baseUrl = await serve({ listConversations: async () => [withMessage] });

    const response = await fetch(`${baseUrl}/conversations`, { headers: gatewayHeaders });
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(contractSchema("ConversationList")(json), JSON.stringify(contractSchema("ConversationList").errors)).toBe(true);
    expect(json).toEqual({ items: [conversationJson(withMessage, customer)] });
    const example = openApi.paths["/conversations"].get.responses["200"].content["application/json"].example;
    expect(json).toEqual(example);
  });

  it("answers 401 without X-User-Id", async () => {
    const response = await fetch(`${await serve()}/conversations`);

    expect(response.status).toBe(401);
    expectProblem(await response.json(), "unauthorized");
  });
});

describe("GET /health", () => {
  it("answers 200 when the broker and MongoDB are up", async () => {
    const response = await fetch(`${await serve()}/health`);

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ status: "ok" });
  });

  it.each([
    { name: "broker down", broker: false, database: true, code: "broker_unavailable" },
    { name: "MongoDB down", broker: true, database: false, code: "database_unavailable" },
  ])("answers 503 when $name", async ({ broker, database, code }) => {
    const response = await fetch(`${await serve({ isBrokerConnected: () => broker, isDatabaseReachable: async () => database })}/health`);

    expect(response.status).toBe(503);
    expect((await response.json()).type).toBe(`https://limitedwatches.dk/problems/${code}`);
  });
});

describe("POST /conversations/{id}/messages", () => {
  it("answers 201 with a ChatMessage that matches the contract", async () => {
    const sendMessage = vi.fn(async () => ({ outcome: "sent" as const, message: message() }));
    const baseUrl = await serve({ sendMessage });
    const response = await fetch(`${baseUrl}/conversations/${message().conversationId}/messages`, {
      method: "POST",
      headers: { "content-type": "application/json", ...gatewayHeaders, "idempotency-key": IDEMPOTENCY_KEY },
      body: JSON.stringify({ content: "Is this watch still available?" }),
    });
    const json = await response.json();

    expect(response.status).toBe(201);
    expect(contractSchema("ChatMessage")(json), JSON.stringify(contractSchema("ChatMessage").errors)).toBe(true);
    expect(json).toEqual(messageJson(message()));
    expect(sendMessage).toHaveBeenCalledWith(customer, message().conversationId, "Is this watch still available?", IDEMPOTENCY_KEY);
  });

  it("answers 201 for a replayed Idempotency-Key", async () => {
    const sendMessage = vi.fn(async () => ({ outcome: "replayed" as const, message: message() }));
    const baseUrl = await serve({ sendMessage });
    const response = await fetch(`${baseUrl}/conversations/${message().conversationId}/messages`, {
      method: "POST",
      headers: { "content-type": "application/json", ...gatewayHeaders, "idempotency-key": IDEMPOTENCY_KEY },
      body: JSON.stringify({ content: "Is this watch still available?" }),
    });

    expect(response.status).toBe(201);
    expect(await response.json()).toEqual(messageJson(message()));
  });

  it.each([
    { name: "Idempotency-Key missing", headers: { ...gatewayHeaders, "idempotency-key": undefined } },
    { name: "Idempotency-Key not a UUID", headers: { ...gatewayHeaders, "idempotency-key": "abc" } },
  ])("$name → 422", async ({ headers }) => {
    const sendMessage = vi.fn();
    const baseUrl = await serve({ sendMessage });
    const definedHeaders = Object.fromEntries(Object.entries(headers).filter(([, value]) => value !== undefined)) as Record<string, string>;
    const response = await fetch(`${baseUrl}/conversations/${message().conversationId}/messages`, {
      method: "POST",
      headers: { "content-type": "application/json", ...definedHeaders },
      body: JSON.stringify({ content: "Hi" }),
    });

    expect(response.status).toBe(422);
    expectProblem(await response.json(), "validation_error");
    expect(sendMessage).not.toHaveBeenCalled();
  });

  it.each([
    { name: "empty content (BV)", body: { content: "" } },
    { name: "content of 2001 characters (BV)", body: { content: "a".repeat(2001) } },
    { name: "unknown field (EP)", body: { content: "Hi", extra: 1 } },
  ])("$name → 422", async ({ body }) => {
    const sendMessage = vi.fn();
    const baseUrl = await serve({ sendMessage });
    const response = await fetch(`${baseUrl}/conversations/${message().conversationId}/messages`, {
      method: "POST",
      headers: { "content-type": "application/json", ...gatewayHeaders, "idempotency-key": IDEMPOTENCY_KEY },
      body: JSON.stringify(body),
    });

    expect(response.status).toBe(422);
    expectProblem(await response.json(), "validation_error");
    expect(sendMessage).not.toHaveBeenCalled();
  });
});
