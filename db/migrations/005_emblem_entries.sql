CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Required for FK(name) from emblem_entries -> users(name)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'users_name_key'
      AND conrelid = 'public.users'::regclass
  ) THEN
    ALTER TABLE public.users
      ADD CONSTRAINT users_name_key UNIQUE (name);
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS public.emblem_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  entry_ts timestamptz NOT NULL,
  entry_date date GENERATED ALWAYS AS ((entry_ts AT TIME ZONE 'UTC')::date) STORED,
  name text NOT NULL,
  employee_number integer NOT NULL,
  sales_order bigint,
  detail_number integer,
  emblem_type text NOT NULL,
  logo_name text,
  pieces integer NOT NULL CHECK (pieces >= 0),
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT emblem_entries_sales_order_7_digits_chk
    CHECK (sales_order IS NULL OR sales_order BETWEEN 1000000 AND 9999999),
  CONSTRAINT emblem_entries_emblem_type_chk
    CHECK (emblem_type IN ('Sew', 'Sticker', 'Heat Seal')),
  CONSTRAINT emblem_entries_name_fk
    FOREIGN KEY (name)
    REFERENCES public.users (name)
    ON UPDATE CASCADE
    ON DELETE RESTRICT,
  CONSTRAINT emblem_entries_employee_number_fk
    FOREIGN KEY (employee_number)
    REFERENCES public.users (employee_number)
    ON UPDATE CASCADE
    ON DELETE RESTRICT
);

CREATE INDEX IF NOT EXISTS idx_emblem_entries_entry_date
  ON public.emblem_entries (entry_date);

CREATE INDEX IF NOT EXISTS idx_emblem_entries_name_entry_date
  ON public.emblem_entries (name, entry_date);

CREATE INDEX IF NOT EXISTS idx_emblem_entries_sales_order_detail_number
  ON public.emblem_entries (sales_order, detail_number);

CREATE INDEX IF NOT EXISTS idx_emblem_entries_emblem_type_entry_date
  ON public.emblem_entries (emblem_type, entry_date);

CREATE OR REPLACE VIEW public.emblem_daily_totals AS
SELECT
  entry_date,
  SUM(pieces) AS total_pieces,
  SUM(pieces) FILTER (WHERE emblem_type = 'Sew') AS sew,
  SUM(pieces) FILTER (WHERE emblem_type = 'Sticker') AS sticker,
  SUM(pieces) FILTER (WHERE emblem_type = 'Heat Seal') AS heat_seal
FROM public.emblem_entries
GROUP BY entry_date;

CREATE OR REPLACE VIEW public.emblem_daily_totals_by_person AS
SELECT
  entry_date,
  name,
  employee_number,
  SUM(pieces) AS total_pieces_by_person,
  SUM(pieces) FILTER (WHERE emblem_type = 'Sew') AS total_sew_by_person,
  SUM(pieces) FILTER (WHERE emblem_type = 'Sticker') AS total_sticker_by_person,
  SUM(pieces) FILTER (WHERE emblem_type = 'Heat Seal') AS total_heat_seal_by_person
FROM public.emblem_entries
GROUP BY entry_date, name, employee_number;
