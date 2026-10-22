import { z } from "zod";
import type { Prisma } from "../../generated/prisma/client.js";
import type {
  CancelDecision,
  CancelResult,
  ConfirmDecision,
  ExpireResult,
  ConfirmEvent,
  ConfirmResult,
  ReleaseDecision,
  ReleaseResult,
  ReservationSnapshot,
  ReservationStore,
  ReserveDecision,
  ReserveResult,
} from "../../application/ports/reservation-store.js";
import { AVAILABILITY_REASONS, type AvailabilityEvent } from "../../domain/availability-event.js";
import { AVAILABILITIES, type Product } from "../../domain/product.js";
import { RESERVATION_STATUSES, type Reservation, type ReservationStatus } from "../../domain/reservation.js";
import { enumMember } from "./enum-member.js";
import { PrismaProductRepository, toProduct } from "./prisma-product-repository.js";
import type { Database } from "./prisma.js";

const reservationWithItems = {
  items: { orderBy: { position: "asc" as const } },
} satisfies Prisma.ReservationInclude;

type ReservationRow = Prisma.ReservationGetPayload<{ include: typeof reservationWithItems }>;
type Tx = Prisma.TransactionClient;

const storedEventSchema = z.object({
  specversion: z.literal("1.0"),
  id: z.string(),
  source: z.literal("/services/catalog"),
  type: z.literal("product_availability_changed"),
  time: z.string(),
  datacontenttype: z.literal("application/json"),
  subject: z.string(),
  dataversion: z.literal(1),
  correlationid: z.string(),
  causationid: z.string().nullable(),
  data: z.object({
    product_id: z.string(),
    version: z.number(),
    availability: z.enum(AVAILABILITIES),
    previous_availability: z.enum(AVAILABILITIES),
    stock: z.number(),
    reason: z.enum(AVAILABILITY_REASONS),
    order_id: z.string().nullable(),
    changed_at: z.string(),
  }),
});

// Stock, the reservation, and its outbox rows commit together. A rejected reserve writes nothing.
export class PrismaReservationStore implements ReservationStore {
  constructor(private readonly database: Database) {}

  reserve(orderId: string, decide: (snapshot: ReservationSnapshot) => ReserveDecision): Promise<ReserveResult> {
    return this.database.$transaction(async (tx) => {
      const snapshot = await lockedSnapshot(tx, orderId);
      const decision = decide(snapshot);
      if (decision.kind === "replay") return { outcome: "replayed", reservation: decision.reservation };
      if (decision.kind === "reject") return { outcome: "out_of_stock", unavailableProductIds: decision.unavailableProductIds };
      await applyDecision(tx, snapshot, decision.reservation, decision.products, decision.events);
      return { outcome: "reserved", reservation: decision.reservation };
    });
  }

  release(orderId: string, decide: (snapshot: ReservationSnapshot) => ReleaseDecision): Promise<ReleaseResult> {
    return this.database.$transaction(async (tx) => {
      const snapshot = await lockedSnapshot(tx, orderId);
      const decision = decide(snapshot);
      if (decision.kind === "unchanged") {
        return decision.outcome === "unknown" ? { outcome: "unknown" } : { outcome: decision.outcome, reservation: decision.reservation };
      }
      await applyDecision(tx, snapshot, decision.reservation, decision.products, decision.events);
      return { outcome: "released", reservation: decision.reservation };
    });
  }

  confirm(orderId: string, event: ConfirmEvent, decide: (snapshot: ReservationSnapshot) => ConfirmDecision): Promise<ConfirmResult> {
    return this.database.$transaction(async (tx) => {
      const snapshot = await lockedSnapshot(tx, orderId);
      const seen = await tx.processedEvent.findUnique({ where: { eventId: event.id } });
      if (seen) return { outcome: "duplicate" };

      const decision: ConfirmDecision = decide(snapshot);
      if (decision.kind === "unchanged") {
        return decision.outcome === "unknown" ? { outcome: "unknown" } : { outcome: decision.outcome, reservation: decision.reservation };
      }

      const inbox = await tx.processedEvent.createMany({ data: [{ eventId: event.id, type: event.type }], skipDuplicates: true });
      if (inbox.count === 0) return { outcome: "duplicate" };

      await applyDecision(tx, snapshot, decision.reservation, decision.products, decision.events);
      return { outcome: "confirmed", reservation: decision.reservation };
    });
  }

  cancel(orderId: string, event: ConfirmEvent, decide: (snapshot: ReservationSnapshot) => CancelDecision): Promise<CancelResult> {
    return this.database.$transaction(async (tx) => {
      const snapshot = await lockedSnapshot(tx, orderId);
      const seen = await tx.processedEvent.findUnique({ where: { eventId: event.id } });
      if (seen) return { outcome: "duplicate" };

      const decision: CancelDecision = decide(snapshot);
      if (decision.kind === "unchanged") {
        if (decision.outcome === "already_released") return { outcome: "already_released", reservation: decision.reservation };
        return { outcome: decision.outcome };
      }

      const inbox = await tx.processedEvent.createMany({ data: [{ eventId: event.id, type: event.type }], skipDuplicates: true });
      if (inbox.count === 0) return { outcome: "duplicate" };

      await applyDecision(tx, snapshot, decision.reservation, decision.products, decision.events);
      return { outcome: "released", reservation: decision.reservation };
    });
  }

