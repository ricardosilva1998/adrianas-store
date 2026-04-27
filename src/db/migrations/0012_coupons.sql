CREATE TABLE IF NOT EXISTS "coupons" (
  "id" serial PRIMARY KEY NOT NULL,
  "code" text NOT NULL,
  "description" text DEFAULT '' NOT NULL,
  "percent_off" integer,
  "amount_off_cents" integer,
  "min_order_cents" integer DEFAULT 0 NOT NULL,
  "active" boolean DEFAULT true NOT NULL,
  "valid_until" timestamp with time zone,
  "max_uses" integer,
  "used_count" integer DEFAULT 0 NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS "coupons_code_idx" ON "coupons" ("code");
CREATE INDEX IF NOT EXISTS "coupons_active_idx" ON "coupons" ("active");

ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "coupon_code" text;
ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "discount_cents" integer DEFAULT 0 NOT NULL;
