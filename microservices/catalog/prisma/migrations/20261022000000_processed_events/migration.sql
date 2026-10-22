-- CreateTable
CREATE TABLE "processed_events" (
    "event_id" UUID NOT NULL,
    "type" VARCHAR(64) NOT NULL,
    "processed_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "processed_events_pkey" PRIMARY KEY ("event_id")
);
