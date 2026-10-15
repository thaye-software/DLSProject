import { connect, type ConfirmChannel } from "amqplib";

export type BrokerConnection = {
  channel: ConfirmChannel;
  isOpen: () => boolean;
  onUnexpectedClose: (listener: (error?: Error) => void) => void;
  close: () => Promise<void>;
};

export async function connectToBroker(url: string): Promise<BrokerConnection> {
  const connection = await connect(url);
  const channel = await connection.createConfirmChannel();

  let open = true;
  let closingDeliberately = false;
  let lastError: Error | undefined;
  const unexpectedCloseListeners: Array<(error?: Error) => void> = [];

  const markClosed = () => {
    if (!open) return;
    open = false;
    if (closingDeliberately) return;
    for (const listener of unexpectedCloseListeners) listener(lastError);
  };

  // amqplib emits 'error' before 'close' on a lost connection and throws if nothing listens for it.
  const rememberError = (error: Error) => {
    lastError = error;
  };
  connection.on("error", rememberError);
  channel.on("error", rememberError);
  connection.on("close", markClosed);
  channel.on("close", markClosed);

  return {
    channel,
    isOpen: () => open,
    onUnexpectedClose: (listener) => {
      unexpectedCloseListeners.push(listener);
    },
    close: async () => {
      closingDeliberately = true;
      // amqplib can send the connection close before frames still queued on a channel, dropping a just-sent ack.
      // Closing the channel first flushes them, because RabbitMQ handles a channel's frames in order.
      if (open) await channel.close();
      await connection.close();
    },
  };
}
