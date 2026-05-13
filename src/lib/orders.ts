import { db, schema } from "../db/client";
import { eq, sql as drizzleSql } from "drizzle-orm";
import type { OrderStatus, PaymentMethodId } from "../db/schema";
import { sendOrderEmail, notifyAdmin } from "./email";
import { validateCoupon } from "./coupons";

export const VALID_TRANSITIONS: Record<OrderStatus, OrderStatus[]> = {
  new: ["paid", "cancelled"],
  paid: ["preparing", "cancelled"],
  preparing: ["shipped", "cancelled"],
  shipped: ["delivered"],
  delivered: [],
  cancelled: [],
};

export const STATUS_LABELS: Record<OrderStatus, string> = {
  new: "Nova",
  paid: "Paga",
  preparing: "Em preparação",
  shipped: "Enviada",
  delivered: "Entregue",
  cancelled: "Cancelada",
};

export const STATUS_COLORS: Record<OrderStatus, string> = {
  new: "bg-amber-100 text-amber-700 border-amber-200",
  paid: "bg-blue-100 text-blue-700 border-blue-200",
  preparing: "bg-purple-100 text-purple-700 border-purple-200",
  shipped: "bg-rosa-100 text-rosa-500 border-rosa-200",
  delivered: "bg-emerald-100 text-emerald-700 border-emerald-200",
  cancelled: "bg-gray-100 text-gray-600 border-gray-200",
};

const generateOrderNumber = (): string => {
  const d = new Date();
  const yy = String(d.getFullYear()).slice(2);
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  const rand = Math.random().toString(36).slice(2, 6).toUpperCase();
  return `AS${yy}${mm}${dd}-${rand}`;
};

export type NewOrderInput = {
  customer: {
    name: string;
    email: string;
    phone: string;
    address: string;
    postalCode: string;
    city: string;
    nif?: string | null;
  };
  paymentMethod: PaymentMethodId;
  notes?: string | null;
  couponCode?: string | null;
  items: Array<{
    productSlug: string;
    name: string;
    unitPriceCents: number;
    quantity: number;
    image?: string | null;
    personalization?: {
      phrase: string;
      colors: string[];
      description: string;
      attachment?: { url: string; name: string; kind: "image" | "pdf" };
    } | null;
    variantColor?: { name: string; hex: string } | null;
  }>;
};

export const createOrder = async (input: NewOrderInput) => {
  return db.transaction(async (tx) => {
    const subtotal = input.items.reduce(
      (sum, item) => sum + item.unitPriceCents * item.quantity,
      0,
    );

    let appliedCouponCode: string | null = null;
    let discountCents = 0;
    if (input.couponCode) {
      const validation = await validateCoupon(input.couponCode, subtotal);
      if (validation.ok) {
        appliedCouponCode = validation.code;
        discountCents = validation.discountCents;
        await tx
          .update(schema.coupons)
          .set({
            usedCount: drizzleSql`${schema.coupons.usedCount} + 1`,
            updatedAt: new Date(),
          })
          .where(drizzleSql`upper(${schema.coupons.code}) = ${appliedCouponCode}`);
      }
    }

    const [order] = await tx
      .insert(schema.orders)
      .values({
        number: generateOrderNumber(),
        customerName: input.customer.name,
        customerEmail: input.customer.email.toLowerCase(),
        customerPhone: input.customer.phone,
        address: input.customer.address,
        postalCode: input.customer.postalCode,
        city: input.customer.city,
        nif: input.customer.nif ?? null,
        paymentMethod: input.paymentMethod,
        subtotalCents: subtotal,
        couponCode: appliedCouponCode,
        discountCents,
        notes: input.notes ?? null,
        status: "new",
      })
      .returning();

    const productsBySlug = new Map(
      (
        await tx
          .select({ id: schema.products.id, slug: schema.products.slug })
          .from(schema.products)
      ).map((p) => [p.slug, p.id]),
    );

    const itemsToInsert = input.items.map((item) => {
      const basePersonalization = item.personalization ?? null;
      const variantColor = item.variantColor ?? undefined;
      const personalization = variantColor
        ? {
            phrase: basePersonalization?.phrase ?? "",
            colors: basePersonalization?.colors ?? [],
            description: basePersonalization?.description ?? "",
            variantColor,
          }
        : basePersonalization;
      return {
        orderId: order.id,
        productId: productsBySlug.get(item.productSlug) ?? null,
        productName: item.name,
        productSlug: item.productSlug,
        unitPriceCents: item.unitPriceCents,
        quantity: item.quantity,
        image: item.image ?? null,
        personalization,
      };
    });

    const insertedItems = await tx
      .insert(schema.orderItems)
      .values(itemsToInsert)
      .returning();

    await tx.insert(schema.orderEvents).values({
      orderId: order.id,
      fromStatus: null,
      toStatus: "new",
      note: "Encomenda criada pelo cliente",
    });

    return { order, items: insertedItems };
  });
};

export const transitionOrder = async (params: {
  orderId: number;
  to: OrderStatus;
  actorUserId?: number;
  trackingCode?: string | null;
  note?: string | null;
}) => {
  const { orderId, to, actorUserId, trackingCode, note } = params;

  return db.transaction(async (tx) => {
    const [order] = await tx
      .select()
      .from(schema.orders)
      .where(eq(schema.orders.id, orderId))
      .limit(1);

    if (!order) throw new Error("Encomenda não encontrada");

    const allowed = VALID_TRANSITIONS[order.status] ?? [];
    if (!allowed.includes(to)) {
      throw new Error(
        `Transição inválida: ${order.status} → ${to}. Permitidas: ${allowed.join(", ") || "nenhuma"}`,
      );
    }

    const updates: Partial<typeof schema.orders.$inferInsert> = {
      status: to,
      updatedAt: new Date(),
    };
    if (typeof trackingCode === "string" && trackingCode.length > 0) {
      updates.trackingCode = trackingCode;
    }

    const [updated] = await tx
      .update(schema.orders)
      .set(updates)
      .where(eq(schema.orders.id, orderId))
      .returning();

    await tx.insert(schema.orderEvents).values({
      orderId,
      fromStatus: order.status,
      toStatus: to,
      actorUserId: actorUserId ?? null,
      note: note ?? null,
    });

    if (to === "paid") {
      const items = await tx
        .select()
        .from(schema.orderItems)
        .where(eq(schema.orderItems.orderId, orderId));

      for (const item of items) {
        if (!item.productId) continue;
        await tx
          .update(schema.products)
          .set({
            stock: drizzleSql`GREATEST(${schema.products.stock} - ${item.quantity}, 0)`,
          })
          .where(eq(schema.products.id, item.productId));
      }
    }

    return updated;
  });
};

export const sendTransitionEmail = async (orderId: number, to: OrderStatus) => {
  const [order] = await db
    .select()
    .from(schema.orders)
    .where(eq(schema.orders.id, orderId))
    .limit(1);
  if (!order) return;

  const items = await db
    .select()
    .from(schema.orderItems)
    .where(eq(schema.orderItems.orderId, orderId));

  await sendOrderEmail({ order, items, status: to });
};

export const sendNewOrderNotifications = async (
  orderId: number,
) => {
  const [order] = await db
    .select()
    .from(schema.orders)
    .where(eq(schema.orders.id, orderId))
    .limit(1);
  if (!order) return;

  const items = await db
    .select()
    .from(schema.orderItems)
    .where(eq(schema.orderItems.orderId, orderId));

  await sendOrderEmail({ order, items, status: "new" });
  await notifyAdmin({ order, items });
};
