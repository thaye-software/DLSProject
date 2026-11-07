import type { Message } from "../../domain/chat.js";

export type ChatBroadcaster = {
  messageCreated(message: Message): Promise<void>;
};

export const noBroadcast: ChatBroadcaster = {
  async messageCreated() {},
};
