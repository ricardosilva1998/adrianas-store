CREATE TABLE "slots" (
	"name" text PRIMARY KEY NOT NULL,
	"label" text NOT NULL,
	"page" text NOT NULL,
	"blocks" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
