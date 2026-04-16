ALTER TABLE "pages" ADD COLUMN "blocks" jsonb DEFAULT '[]'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "pages" ADD COLUMN "published" boolean DEFAULT true NOT NULL;