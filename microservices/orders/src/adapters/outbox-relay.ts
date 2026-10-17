import type { Database } from "./db/prisma.js";
import { startPolling } from "./polling.js";
import type { EventPublisher, StoredEvent } from "./rabbitmq/publisher.js";

export type OutboxRelayOptions = {
  database: Database;
  publisher: EventPublisher;
  intervalMs?: number;
  batchSize?: number;
};

export type OutboxRelay = {
  // Publishes what is pending now; returns how many events went out.
  publishPending: () => Promise<number>;
  stop: () => Promise<void>;
};

const DEFAULT_INTERVAL_MS = 1000;
const DEFAULT_BATCH_SIZE = 100;
// Publishing a full batch with confirms takes well under a second; this only guards against a hung broker.
const TRANSACTION_TIMEOUT_MS = 30_000;

// Publishes outbox rows in creation order, at least once: if marking a row fails after RabbitMQ confirmed it,
// it is published again next round and consumers drop the duplicate by its CloudEvent id.
export function startOutboxRelay({
  database,
  publisher,
  intervalMs = DEFAULT_INTERVAL_MS,
  batchSize = DEFAULT_BATCH_SIZE,
}: OutboxRelayOptions): OutboxRelay {
  const publishPending = () =>
    database.$transaction(
      async (tx) => {
        // SKIP LOCKED: several Orders instances can relay at once without publishing the same row twice.
        const rows = await tx.$queryRaw<StoredEvent[]>`
          SELECT id, type, payload FROM outbox
          WHERE published_at IS NULL
          ORDER BY created_at, id
          LIMIT ${batchSize}
          FOR UPDATE SKIP LOCKED`;
        for (const row of rows) await publisher.publish(row);
        if (rows.length) {
          await tx.outboxEvent.updateMany({ where: { id: { in: rows.map((row) => row.id) } }, data: { publishedAt: new Date() } });
        }
        return rows.length;
      },
      { timeout: TRANSACTION_TIMEOUT_MS },
    );

  const poller = startPolling("Outbox relay", publishPending, intervalMs);

  return { publishPending, stop: poller.stop };
}
