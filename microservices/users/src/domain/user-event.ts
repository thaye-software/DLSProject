// The data of each event Users publishes on user.events (docs/contracts/asyncapi.yaml).
export type UserEventData = {
  user_deleted: {
    user_id: string;
    version: number;
    deleted_at: string;
  };
};

export type UserEventType = keyof UserEventData;

export type UserEvent<T extends UserEventType = UserEventType> = {
  specversion: "1.0";
  id: string;
  source: "/services/users";
  type: T;
  time: string;
  datacontenttype: "application/json";
  subject: string;
  dataversion: 1;
  correlationid: string;
  causationid: string | null;
  data: UserEventData[T];
};

export type UserDeletion = {
  id: string;
  userId: string;
  version: number;
  deletedAt: Date;
};

export function buildUserDeletedEvent({ id, userId, version, deletedAt }: UserDeletion): UserEvent<"user_deleted"> {
  return {
    specversion: "1.0",
    id,
    source: "/services/users",
    type: "user_deleted",
    time: deletedAt.toISOString(),
    datacontenttype: "application/json",
    subject: userId,
    dataversion: 1,
    // The deletion is its own flow, named after the user (as in the asyncapi.yaml example).
    correlationid: userId,
    // A user action, not caused by another event.
    causationid: null,
    data: { user_id: userId, version, deleted_at: deletedAt.toISOString() },
  };
}
