import { db, schema } from "../db/client";
import { eq, and, desc, asc, inArray, sql } from "drizzle-orm";
import type { ProductCategorySlug } from "../db/schema";

export type ProductWithExtras = {
  id: number;
  slug: string;
  name: string;
  description: string;
  longDescription: string;
  priceCents: number;
  category: ProductCategorySlug;
  stock: number;
  unlimitedStock: boolean;
  bestseller: boolean;
  personalizable: boolean;
  active: boolean;
  sortOrder: number;
  images: Array<{ url: string; alt: string; position: number }>;
  colors: Array<{ name: string; hex: string; position: number }>;
};

const attachExtras = async (
  rows: Array<typeof schema.products.$inferSelect>,
): Promise<ProductWithExtras[]> => {
  if (rows.length === 0) return [];

  const ids = rows.map((r) => r.id);
  const [allImages, allColors] = await Promise.all([
    db
      .select()
      .from(schema.productImages)
      .where(inArray(schema.productImages.productId, ids)),
    db
      .select()
      .from(schema.productColors)
      .where(inArray(schema.productColors.productId, ids)),
  ]);

  return rows.map((p) => ({
    id: p.id,
    slug: p.slug,
    name: p.name,
    description: p.description,
    longDescription: p.longDescription,
    priceCents: p.priceCents,
    category: p.category,
    stock: p.stock,
    unlimitedStock: p.unlimitedStock,
    bestseller: p.bestseller,
    personalizable: p.personalizable,
    active: p.active,
    sortOrder: p.sortOrder,
    images: allImages
      .filter((i) => i.productId === p.id)
      .sort((a, b) => a.position - b.position)
      .map((i) => ({ url: i.url, alt: i.alt, position: i.position })),
    colors: allColors
      .filter((c) => c.productId === p.id)
      .sort((a, b) => a.position - b.position)
      .map((c) => ({ name: c.name, hex: c.hex, position: c.position })),
  }));
};

export const getActiveProducts = async (): Promise<ProductWithExtras[]> => {
  const rows = await db
    .select()
    .from(schema.products)
    .where(eq(schema.products.active, true))
    .orderBy(asc(schema.products.sortOrder), asc(schema.products.name));
  return attachExtras(rows);
};

export const getAllProducts = async (): Promise<ProductWithExtras[]> => {
  const rows = await db
    .select()
    .from(schema.products)
    .orderBy(asc(schema.products.sortOrder), asc(schema.products.name));
  return attachExtras(rows);
};

export const getBestsellers = async (
  limit = 8,
): Promise<ProductWithExtras[]> => {
  const rows = await db
    .select()
    .from(schema.products)
    .where(
      and(eq(schema.products.bestseller, true), eq(schema.products.active, true)),
    )
    .orderBy(asc(schema.products.sortOrder))
    .limit(limit);
  return attachExtras(rows);
};

export const getProductBySlug = async (
  slug: string,
): Promise<ProductWithExtras | null> => {
  const rows = await db
    .select()
    .from(schema.products)
    .where(eq(schema.products.slug, slug))
    .limit(1);
  const [result] = await attachExtras(rows);
  return result ?? null;
};

export const getProductById = async (
  id: number,
): Promise<ProductWithExtras | null> => {
  const rows = await db
    .select()
    .from(schema.products)
    .where(eq(schema.products.id, id))
    .limit(1);
  const [result] = await attachExtras(rows);
  return result ?? null;
};

export const getRelatedProducts = async (
  category: ProductCategorySlug,
  excludeId: number,
  limit = 4,
): Promise<ProductWithExtras[]> => {
  const rows = await db
    .select()
    .from(schema.products)
    .where(
      and(
        eq(schema.products.category, category),
        eq(schema.products.active, true),
        sql`${schema.products.id} <> ${excludeId}`,
      ),
    )
    .orderBy(asc(schema.products.sortOrder))
    .limit(limit);
  return attachExtras(rows);
};

export const getPage = async (slug: string) => {
  const [page] = await db
    .select()
    .from(schema.pages)
    .where(eq(schema.pages.slug, slug))
    .limit(1);
  return page ?? null;
};

export const isAvailable = (p: ProductWithExtras): boolean =>
  p.active && (p.unlimitedStock || p.stock > 0);

export const formatEuro = (cents: number): string =>
  new Intl.NumberFormat("pt-PT", {
    style: "currency",
    currency: "EUR",
  }).format(cents / 100);

