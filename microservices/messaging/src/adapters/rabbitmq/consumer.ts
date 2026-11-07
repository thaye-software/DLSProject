import type { Channel, ConsumeMessage } from "amqplib";
import type { z } from "zod";
import { parseCloudEvent, type CloudEvent } from "./cloud-event.js";
import { RETRY_DELAYS_MS, withRetries, type Sleep } from "./retry.js";

export type PreparedEvent = { ok: true; run: () => Promise<void> } | { ok: false; reason: string };

export type EventHandler = (event: CloudEvent) => PreparedEvent;

export function handleEvent<T>(
  dataSchema: z.ZodType<T>,
  handle: (data: T, event: CloudEvent) => Promise<void>,
): EventHandler {
  return (event) => {
    const data = dataSchema.safeParse(event.data);
    if (!data.success) return { ok: false, reason: `invalid data: ${data.error.message}` };
    return { ok: true, run: () => handle(data.data, event) };
  };
}

export type ConsumerOptions = {
  queue: string;
  handlers: Readonly<Record<string, EventHandler>>;
  prefetch?: number;
  retryDelaysMs?: readonly number[];
  sleep?: Sleep;
};

export type Consumer = {
  stop: () => Promise<void>;
};

type Outcome = "ack" | "dead-letter";

const DEFAULT_PREFETCH = 10;

export async function startConsumer(
  channel: Channel,
  { queue, handlers, prefetch = DEFAULT_PREFETCH, retryDelaysMs = RETRY_DELAYS_MS, sleep }: ConsumerOptions,
): Promise<Consumer> {
  async function process(message: ConsumeMessage): Promise<Outcome> {
    const parsed = parseCloudEvent(message.content);
    if (!parsed.ok) {
      console.error(`Dead-lettering message from ${queue}: ${parsed.reason}`);
      return "dead-letter";
    }

    const { event } = parsed;
    const handler = Object.hasOwn(handlers, event.type) ? handlers[event.type] : undefined;
    if (!handler) {
      console.error(`Dead-lettering event ${event.id}: no handler for type ${event.type}`);
      return "dead-letter";
    }

    const prepared = handler(event);
    if (!prepared.ok) {
      console.error(`Dead-lettering event ${event.id} (${event.type}): ${prepared.reason}`);
      return "dead-letter";
    }

    try {
      await withRetries(prepared.run, retryDelaysMs, sleep);
      return "ack";
    } catch (error) {
      console.error(`Dead-lettering event ${event.id} (${event.type}) after ${retryDelaysMs.length} retries`, error);
      return "dead-letter";
    }
  }

  await channel.prefetch(prefetch);
  const { consumerTag } = await channel.consume(queue, (message) => {
    if (!message) return;
    process(message)
      .then((outcome) => (outcome === "ack" ? channel.ack(message) : channel.nack(message, false, false)))
      .catch((error) => console.error(`Could not settle message from ${queue}`, error));
  });

  return {
    stop: async () => {
      await channel.cancel(consumerTag);
    },
  };
}
