/** @jest-environment node */
import { gatewayFetch } from "@/lib/gateway";
import {
  listConversations,
  listMessages,
  markRead,
  openConversation,
  sendMessage,
} from "@/services/conversationService";

jest.mock("server-only", () => ({}));
jest.mock("@/lib/gateway", () => ({ gatewayFetch: jest.fn().mockResolvedValue({}) }));

const fetchMock = gatewayFetch as jest.Mock;
beforeEach(() => fetchMock.mockClear());

test("openConversation posts product_id to /conversations", async () => {
  await openConversation("p1");
  expect(fetchMock).toHaveBeenCalledWith("/conversations", { method: "POST", body: { product_id: "p1" } });
});

test("listConversations gets /conversations", async () => {
  await listConversations();
  expect(fetchMock).toHaveBeenCalledWith("/conversations");
});

test("listMessages puts before in the query", async () => {
  await listMessages("c1", "2026-11-09T10:00:00Z");
  expect(fetchMock).toHaveBeenCalledWith("/conversations/c1/messages", { query: { before: "2026-11-09T10:00:00Z" } });
});

test("listMessages without before sends no cursor", async () => {
  await listMessages("c1");
  expect(fetchMock).toHaveBeenCalledWith("/conversations/c1/messages", { query: { before: undefined } });
});

test("sendMessage posts content with an Idempotency-Key", async () => {
  await sendMessage("c1", "hi", "key-1");
  expect(fetchMock).toHaveBeenCalledWith("/conversations/c1/messages", {
    method: "POST",
    body: { content: "hi" },
    headers: { "Idempotency-Key": "key-1" },
  });
});

test("sendMessage generates a UUID key when none is passed", async () => {
  await sendMessage("c1", "hi");
  expect(fetchMock.mock.calls[0][1].headers["Idempotency-Key"]).toMatch(/^[0-9a-f-]{36}$/);
});

test("markRead posts to /conversations/{id}/read", async () => {
  await markRead("c1");
  expect(fetchMock).toHaveBeenCalledWith("/conversations/c1/read", { method: "POST" });
});
