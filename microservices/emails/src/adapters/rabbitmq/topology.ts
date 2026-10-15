import type { Channel } from "amqplib";

export const DEAD_LETTER_EXCHANGE = "dlx";

export type ConsumerTopology = {
  exchange: string;
  queue: string;
  routingKeys: readonly string[];
};

export function deadLetterQueueFor(queue: string): string {
  return `${queue}.dlq`;
}

export async function assertConsumerTopology(
  channel: Channel,
  { exchange, queue, routingKeys }: ConsumerTopology,
): Promise<void> {
  const deadLetterQueue = deadLetterQueueFor(queue);

  await channel.assertExchange(exchange, "topic", { durable: true });
  await channel.assertExchange(DEAD_LETTER_EXCHANGE, "direct", { durable: true });

  await channel.assertQueue(deadLetterQueue, { durable: true, arguments: { "x-queue-type": "quorum" } });
  await channel.bindQueue(deadLetterQueue, DEAD_LETTER_EXCHANGE, queue);

  await channel.assertQueue(queue, {
    durable: true,
    arguments: {
      "x-queue-type": "quorum",
      "x-dead-letter-exchange": DEAD_LETTER_EXCHANGE,
      "x-dead-letter-routing-key": queue,
    },
  });
  for (const routingKey of routingKeys) {
    await channel.bindQueue(queue, exchange, routingKey);
  }
}
