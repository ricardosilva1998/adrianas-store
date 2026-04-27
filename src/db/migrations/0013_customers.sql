CREATE TABLE IF NOT EXISTS "customers" (
  "id" serial PRIMARY KEY NOT NULL,
  "email" text NOT NULL,
  "name" text NOT NULL,
  "password_hash" text NOT NULL,
  "phone" text DEFAULT '' NOT NULL,
  "address" text DEFAULT '' NOT NULL,
  "postal_code" text DEFAULT '' NOT NULL,
  "city" text DEFAULT '' NOT NULL,
  "nif" text,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS "customers_email_idx" ON "customers" ("email");
