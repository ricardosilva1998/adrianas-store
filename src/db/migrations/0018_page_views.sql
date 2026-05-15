CREATE TABLE IF NOT EXISTS "page_views" (
  "id" serial PRIMARY KEY NOT NULL,
  "path" text NOT NULL,
  "visitor_hash" text NOT NULL,
  "viewed_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS "page_views_viewed_at_idx"
  ON "page_views" ("viewed_at");

CREATE INDEX IF NOT EXISTS "page_views_path_date_idx"
  ON "page_views" ("path", "viewed_at");
