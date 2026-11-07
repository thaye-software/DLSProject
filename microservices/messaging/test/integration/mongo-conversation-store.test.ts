import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { MongoConversationStore } from "../../src/adapters/mongo/mongo-conversation-store.js";
import { encodeCursor } from "../../src/domain/chat.js";
import { customer, NOW, PRODUCT_ID, product } from "../fixtures/chat.js";
import { startMongo, type TestMongo } from "../support/containers.js";

let test: TestMongo;
let store: MongoConversationStore;

beforeAll(async () => {
  test = await startMongo();
  store = new MongoConversationStore(test.mongo.db);
  await store.ensureIndexes();
});

afterAll(async () => {
  await test?.mongo?.close();
  await test?.container?.stop();
});

describe("MongoConversationStore", () => {
  it("enforces one conversation per customer and product", async () => {
    const conversationId = randomUUID();
    await store.insert({
      conversationId,
      customerUserId: customer.userId,
      customerDisplayName: "mette",
      productId: PRODUCT_ID,
      productName: product.name,
      thumbnailUrl: product.thumbnailUrl,
      now: NOW,
    });

    await expect(
      store.insert({
        conversationId: randomUUID(),
        customerUserId: customer.userId,
        customerDisplayName: "mette",
        productId: PRODUCT_ID,
        productName: product.name,
        thumbnailUrl: product.thumbnailUrl,
        now: NOW,
      }),
    ).rejects.toMatchObject({ code: 11000 });
  });

  it("pages messages oldest-first and returns a cursor for older ones", async () => {
    const conversationId = randomUUID();
    await store.insert({
      conversationId,
      customerUserId: randomUUID(),
      customerDisplayName: "lars",
      productId: randomUUID(),
      productName: product.name,
      thumbnailUrl: null,
      now: NOW,
    });
    const times = [1, 2, 3].map((second) => new Date(`2026-10-15T10:00:0${second}.000Z`));
    const ids = [randomUUID(), randomUUID(), randomUUID()];
    for (const [index, now] of times.entries()) {
      await store.insertMessage(
        {
          messageId: ids[index]!,
          conversationId,
          senderUserId: customer.userId,
          content: `m${index}`,
          idempotencyKey: ids[index]!,
          now,
        },
        "shop",
      );
    }

    const first = await store.listMessages(conversationId, 2, null);
    expect(first.items.map((item) => item.content)).toEqual(["m1", "m2"]);
    expect(first.nextCursor).not.toBeNull();

    const second = await store.listMessages(conversationId, 2, first.nextCursor);
    expect(second.items.map((item) => item.content)).toEqual(["m0"]);
    expect(second.nextCursor).toBeNull();
    expect(encodeCursor(first.nextCursor!)).toContain("_");
  });

  it("rejects a second message with the same sender and Idempotency-Key", async () => {
    const conversationId = randomUUID();
    const key = randomUUID();
    await store.insert({
      conversationId,
      customerUserId: randomUUID(),
      customerDisplayName: "lars",
      productId: randomUUID(),
      productName: product.name,
      thumbnailUrl: null,
      now: NOW,
    });
    await store.insertMessage(
      {
        messageId: randomUUID(),
        conversationId,
        senderUserId: customer.userId,
        content: "first",
        idempotencyKey: key,
        now: NOW,
      },
      "shop",
    );

    await expect(
      store.insertMessage(
        {
          messageId: randomUUID(),
          conversationId,
          senderUserId: customer.userId,
          content: "retry",
          idempotencyKey: key,
          now: NOW,
        },
        "shop",
      ),
    ).rejects.toMatchObject({ code: 11000 });
  });
});
