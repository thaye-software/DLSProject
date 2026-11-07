export type Inbox = {
  has(eventId: string): Promise<boolean>;
  record(eventId: string, type: string): Promise<void>;
};