export type OrdersPageFilter = {
  status?: schema.OrderStatus;
};

export const listOrders = async (filter: OrdersPageFilter = {}) => {
  const query = db.select().from(schema.orders);
  const rows = filter.status
    ? await query
        .where(eq(schema.orders.status, filter.status))
        .orderBy(desc(schema.orders.createdAt))
    : await query.orderBy(desc(schema.orders.createdAt));
  return rows;
};

export const getOrderWithItems = async (id: number) => {
  const [order] = await db
    .select()
    .from(schema.orders)
    .where(eq(schema.orders.id, id))
    .limit(1);
  if (!order) return null;

  const [items, events] = await Promise.all([
    db
      .select()
      .from(schema.orderItems)
      .where(eq(schema.orderItems.orderId, id)),
    db
      .select()
      .from(schema.orderEvents)
      .where(eq(schema.orderEvents.orderId, id))
      .orderBy(asc(schema.orderEvents.createdAt)),
  ]);

  return { order, items, events };
};

export const getDashboardStats = async () => {
  const [pendingNew, pendingPaid, pendingPreparing] = await Promise.all([
    db
      .select({ count: sql<number>`count(*)::int` })
      .from(schema.orders)
      .where(eq(schema.orders.status, "new")),
    db
      .select({ count: sql<number>`count(*)::int` })
      .from(schema.orders)
      .where(eq(schema.orders.status, "paid")),
    db
      .select({ count: sql<number>`count(*)::int` })
      .from(schema.orders)
      .where(eq(schema.orders.status, "preparing")),
  ]);

  const revenueTotal = await db
    .select({
      total: sql<number>`coalesce(sum(${schema.orders.subtotalCents}), 0)::int`,
    })
    .from(schema.orders)
    .where(
      sql`${schema.orders.status} IN ('paid', 'preparing', 'shipped', 'delivered')`,
    );

  const revenueMonth = await db
    .select({
      total: sql<number>`coalesce(sum(${schema.orders.subtotalCents}), 0)::int`,
    })
    .from(schema.orders)
    .where(
      sql`${schema.orders.status} IN ('paid', 'preparing', 'shipped', 'delivered') AND ${schema.orders.createdAt} >= date_trunc('month', current_date)`,
    );

  const revenuePrevMonth = await db
    .select({
      total: sql<number>`coalesce(sum(${schema.orders.subtotalCents}), 0)::int`,
    })
    .from(schema.orders)
    .where(
      sql`${schema.orders.status} IN ('paid', 'preparing', 'shipped', 'delivered') AND ${schema.orders.createdAt} >= date_trunc('month', current_date - interval '1 month') AND ${schema.orders.createdAt} < date_trunc('month', current_date)`,
    );

  const topProducts = await db
    .select({
      productSlug: schema.orderItems.productSlug,
      productName: schema.orderItems.productName,
      totalQuantity: sql<number>`sum(${schema.orderItems.quantity})::int`,
      totalRevenue: sql<number>`sum(${schema.orderItems.unitPriceCents} * ${schema.orderItems.quantity})::int`,
    })
    .from(schema.orderItems)
    .innerJoin(schema.orders, eq(schema.orderItems.orderId, schema.orders.id))
    .where(
      sql`${schema.orders.status} IN ('paid', 'preparing', 'shipped', 'delivered')`,
    )
    .groupBy(schema.orderItems.productSlug, schema.orderItems.productName)
    .orderBy(sql`sum(${schema.orderItems.quantity}) desc`)
    .limit(5);

  const daily = await db
    .select({
      day: sql<string>`to_char(date_trunc('day', ${schema.orders.createdAt}), 'YYYY-MM-DD')`,
      count: sql<number>`count(*)::int`,
    })
    .from(schema.orders)
    .where(
      sql`${schema.orders.createdAt} >= current_date - interval '30 days'`,
    )
    .groupBy(sql`date_trunc('day', ${schema.orders.createdAt})`)
    .orderBy(sql`date_trunc('day', ${schema.orders.createdAt})`);

  return {
    pending: {
      new: pendingNew[0]?.count ?? 0,
      paid: pendingPaid[0]?.count ?? 0,
      preparing: pendingPreparing[0]?.count ?? 0,
    },
    revenue: {
      total: revenueTotal[0]?.total ?? 0,
      month: revenueMonth[0]?.total ?? 0,
      prevMonth: revenuePrevMonth[0]?.total ?? 0,
    },
    topProducts,
    daily,
  };
};
