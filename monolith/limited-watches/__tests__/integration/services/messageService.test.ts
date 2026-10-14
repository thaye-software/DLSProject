/**
 * @jest-environment node
 */
import {
  setupTestDatabase,
  cleanDatabase,
  teardownTestDatabase,
  disableForeignKeys,
  enableForeignKeys,
} from "../setup/testDb";
import { setDb } from "../setup/testDbInstance";

// Mock the database module to use our test instance
jest.mock("@/database/drizzle", () => require("../setup/testDbInstance"));

import { persistMessage, markAsRead } from "@/services/messageService";
import { messages } from "@/database/schema";
import { eq } from "drizzle-orm";

describe("Message Service - Integration Tests", () => {
  let db: any;

  beforeAll(async () => {
    const setup = await setupTestDatabase();
    db = setup.db;
    setDb(db);
    await disableForeignKeys();
  });

  afterAll(async () => {
    await enableForeignKeys();
    await teardownTestDatabase();
  });

  beforeEach(async () => {
    await cleanDatabase();
  });

  it("should persist message to database", async () => {
    const conversationId = crypto.randomUUID();
    const senderId = crypto.randomUUID();
    const message = {
      conversationId,
      senderId,
      senderType: "customer" as const,
      content: "Test message",
    };

    await persistMessage(message);

    const [saved] = await db
      .select()
      .from(messages)
      .where(eq(messages.conversationId, conversationId));

    expect(saved).toBeDefined();
    expect(saved.content).toBe("Test message");
  });

  it("should mark messages as read", async () => {
    const conversationId = crypto.randomUUID();
    const userOtherId = crypto.randomUUID();
    const userCurrentId = crypto.randomUUID();

    // Insert test data
    await db.insert(messages).values([
      {
        id: crypto.randomUUID(),
        conversationId: conversationId,
        senderId: userOtherId,
        senderType: "customer",
        content: "Message 1",
        isRead: false,
        createdAt: new Date(),
      },
      {
        id: crypto.randomUUID(),
        conversationId: conversationId,
        senderId: userCurrentId,
        senderType: "customer",
        content: "Message 2",
        isRead: false,
        createdAt: new Date(),
      },
    ]);

    await markAsRead(conversationId, userCurrentId);

    const result = await db
      .select()
      .from(messages)
      .where(eq(messages.conversationId, conversationId));

    const otherUserMsg = result.find((m: any) => m.senderId === userOtherId);
    const currentUserMsg = result.find(
      (m: any) => m.senderId === userCurrentId
    );

    expect(otherUserMsg?.isRead).toBe(true);
    expect(currentUserMsg?.isRead).toBe(false);
  });
});
