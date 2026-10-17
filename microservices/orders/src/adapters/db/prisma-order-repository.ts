import { Prisma } from "../../generated/prisma/client.js";
import type { InsertResult, OrderPage, OrderQuery, OrderRepository } from "../../application/ports/order-repository.js";
import type { Address, Order, OrderStatus } from "../../domain/order.js";
import type { Database } from "./prisma.js";

export const orderWithRelations = {
  items: true,
  billingAddress: true,
  deliveryAddress: true,
} satisfies Prisma.OrderInclude;

type OrderRow = Prisma.OrderGetPayload<{ include: typeof orderWithRelations }>;
type AddressRow = NonNullable<OrderRow["billingAddress"]>;

// Postgres unique violation, as reported by Prisma.
const UNIQUE_VIOLATION = "P2002";

export class PrismaOrderRepository implements OrderRepository {
  constructor(private readonly database: Database) {}

  async findById(id: string): Promise<Order | null> {
    const row = await this.database.order.findUnique({ where: { id }, include: orderWithRelations });
    return row ? toOrder(row) : null;
  }

  async list({ userId, statuses, page, pageSize }: OrderQuery): Promise<OrderPage> {
    const where: Prisma.OrderWhereInput = {
      ...(userId === null ? {} : { userId }),
      ...(statuses.length ? { status: { in: statuses } } : {}),
    };
    const [rows, total] = await this.database.$transaction([
      this.database.order.findMany({
        where,
        include: orderWithRelations,
        // id breaks ties so pages don't overlap when orders share a created_at.
        orderBy: [{ createdAt: "desc" }, { id: "desc" }],
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.database.order.count({ where }),
    ]);
    return { orders: rows.map(toOrder), total };
  }

  async findByIdempotencyKey(userId: string, idempotencyKey: string): Promise<Order | null> {
    const row = await this.database.order.findUnique({
      where: { userId_idempotencyKey: { userId, idempotencyKey } },
      include: orderWithRelations,
    });
    return row ? toOrder(row) : null;
  }

  async insert(order: Order, idempotencyKey: string): Promise<InsertResult> {
    try {
      await this.database.order.create({
        data: {
          id: order.id,
          userId: order.userId,
          status: order.status,
          shippingPriceDkk: BigInt(order.shippingPriceDkk),
          subTotalDkk: BigInt(order.subTotalDkk),
          totalPriceDkk: BigInt(order.totalPriceDkk),
          customerEmail: order.customerEmail,
          createdAt: order.createdAt,
          expiresAt: order.expiresAt,
          idempotencyKey,
          billingAddress: { create: toAddressRow(order.billingAddress) },
          deliveryAddress: { create: toAddressRow(order.deliveryAddress) },
          items: {
            create: order.items.map((line) => ({
              productId: line.productId,
              quantity: line.quantity,
              productName: line.productName,
              thumbnailUrl: line.thumbnailUrl,
              unitPriceDkk: BigInt(line.unitPriceDkk),
            })),
          },
        },
      });
      return { kind: "inserted" };
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === UNIQUE_VIOLATION) {
        return { kind: "duplicate" };
      }
      throw error;
    }
  }
}

function toAddressRow(address: Address) {
  return {
    firstName: address.firstName,
    middleName: address.middleName,
    lastName: address.lastName,
    addressLine1: address.addressLine1,
    addressLine2: address.addressLine2,
    city: address.city,
    zipCode: address.zipCode,
    stateProvince: address.stateProvince,
    country: address.countryCode,
  };
}

function toAddress(row: AddressRow): Address {
  return {
    firstName: row.firstName,
    middleName: row.middleName,
    lastName: row.lastName,
    addressLine1: row.addressLine1,
    addressLine2: row.addressLine2,
    city: row.city,
    zipCode: row.zipCode,
    stateProvince: row.stateProvince,
    countryCode: row.country,
  };
}

export function toOrder(row: OrderRow): Order {
  // shortcut: every order has both addresses until auction orders exist ("Auction orders" in DECISIONS.md), revisit then.
  if (!row.billingAddress || !row.deliveryAddress) throw new Error(`Order ${row.id} has no billing or delivery address`);
  return {
    id: row.id,
    userId: row.userId,
    customerEmail: row.customerEmail,
    status: row.status as OrderStatus, // guaranteed by orders_status_check
    items: row.items.map((item) => ({
      productId: item.productId,
      quantity: item.quantity,
      productName: item.productName,
      thumbnailUrl: item.thumbnailUrl,
      unitPriceDkk: Number(item.unitPriceDkk),
    })),
    subTotalDkk: Number(row.subTotalDkk),
    shippingPriceDkk: Number(row.shippingPriceDkk),
    totalPriceDkk: Number(row.totalPriceDkk),
    billingAddress: toAddress(row.billingAddress),
    deliveryAddress: toAddress(row.deliveryAddress),
    createdAt: row.createdAt,
    expiresAt: row.expiresAt,
  };
}
