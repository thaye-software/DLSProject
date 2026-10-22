import { afterEach, describe, expect, it, vi } from "vitest";
import type { Database } from "../../src/adapters/db/prisma.js";
import { startOutboxRelay } from "../../src/adapters/outbox-relay.js";
import type { EventPublisher, StoredEvent } from "../../src/adapters/rabbitmq/publisher.js";
import { availabilityEvent } from "../../src/domain/availability-event.js";

const PRODUCT_ID = "8d1d4c2a-77a5-4a2f-b0f4-2f3d0e7b9c55";
const ORDER_ID = "f47ac10b-58cc-4372-a567-0e02b2c3d479";
const EVENT_ID = "0b8f6c3e-2d1a-4e5f-9a8b-7c6d5e4f3a2b";

type PendingRow = StoredEvent & { createdAt: Date; publishedAt: Date | null };

const payload = availabilityEvent({
  id: EVENT_ID,
  productId: PRODUCT_ID,
  orderId: ORDER_ID,
  time: new Date("2026-10-14T10:00:05.000Z"),
  version: 5,
  availability: "reserved",
  previousAvailability: "available",
  stock: 0,
  reason: "order_reserved",
  causationId: null,
});

function pendingRow(): PendingRow {
  return { id: payload.id, type: payload.type, payload, createdAt: new Date("2026-10-14T10:00:05.000Z"), publishedAt: null };
}

// The relay asks the database for unpublished rows, then marks only the ones the publisher confirmed.
function inMemoryOutbox(rows: PendingRow[]): Database {
  const tx = {
    $queryRaw: () =>
      Promise.resolve(
        rows
          .filter((row) => row.publishedAt === null)
          .sort((left, right) => left.createdAt.getTime() - right.createdAt.getTime() || left.id.localeCompare(right.id))
          .map((row) => ({ id: row.id, type: row.type, payload: row.payload })),
      ),
    outboxEvent: {
      updateMany: async ({ where, data }: { where: { id: { in: string[] } }; data: { publishedAt: Date } }) => {
        for (const row of rows) {
          if (where.id.in.includes(row.id)) row.publishedAt = data.publishedAt;
        }
      },
    },
  };

  return {
    $transaction: (work: (client: typeof tx) => Promise<number>) => work(tx),
  } as unknown as Database;
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe("outbox relay", () => {
  it("publishes an unpublished row once", async () => {
    const row = pendingRow();
    const published: StoredEvent[] = [];
    const publisher: EventPublisher = {
      publish: async (event) => {
        published.push(event);
      },
    };
    const relay = startOutboxRelay({ database: inMemoryOutbox([row]), publisher, intervalMs: 60_000 });
    await relay.stop();

    expect(published).toEqual([{ id: row.id, type: row.type, payload: row.payload }]);
    expect(row.publishedAt).toBeInstanceOf(Date);
    await expect(relay.publishPending()).resolves.toBe(0);
    expect(published).toHaveLength(1);
  });

  it("leaves the row pending when the broker rejects the confirm", async () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    const row = pendingRow();
    const publisher: EventPublisher = {
      publish: async () => {
        throw new Error("confirm failed");
      },
    };
    const relay = startOutboxRelay({ database: inMemoryOutbox([row]), publisher, intervalMs: 60_000 });
    await relay.stop();

    await expect(relay.publishPending()).rejects.toThrow("confirm failed");
    expect(row.publishedAt).toBeNull();
  });
});
