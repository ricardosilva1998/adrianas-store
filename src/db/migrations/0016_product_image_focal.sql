ALTER TABLE "product_images" ADD COLUMN IF NOT EXISTS "focal_x" integer DEFAULT 50 NOT NULL;
ALTER TABLE "product_images" ADD COLUMN IF NOT EXISTS "focal_y" integer DEFAULT 50 NOT NULL;
