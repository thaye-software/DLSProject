import type { ConfirmChannel } from "amqplib";
import type { AvailabilityEvent } from "../../domain/availability-event.js";

export const CATALOG_EVENTS_EXCHANGE = "catalog.events";
const CONTENT_TYPE = "application/cloudevents+json" as const;

// An outbox row. The payload is the CloudEvent written with the stock change.
export type StoredEvent = { id: string; type: string; payload: AvailabilityEvent };

export type EventPublisher = {
  // Resolves once RabbitMQ has confirmed the message.
  publish(event: StoredEvent): Promise<void>;
};

export type AvailabilityPublication = {
  exchange: typeof CATALOG_EVENTS_EXCHANGE;
  routingKey: string;
  contentType: typeof CONTENT_TYPE;
  persistent: true;
  messageId: string;
  body: AvailabilityEvent;
};

// The routing key is the stored event type. The reason stays the one in the outbox payload.
export function availabilityPublication(event: StoredEvent): AvailabilityPublication {
  return {
    exchange: CATALOG_EVENTS_EXCHANGE,
    routingKey: event.type,
    contentType: CONTENT_TYPE,
    persistent: true,
    messageId: event.id,
    body: event.payload,
  };
}

export async function createEventPublisher(channel: ConfirmChannel): Promise<EventPublisher> {
  await channel.assertExchange(CATALOG_EVENTS_EXCHANGE, "topic", { durable: true });

  return {
    publish: (event) =>
      new Promise((resolve, reject) => {
        const message = availabilityPublication(event);
        channel.publish(
          message.exchange,
          message.routingKey,
          Buffer.from(JSON.stringify(message.body), "utf8"),
          { contentType: message.contentType, persistent: message.persistent, messageId: message.messageId },
          (error) => (error ? reject(error) : resolve()),
        );
      }),
  };
}
