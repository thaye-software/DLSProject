import type { Channel, ConsumeMessage } from "amqplib";
import type { z } from "zod";
import { elapsedMs, logger, withLogContext } from "../shared/logger.js";
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
    logger.info(
      { queue, routingKey: message.fields.routingKey, messageId: message.properties.messageId, bytes: message.content.length },
      "Message received",
    );
    const parsed = parseCloudEvent(message.content);
    if (!parsed.ok) {
      logger.error({ queue, reason: parsed.reason }, "Dead-lettering message: not a valid CloudEvent");
      return "dead-letter";
    }

    const { event } = parsed;
    return withLogContext({ queue, eventId: event.id, eventType: event.type }, () => handle(event));
  }

  async function handle(event: CloudEvent): Promise<Outcome> {
    const startedAt = performance.now();
    logger.debug({ input: event }, "Event input");

    const handler = Object.hasOwn(handlers, event.type) ? handlers[event.type] : undefined;
    if (!handler) {
      logger.error("Dead-lettering event: no handler for its type");
      return "dead-letter";
    }

    const prepared = handler(event);
    if (!prepared.ok) {
      logger.error({ reason: prepared.reason }, "Dead-lettering event: invalid data");
      return "dead-letter";
    }

    try {
      await withRetries(prepared.run, retryDelaysMs, sleep);
      logger.debug({ durationMs: elapsedMs(startedAt) }, "Event handled");
      return "ack";
    } catch (error) {
      logger.error({ err: error, retries: retryDelaysMs.length }, "Dead-lettering event: handler kept failing");
      return "dead-letter";
    }
  }

  await channel.prefetch(prefetch);
  const { consumerTag } = await channel.consume(queue, (message) => {
    if (!message) return;
    process(message)
      .then((outcome) => (outcome === "ack" ? channel.ack(message) : channel.nack(message, false, false)))
      .catch((error) => logger.error({ err: error, queue }, "Could not settle message"));
  });

  return {
    stop: async () => {
      await channel.cancel(consumerTag);
    },
  };
}
