import type { ConfirmChannel } from "amqplib";

export const ORDER_EVENTS_EXCHANGE = "order.events";
const CONTENT_TYPE = "application/cloudevents+json";

export type StoredEvent = { id: string; type: string; payload: unknown };

export type EventPublisher = {
  // Resolves once RabbitMQ has confirmed the message.
  publish(event: StoredEvent): Promise<void>;
};

export async function createEventPublisher(channel: ConfirmChannel): Promise<EventPublisher> {
  await channel.assertExchange(ORDER_EVENTS_EXCHANGE, "topic", { durable: true });

  return {
    publish: ({ id, type, payload }) =>
      new Promise((resolve, reject) => {
        channel.publish(
          ORDER_EVENTS_EXCHANGE,
          type,
          Buffer.from(JSON.stringify(payload), "utf8"),
          { contentType: CONTENT_TYPE, persistent: true, messageId: id },
          (error) => (error ? reject(error) : resolve()),
        );
      }),
  };
}
