CREATE EXTENSION IF NOT EXISTS pgcrypto;

ALTER TABLE IF EXISTS public.users
  ADD COLUMN IF NOT EXISTS name text,
  ADD COLUMN IF NOT EXISTS employee_number integer,
  ADD COLUMN IF NOT EXISTS shift text;

UPDATE public.users
SET name = COALESCE(name, display_name, username)
WHERE name IS NULL;

CREATE TABLE IF NOT EXISTS public.emb_type_locations (
  location text PRIMARY KEY
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'users_name_employee_number_shift_key'
      AND conrelid = 'public.users'::regclass
  ) THEN
    ALTER TABLE public.users
      ADD CONSTRAINT users_name_employee_number_shift_key
      UNIQUE (name, employee_number, shift);
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS public.embroidery_daily_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),

  entry_ts timestamptz NOT NULL,
  name text NOT NULL,
  employee_number integer NOT NULL,
  shift text NOT NULL,

  machine_number integer,
  sales_order bigint,
  detail_number integer,
  embroidery_location text,
  stitches integer,
  pieces integer,

  is_3d boolean NOT NULL DEFAULT false,
  is_knit boolean NOT NULL DEFAULT false,
  detail_complete boolean NOT NULL DEFAULT false,
  notes text,

  total_stitches bigint GENERATED ALWAYS AS ((stitches::bigint * pieces::bigint)) STORED,
  dozens numeric GENERATED ALWAYS AS ((pieces::numeric / 12.0)) STORED,
  shift_date date GENERATED ALWAYS AS (
    CASE
      WHEN (entry_ts AT TIME ZONE 'UTC')::time >= TIME '06:00'
       AND (entry_ts AT TIME ZONE 'UTC')::time < TIME '18:00'
        THEN (entry_ts AT TIME ZONE 'UTC')::date
      ELSE ((entry_ts AT TIME ZONE 'UTC')::date - 1)
    END
  ) STORED,

  CONSTRAINT embroidery_daily_entries_sales_order_7_digits_chk
    CHECK (sales_order IS NULL OR sales_order BETWEEN 1000000 AND 9999999),
  CONSTRAINT embroidery_daily_entries_stitches_nonnegative_chk
    CHECK (stitches IS NULL OR stitches >= 0),
  CONSTRAINT embroidery_daily_entries_pieces_nonnegative_chk
    CHECK (pieces IS NULL OR pieces >= 0),

  CONSTRAINT embroidery_daily_entries_user_fk
    FOREIGN KEY (name, employee_number, shift)
    REFERENCES public.users (name, employee_number, shift)
    ON UPDATE CASCADE
    ON DELETE RESTRICT,

  CONSTRAINT embroidery_daily_entries_location_fk
    FOREIGN KEY (embroidery_location)
    REFERENCES public.emb_type_locations (location)
    ON UPDATE CASCADE
    ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_embroidery_daily_entries_shift_date
  ON public.embroidery_daily_entries (shift_date);

CREATE INDEX IF NOT EXISTS idx_embroidery_daily_entries_name
  ON public.embroidery_daily_entries (name);

CREATE INDEX IF NOT EXISTS idx_embroidery_daily_entries_sales_order
  ON public.embroidery_daily_entries (sales_order);

CREATE INDEX IF NOT EXISTS idx_embroidery_daily_entries_machine_number
  ON public.embroidery_daily_entries (machine_number);

CREATE OR REPLACE VIEW public.embroidery_shift_totals AS
SELECT
  shift_date,
  SUM(total_stitches) AS shift_stitches,
  SUM(pieces) AS shift_pieces
FROM public.embroidery_daily_entries
GROUP BY shift_date;

CREATE OR REPLACE VIEW public.embroidery_shift_totals_by_person AS
SELECT
  shift_date,
  name,
  SUM(total_stitches) AS shift_stitches_by_person,
  SUM(pieces) AS shift_pieces_by_person
FROM public.embroidery_daily_entries
GROUP BY shift_date, name;
