import {
  pgTable,
  text,
  integer,
  boolean,
  timestamp,
  serial,
  jsonb,
  pgEnum,
  uniqueIndex,
  index,
  check,
} from "drizzle-orm/pg-core";
import { relations, sql } from "drizzle-orm";

export const orderStatus = pgEnum("order_status", [
  "new",
  "paid",
  "preparing",
  "shipped",
  "delivered",
  "cancelled",
]);

export const userRole = pgEnum("user_role", ["admin", "editor"]);

export const productCategory = pgEnum("product_category", [
  "tote-bags",
  "t-shirts",
  "necessaire",
  "frascos-vidro",
  "porta-chaves",
  "capas-telemovel",
  "garrafas",
  "porta-joias",
]);

export const paymentMethod = pgEnum("payment_method", [
  "mbway",
  "transferencia",
  "paypal",
]);

export const users = pgTable(
  "users",
  {
    id: serial("id").primaryKey(),
    email: text("email").notNull(),
    name: text("name").notNull(),
    passwordHash: text("password_hash").notNull(),
    role: userRole("role").notNull().default("editor"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [uniqueIndex("users_email_idx").on(t.email)],
);

export const products = pgTable(
  "products",
  {
    id: serial("id").primaryKey(),
    slug: text("slug").notNull(),
    name: text("name").notNull(),
    description: text("description").notNull(),
    longDescription: text("long_description").notNull().default(""),
    priceCents: integer("price_cents").notNull(),
    category: productCategory("category").notNull(),
    stock: integer("stock").notNull().default(0),
    unlimitedStock: boolean("unlimited_stock").notNull().default(false),
    bestseller: boolean("bestseller").notNull().default(false),
    personalizable: boolean("personalizable").notNull().default(true),
    showFromLabel: boolean("show_from_label").notNull().default(true),
    active: boolean("active").notNull().default(true),
    sortOrder: integer("sort_order").notNull().default(0),
    variantColorTitle: text("variant_color_title").notNull().default("Cor do produto"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    uniqueIndex("products_slug_idx").on(t.slug),
    index("products_category_idx").on(t.category),
  ],
);

export const productImages = pgTable(
  "product_images",
  {
    id: serial("id").primaryKey(),
    productId: integer("product_id")
      .notNull()
      .references(() => products.id, { onDelete: "cascade" }),
    url: text("url").notNull(),
    alt: text("alt").notNull().default(""),
    position: integer("position").notNull().default(0),
    kind: text("kind").notNull().default("image"),
  },
  (t) => [index("product_images_product_idx").on(t.productId)],
);

export const productColors = pgTable(
  "product_colors",
  {
    id: serial("id").primaryKey(),
    productId: integer("product_id")
      .notNull()
      .references(() => products.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    hex: text("hex").notNull(),
    position: integer("position").notNull().default(0),
  },
  (t) => [index("product_colors_product_idx").on(t.productId)],
);

export const productVariantColors = pgTable(
  "product_variant_colors",
  {
    id: serial("id").primaryKey(),
    productId: integer("product_id")
      .notNull()
      .references(() => products.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    hex: text("hex").notNull(),
    position: integer("position").notNull().default(0),
  },
  (t) => [index("product_variant_colors_product_idx").on(t.productId)],
);

export const pages = pgTable("pages", {
  slug: text("slug").primaryKey(),
  title: text("title").notNull(),
  body: text("body").notNull(),
  blocks: jsonb("blocks").notNull().default([]),
  published: boolean("published").notNull().default(true),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  draftBlocks: jsonb("draft_blocks"),
});

export const templateKind = pgEnum("template_kind", ["catalog", "product-detail"]);

export const templates = pgTable(
  "templates",
  {
    id: serial("id").primaryKey(),
    kind: templateKind("kind").notNull(),
    name: text("name").notNull(),
    blocks: jsonb("blocks").notNull(),
    active: boolean("active").notNull().default(false),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    index("templates_kind_idx").on(t.kind),
    uniqueIndex("templates_active_per_kind")
      .on(t.kind)
      .where(sql`${t.active} = true`),
  ],
);

export const slots = pgTable("slots", {
  name: text("name").primaryKey(),       // stable identifier, e.g., "carrinho-top"
  label: text("label").notNull(),        // display label for admin
  page: text("page").notNull(),          // "carrinho" | "checkout" | "obrigado"
  blocks: jsonb("blocks").notNull().default([]),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export type SlotRow = typeof slots.$inferSelect;

export const mediaLibrary = pgTable("media_library", {
  id: serial("id").primaryKey(),
  url: text("url").notNull(),
  alt: text("alt").notNull().default(""),
  tags: text("tags").notNull().default(""),
  isPlaceholder: boolean("is_placeholder").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export type MediaRow = typeof mediaLibrary.$inferSelect;

export const blockPresets = pgTable(
  "block_presets",
  {
    id: serial("id").primaryKey(),
    name: text("name").notNull(),
    type: text("type").notNull(),
    data: jsonb("data").notNull(),
    createdByUserId: integer("created_by_user_id").references(() => users.id, {
      onDelete: "set null",
    }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [index("block_presets_type_idx").on(t.type)],
);

export type BlockPresetRow = typeof blockPresets.$inferSelect;

export const siteConfig = pgTable(
  "site_config",
  {
    id: integer("id").primaryKey().default(1),
    theme: jsonb("theme").notNull(),
    globals: jsonb("globals").notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [check("site_config_singleton_ck", sql`${t.id} = 1`)],
);

export const orders = pgTable(
  "orders",
  {
    id: serial("id").primaryKey(),
    number: text("number").notNull(),
    customerName: text("customer_name").notNull(),
    customerEmail: text("customer_email").notNull(),
    customerPhone: text("customer_phone").notNull(),
    address: text("address").notNull(),
    postalCode: text("postal_code").notNull(),
    city: text("city").notNull(),
    nif: text("nif"),
    paymentMethod: paymentMethod("payment_method").notNull(),
    status: orderStatus("status").notNull().default("new"),
    trackingCode: text("tracking_code"),
    subtotalCents: integer("subtotal_cents").notNull(),
    couponCode: text("coupon_code"),
    discountCents: integer("discount_cents").notNull().default(0),
    notes: text("notes"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    uniqueIndex("orders_number_idx").on(t.number),
    index("orders_status_idx").on(t.status),
    index("orders_created_idx").on(t.createdAt),
  ],
);

export const customers = pgTable(
  "customers",
  {
    id: serial("id").primaryKey(),
    email: text("email").notNull(),
    name: text("name").notNull(),
    passwordHash: text("password_hash").notNull(),
    phone: text("phone").notNull().default(""),
    address: text("address").notNull().default(""),
    postalCode: text("postal_code").notNull().default(""),
    city: text("city").notNull().default(""),
    nif: text("nif"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [uniqueIndex("customers_email_idx").on(t.email)],
);

export type Customer = typeof customers.$inferSelect;
export type CustomerInsert = typeof customers.$inferInsert;

export const coupons = pgTable(
  "coupons",
  {
    id: serial("id").primaryKey(),
    code: text("code").notNull(),
    description: text("description").notNull().default(""),
    percentOff: integer("percent_off"),
    amountOffCents: integer("amount_off_cents"),
    minOrderCents: integer("min_order_cents").notNull().default(0),
    active: boolean("active").notNull().default(true),
    validUntil: timestamp("valid_until", { withTimezone: true }),
    maxUses: integer("max_uses"),
    usedCount: integer("used_count").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    uniqueIndex("coupons_code_idx").on(t.code),
    index("coupons_active_idx").on(t.active),
  ],
);

export type Coupon = typeof coupons.$inferSelect;
export type CouponInsert = typeof coupons.$inferInsert;

export const orderItems = pgTable(
  "order_items",
  {
    id: serial("id").primaryKey(),
    orderId: integer("order_id")
      .notNull()
      .references(() => orders.id, { onDelete: "cascade" }),
    productId: integer("product_id").references(() => products.id, {
      onDelete: "set null",
    }),
    productName: text("product_name").notNull(),
    productSlug: text("product_slug").notNull(),
    unitPriceCents: integer("unit_price_cents").notNull(),
    quantity: integer("quantity").notNull(),
    image: text("image"),
    personalization: jsonb("personalization").$type<{
      phrase: string;
      colors: string[];
      description: string;
      variantColor?: { name: string; hex: string };
      attachment?: { url: string; name: string; kind: "image" | "pdf" };
    } | null>(),
  },
  (t) => [index("order_items_order_idx").on(t.orderId)],
);

export const orderEvents = pgTable(
  "order_events",
  {
    id: serial("id").primaryKey(),
    orderId: integer("order_id")
      .notNull()
      .references(() => orders.id, { onDelete: "cascade" }),
    fromStatus: orderStatus("from_status"),
    toStatus: orderStatus("to_status").notNull(),
    actorUserId: integer("actor_user_id").references(() => users.id, {
      onDelete: "set null",
    }),
    note: text("note"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [index("order_events_order_idx").on(t.orderId)],
);

export const productsRelations = relations(products, ({ many }) => ({
  images: many(productImages),
  colors: many(productColors),
}));

export const productImagesRelations = relations(productImages, ({ one }) => ({
  product: one(products, {
    fields: [productImages.productId],
    references: [products.id],
  }),
}));

export const productColorsRelations = relations(productColors, ({ one }) => ({
  product: one(products, {
    fields: [productColors.productId],
    references: [products.id],
  }),
}));

export const ordersRelations = relations(orders, ({ many }) => ({
  items: many(orderItems),
  events: many(orderEvents),
}));

export const orderItemsRelations = relations(orderItems, ({ one }) => ({
  order: one(orders, {
    fields: [orderItems.orderId],
    references: [orders.id],
  }),
  product: one(products, {
    fields: [orderItems.productId],
    references: [products.id],
  }),
}));

export const orderEventsRelations = relations(orderEvents, ({ one }) => ({
  order: one(orders, {
    fields: [orderEvents.orderId],
    references: [orders.id],
  }),
  actor: one(users, {
    fields: [orderEvents.actorUserId],
    references: [users.id],
  }),
}));

export type User = typeof users.$inferSelect;
export type Product = typeof products.$inferSelect;
export type ProductImage = typeof productImages.$inferSelect;
export type ProductColor = typeof productColors.$inferSelect;
export type Page = typeof pages.$inferSelect;
export type SiteConfigRow = typeof siteConfig.$inferSelect;
export type Order = typeof orders.$inferSelect;
export type OrderItem = typeof orderItems.$inferSelect;
export type OrderEvent = typeof orderEvents.$inferSelect;
export type OrderStatus = (typeof orderStatus.enumValues)[number];
export type ProductCategorySlug = (typeof productCategory.enumValues)[number];
export type PaymentMethodId = (typeof paymentMethod.enumValues)[number];
export type UserRole = (typeof userRole.enumValues)[number];
export type TemplateRow = typeof templates.$inferSelect;
export type TemplateKind = (typeof templateKind.enumValues)[number];
export type ProductMediaKind = "image" | "video";
