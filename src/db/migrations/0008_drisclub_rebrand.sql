-- Data migration: rebrand Adriana's Store -> Drisclub.
-- Idempotent: only updates the singleton site_config row when the legacy name is still present.
UPDATE "site_config"
SET
  "globals" = jsonb_set(
    jsonb_set(
      "globals",
      '{identity,name}',
      '"Drisclub"'::jsonb
    ),
    '{identity,email}',
    '"ola@drisclub.com"'::jsonb
  ),
  "theme" = jsonb_set("theme", '{logo,alt}', '"Drisclub"'::jsonb)
WHERE
  "id" = 1
  AND "globals"->'identity'->>'name' = 'Adriana''s Store';
