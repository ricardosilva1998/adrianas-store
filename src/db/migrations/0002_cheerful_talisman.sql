CREATE TABLE "site_config" (
	"id" integer PRIMARY KEY DEFAULT 1 NOT NULL,
	"theme" jsonb NOT NULL,
	"globals" jsonb NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
ALTER TABLE "site_config" ADD CONSTRAINT "site_config_singleton_ck" CHECK (id = 1);
