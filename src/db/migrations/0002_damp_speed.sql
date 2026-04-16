CREATE TABLE "site_config" (
	"id" integer PRIMARY KEY DEFAULT 1 NOT NULL,
	"theme" jsonb NOT NULL,
	"globals" jsonb NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "site_config_singleton_ck" CHECK ("site_config"."id" = 1)
);
