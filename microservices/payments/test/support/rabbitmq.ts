import { RabbitMQContainer, type StartedRabbitMQContainer } from "@testcontainers/rabbitmq";

// The module's 30 s default is too short when several brokers start at once during a coverage run.
const STARTUP_TIMEOUT_MS = 120_000;

export function startRabbitMq(image = "rabbitmq:4-alpine"): Promise<StartedRabbitMQContainer> {
  return new RabbitMQContainer(image).withStartupTimeout(STARTUP_TIMEOUT_MS).start();
}
