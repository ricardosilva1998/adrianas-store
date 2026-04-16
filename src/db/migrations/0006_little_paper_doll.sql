CREATE TABLE "media_library" (
	"id" serial PRIMARY KEY NOT NULL,
	"url" text NOT NULL,
	"alt" text DEFAULT '' NOT NULL,
	"tags" text DEFAULT '' NOT NULL,
	"is_placeholder" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
