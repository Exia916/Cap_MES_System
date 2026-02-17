CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Ensure required columns exist.
ALTER TABLE IF EXISTS public.emb_type_locations
  ADD COLUMN IF NOT EXISTS id uuid DEFAULT gen_random_uuid(),
  ADD COLUMN IF NOT EXISTS emb_type text,
  ADD COLUMN IF NOT EXISTS flat_or_3d text,
  ADD COLUMN IF NOT EXISTS is_active boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS created_at timestamptz NOT NULL DEFAULT now(),
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

-- Backfill required values.
UPDATE public.emb_type_locations
SET
  id = COALESCE(id, gen_random_uuid()),
  location = NULLIF(BTRIM(location), ''),
  emb_type = NULLIF(BTRIM(emb_type), ''),
  flat_or_3d = NULLIF(BTRIM(flat_or_3d), ''),
  is_active = COALESCE(is_active, true),
  created_at = COALESCE(created_at, now()),
  updated_at = COALESCE(updated_at, now())
WHERE
  id IS NULL
  OR location IS DISTINCT FROM NULLIF(BTRIM(location), '')
  OR emb_type IS DISTINCT FROM NULLIF(BTRIM(emb_type), '')
  OR flat_or_3d IS DISTINCT FROM NULLIF(BTRIM(flat_or_3d), '')
  OR is_active IS NULL
  OR created_at IS NULL
  OR updated_at IS NULL;

-- Keep location required for lookups/FKs.
ALTER TABLE public.emb_type_locations
  ALTER COLUMN id SET NOT NULL,
  ALTER COLUMN id SET DEFAULT gen_random_uuid(),
  ALTER COLUMN location SET NOT NULL;

-- Ensure uniqueness needed by dependent FK on embroidery_location -> location.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conrelid = 'public.emb_type_locations'::regclass
      AND conname = 'emb_type_locations_location_key'
  ) THEN
    ALTER TABLE public.emb_type_locations
      ADD CONSTRAINT emb_type_locations_location_key UNIQUE (location);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conrelid = 'public.emb_type_locations'::regclass
      AND conname = 'emb_type_locations_emb_type_location_key'
  ) THEN
    ALTER TABLE public.emb_type_locations
      ADD CONSTRAINT emb_type_locations_emb_type_location_key UNIQUE (emb_type, location);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conrelid = 'public.emb_type_locations'::regclass
      AND conname = 'emb_type_locations_id_key'
  ) THEN
    ALTER TABLE public.emb_type_locations
      ADD CONSTRAINT emb_type_locations_id_key UNIQUE (id);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_emb_type_locations_location
  ON public.emb_type_locations (location);

-- Switch PK from location to id without breaking dependent FK.
DO $$
DECLARE
  pk_name text;
  pk_is_id boolean;
BEGIN
  SELECT c.conname
  INTO pk_name
  FROM pg_constraint c
  WHERE c.conrelid = 'public.emb_type_locations'::regclass
    AND c.contype = 'p';

  SELECT EXISTS (
    SELECT 1
    FROM pg_constraint c
    JOIN pg_attribute a
      ON a.attrelid = c.conrelid
     AND a.attnum = ANY(c.conkey)
    WHERE c.conrelid = 'public.emb_type_locations'::regclass
      AND c.contype = 'p'
      AND array_length(c.conkey, 1) = 1
      AND a.attname = 'id'
  )
  INTO pk_is_id;

  IF NOT pk_is_id THEN
    IF EXISTS (
      SELECT 1
      FROM pg_constraint
      WHERE conname = 'embroidery_daily_entries_location_fk'
        AND conrelid = 'public.embroidery_daily_entries'::regclass
    ) THEN
      ALTER TABLE public.embroidery_daily_entries
        DROP CONSTRAINT embroidery_daily_entries_location_fk;
    END IF;

    IF pk_name IS NOT NULL THEN
      EXECUTE format(
        'ALTER TABLE public.emb_type_locations DROP CONSTRAINT %I',
        pk_name
      );
    END IF;

    ALTER TABLE public.emb_type_locations
      ADD CONSTRAINT emb_type_locations_pkey PRIMARY KEY (id);

    ALTER TABLE public.embroidery_daily_entries
      ADD CONSTRAINT embroidery_daily_entries_location_fk
      FOREIGN KEY (embroidery_location)
      REFERENCES public.emb_type_locations (location)
      ON UPDATE CASCADE
      ON DELETE SET NULL;
  END IF;
END $$;
