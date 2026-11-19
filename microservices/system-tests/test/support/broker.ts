import { randomUUID } from "node:crypto";
import { connect, type ChannelModel, type ConfirmChannel } from "amqplib";
import { vi } from "vitest";
import { RABBITMQ_URL } from "./stack.js";

export type CloudEvent<T = Record<string, unknown>> = {
  specversion: "1.0";
  id: string;
  source: string;
  type: string;
  time: string;
  subject?: string;
  correlationid?: string;
  causationid?: string | null;
  data: T;
};

const EVENT_TIMEOUT_MS = 20_000;

export class Broker {
  private constructor(
    private readonly connection: ChannelModel,
    private readonly channel: ConfirmChannel,
  ) {}

  static async connect(): Promise<Broker> {
    const connection = await connect(RABBITMQ_URL);
    return new Broker(connection, await connection.createConfirmChannel());
  }

  async publish(exchange: string, source: string, type: string, subject: string, data: Record<string, unknown>): Promise<CloudEvent> {
    const event: CloudEvent = {
      specversion: "1.0",
      id: randomUUID(),
      source,
      type,
      time: new Date().toISOString(),
      subject,
      correlationid: subject,
      causationid: null,
      data,
    };
    await this.channel.assertExchange(exchange, "topic", { durable: true });
    await new Promise<void>((resolve, reject) => {
      this.channel.publish(
        exchange,
        type,
        Buffer.from(JSON.stringify({ ...event, datacontenttype: "application/json", dataversion: 1 })),
        { contentType: "application/cloudevents+json", persistent: true, messageId: event.id },
        (error) => (error ? reject(error) : resolve()),
      );
    });
    return event;
  }

  async listen(exchange: string, routingKeys: string[]): Promise<EventLog> {
    await this.channel.assertExchange(exchange, "topic", { durable: true });
    const { queue } = await this.channel.assertQueue("", { exclusive: true, autoDelete: true });
    for (const key of routingKeys) await this.channel.bindQueue(queue, exchange, key);
    const log = new EventLog();
    await this.channel.consume(queue, (message) => message && log.record(JSON.parse(message.content.toString("utf8"))), { noAck: true });
    return log;
  }

  async close(): Promise<void> {
    await this.connection.close();
  }
}

export class EventLog {
  private readonly events: CloudEvent[] = [];

  record(event: CloudEvent): void {
    this.events.push(event);
  }

  all(): readonly CloudEvent[] {
    return this.events;
  }

  async first(type: string, matches: (data: any) => boolean): Promise<CloudEvent<any>> {
    return vi.waitFor(
      () => {
        const event = this.events.find((candidate) => candidate.type === type && matches(candidate.data));
        if (!event) throw new Error(`no ${type} event matched within ${EVENT_TIMEOUT_MS} ms; saw ${this.events.map((seen) => seen.type).join(", ") || "nothing"}`);
        return event;
      },
      { timeout: EVENT_TIMEOUT_MS, interval: 100 },
    );
  }
}
