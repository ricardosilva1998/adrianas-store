CREATE TYPE "public"."template_kind" AS ENUM('catalog', 'product-detail');--> statement-breakpoint
CREATE TABLE "templates" (
	"id" serial PRIMARY KEY NOT NULL,
	"kind" "template_kind" NOT NULL,
	"name" text NOT NULL,
	"blocks" jsonb NOT NULL,
	"active" boolean DEFAULT false NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "templates_kind_idx" ON "templates" USING btree ("kind");--> statement-breakpoint
CREATE UNIQUE INDEX "templates_active_per_kind" ON "templates" USING btree ("kind") WHERE "templates"."active" = true;