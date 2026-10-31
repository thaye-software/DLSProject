import type { Collection, Db } from "mongodb";
import type { Inbox } from "../../application/ports/inbox.js";

// Longer than any redelivery window: RabbitMQ retries within seconds, a dead-letter replay within days.
const RETENTION_SECONDS = 14 * 24 * 60 * 60;

type ProcessedEvent = { _id: string; type: string; processed_at: Date };

export class MongoInbox implements Inbox {
  private readonly events: Collection<ProcessedEvent>;

  constructor(db: Db) {
    this.events = db.collection<ProcessedEvent>("processed_events");
  }

  async ensureIndexes(): Promise<void> {
    await this.events.createIndex({ processed_at: 1 }, { name: "processed_at_ttl", expireAfterSeconds: RETENTION_SECONDS });
  }

  async has(eventId: string): Promise<boolean> {
    return (await this.events.countDocuments({ _id: eventId }, { limit: 1 })) === 1;
  }

  async record(eventId: string, type: string): Promise<void> {
    // Upsert keeps a repeated record() a no-op instead of a duplicate key error.
    await this.events.updateOne({ _id: eventId }, { $set: { type, processed_at: new Date() } }, { upsert: true });
  }
}
