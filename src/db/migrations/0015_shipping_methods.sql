ALTER TABLE "products" ADD COLUMN IF NOT EXISTS "shipping_methods" jsonb DEFAULT '[]'::jsonb NOT NULL;

ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "shipping_cents" integer DEFAULT 0 NOT NULL;
ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "shipping_method_label" text;
ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "shipping_method_description" text;
