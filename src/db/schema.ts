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
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";

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
    active: boolean("active").notNull().default(true),
    sortOrder: integer("sort_order").notNull().default(0),
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

export const pages = pgTable("pages", {
  slug: text("slug").primaryKey(),
  title: text("title").notNull(),
  body: text("body").notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

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
export type Order = typeof orders.$inferSelect;
export type OrderItem = typeof orderItems.$inferSelect;
export type OrderEvent = typeof orderEvents.$inferSelect;
export type OrderStatus = (typeof orderStatus.enumValues)[number];
export type ProductCategorySlug = (typeof productCategory.enumValues)[number];
export type PaymentMethodId = (typeof paymentMethod.enumValues)[number];
export type UserRole = (typeof userRole.enumValues)[number];