  expire(orderId: string, event: ConfirmEvent, decide: (snapshot: ReservationSnapshot) => ReleaseDecision): Promise<ExpireResult> {
    return this.database.$transaction(async (tx) => {
      const snapshot = await lockedSnapshot(tx, orderId);
      const seen = await tx.processedEvent.findUnique({ where: { eventId: event.id } });
      if (seen) return { outcome: "duplicate" };

      const decision: ReleaseDecision = decide(snapshot);
      if (decision.kind === "unchanged") {
        return decision.outcome === "unknown" ? { outcome: "unknown" } : { outcome: decision.outcome, reservation: decision.reservation };
      }

      const inbox = await tx.processedEvent.createMany({ data: [{ eventId: event.id, type: event.type }], skipDuplicates: true });
      if (inbox.count === 0) return { outcome: "duplicate" };

      await applyDecision(tx, snapshot, decision.reservation, decision.products, decision.events);
      return { outcome: "released", reservation: decision.reservation };
    });
  }

  async reservations(): Promise<readonly Reservation[]> {
    const rows = await this.database.reservation.findMany({ include: reservationWithItems, orderBy: { createdAt: "asc" } });
    return rows.map(toReservation);
  }

  product(productId: string): Promise<Product | null> {
    return new PrismaProductRepository(this.database).findById(productId);
  }

  async events(): Promise<readonly AvailabilityEvent[]> {
    const rows = await this.database.outboxEvent.findMany({ orderBy: [{ createdAt: "asc" }, { id: "asc" }] });
    return rows.map((row) => storedEventSchema.parse(row.payload));
  }
}

async function lockedSnapshot(tx: Tx, orderId: string): Promise<ReservationSnapshot> {
  // Held until commit, so a second reserve of the same watches waits and then sees the new stock.
  await tx.$queryRaw`SELECT id FROM products FOR UPDATE`;
  await tx.$queryRaw`SELECT id FROM reservations WHERE order_id = ${orderId}::uuid FOR UPDATE`;
  const productRows = await tx.product.findMany({ orderBy: { id: "asc" } });
  const reservationRows = await tx.reservation.findMany({ include: reservationWithItems, orderBy: { createdAt: "asc" } });
  const current = reservationRows.find((row) => row.orderId === orderId) ?? null;
  return {
    reservation: current ? toReservation(current) : null,
    reservations: reservationRows.map(toReservation),
    products: productRows.map(toProduct),
  };
}

async function applyDecision(
  tx: Tx,
  snapshot: ReservationSnapshot,
  reservation: Reservation,
  products: readonly Product[],
  events: readonly AvailabilityEvent[],
): Promise<void> {
  if (snapshot.reservation) {
    await tx.reservation.update({ where: { id: reservation.reservationId }, data: { status: reservation.status } });
  } else {
    await tx.reservation.create({
      data: {
        id: reservation.reservationId,
        orderId: reservation.orderId,
        status: reservation.status,
        expiresAt: reservation.expiresAt,
        createdAt: reservation.createdAt,
        items: {
          create: reservation.items.map((line, position) => ({
            position,
            productId: line.productId,
            productName: line.productName,
            quantity: line.quantity,
            unitPriceDkk: BigInt(line.unitPrice.amountMinor),
            thumbnailUrl: line.thumbnailUrl,
          })),
        },
      },
    });
  }

  for (const product of products) {
    const before = snapshot.products.find((candidate) => candidate.productId === product.productId);
    if (!before || (before.stock === product.stock && before.version === product.version && before.availability === product.availability)) continue;
    await tx.product.update({
      where: { id: product.productId },
      data: { stock: product.stock, version: product.version, availability: product.availability },
    });
  }

  if (events.length > 0) {
    await tx.outboxEvent.createMany({
      data: events.map((event) => ({ id: event.id, type: event.type, payload: event })),
    });
  }
}

export function toReservation(row: ReservationRow): Reservation {
  return {
    reservationId: row.id,
    orderId: row.orderId,
    status: status(row.status),
    items: row.items.map((line) => ({
      productId: line.productId,
      productName: line.productName,
      quantity: line.quantity,
      unitPrice: { amountMinor: Number(line.unitPriceDkk), currency: "DKK" },
      thumbnailUrl: line.thumbnailUrl,
    })),
    expiresAt: row.expiresAt,
    createdAt: row.createdAt,
  };
}

function status(value: string): ReservationStatus {
  return enumMember(RESERVATION_STATUSES, value, "reservation status");
}
