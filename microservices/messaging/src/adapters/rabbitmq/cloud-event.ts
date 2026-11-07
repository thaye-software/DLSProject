import { z } from "zod";

const cloudEventSchema = z.object({
  specversion: z.literal("1.0"),
  // A uuid per the contract; Orders stores it in processed_events.event_id (uuid).
  id: z.uuid(),
  source: z.string().min(1),
  type: z.string().min(1),
  time: z.iso.datetime({ offset: true }),
  data: z.unknown().refine((data) => data !== undefined, "Required"),
});

export type CloudEvent = z.infer<typeof cloudEventSchema>;

export type ParsedCloudEvent = { ok: true; event: CloudEvent } | { ok: false; reason: string };

export function parseCloudEvent(content: Buffer): ParsedCloudEvent {
  let body: unknown;
  try {
    body = JSON.parse(content.toString("utf8"));
  } catch {
    return { ok: false, reason: "body is not JSON" };
  }

  const envelope = cloudEventSchema.safeParse(body);
  if (!envelope.success) {
    return { ok: false, reason: `not a CloudEvent: ${z.prettifyError(envelope.error)}` };
  }
  return { ok: true, event: envelope.data };
}
