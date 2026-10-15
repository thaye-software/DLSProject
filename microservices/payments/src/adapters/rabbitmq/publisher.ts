import type { ConfirmChannel } from "amqplib";
import type { EventPublisher } from "../../application/ports/event-publisher.js";

const EXCHANGE = "payment.events";
const CONTENT_TYPE = "application/cloudevents+json";

export async function createEventPublisher(channel: ConfirmChannel): Promise<EventPublisher> {
  await channel.assertExchange(EXCHANGE, "topic", { durable: true });

  return {
    publish: (event) =>
      new Promise((resolve, reject) => {
        channel.publish(
          EXCHANGE,
          event.type,
          Buffer.from(JSON.stringify(event), "utf8"),
          { contentType: CONTENT_TYPE, persistent: true, messageId: event.id },
          (error) => (error ? reject(error) : resolve()),
        );
      }),
  };
}
