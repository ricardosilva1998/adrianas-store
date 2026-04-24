ALTER TABLE "product_images" ADD COLUMN IF NOT EXISTS "kind" text DEFAULT 'image' NOT NULL;
