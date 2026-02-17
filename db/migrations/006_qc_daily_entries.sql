CREATE EXTENSION IF NOT EXISTS pgcrypto;

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

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'users_employee_number_key'
      AND conrelid = 'public.users'::regclass
  ) THEN
    ALTER TABLE public.users
      ADD CONSTRAINT users_employee_number_key UNIQUE (employee_number);
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS public.qc_daily_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  entry_ts timestamptz NOT NULL,
  entry_date date GENERATED ALWAYS AS ((entry_ts AT TIME ZONE 'UTC')::date) STORED,
  name text NOT NULL,
  employee_number integer NOT NULL,
  sales_order bigint,
  detail_number integer,
  flat_or_3d text NOT NULL,
  order_quantity integer CHECK (order_quantity >= 0),
  inspected_quantity integer NOT NULL CHECK (inspected_quantity >= 0),
  rejected_quantity integer CHECK (rejected_quantity >= 0),
  quantity_shipped integer CHECK (quantity_shipped >= 0),
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT qc_daily_entries_sales_order_7_digits_chk
    CHECK (sales_order IS NULL OR sales_order BETWEEN 1000000 AND 9999999),
  CONSTRAINT qc_daily_entries_flat_or_3d_chk
    CHECK (flat_or_3d IN ('Flat', '3D')),
  CONSTRAINT qc_daily_entries_rejected_lte_inspected_chk
    CHECK (
      rejected_quantity IS NULL
      OR inspected_quantity IS NULL
      OR rejected_quantity <= inspected_quantity
    ),
  CONSTRAINT qc_daily_entries_inspected_lte_order_chk
    CHECK (
      order_quantity IS NULL
      OR inspected_quantity IS NULL
      OR inspected_quantity <= order_quantity
    ),
  CONSTRAINT qc_daily_entries_name_fk
    FOREIGN KEY (name)
    REFERENCES public.users (name)
    ON UPDATE CASCADE
    ON DELETE RESTRICT,
  CONSTRAINT qc_daily_entries_employee_number_fk
    FOREIGN KEY (employee_number)
    REFERENCES public.users (employee_number)
    ON UPDATE CASCADE
    ON DELETE RESTRICT
);

CREATE INDEX IF NOT EXISTS idx_qc_daily_entries_entry_date
  ON public.qc_daily_entries (entry_date);

CREATE INDEX IF NOT EXISTS idx_qc_daily_entries_name_entry_date
  ON public.qc_daily_entries (name, entry_date);

CREATE INDEX IF NOT EXISTS idx_qc_daily_entries_sales_order_detail_number
  ON public.qc_daily_entries (sales_order, detail_number);

CREATE INDEX IF NOT EXISTS idx_qc_daily_entries_flat_or_3d_entry_date
  ON public.qc_daily_entries (flat_or_3d, entry_date);

CREATE OR REPLACE VIEW public.qc_daily_totals AS
SELECT
  entry_date,
  SUM(inspected_quantity) AS total_quantity_inspected_by_date,
  SUM(inspected_quantity) FILTER (WHERE flat_or_3d = 'Flat') AS flat_totals,
  SUM(inspected_quantity) FILTER (WHERE flat_or_3d = '3D') AS three_d_totals
FROM public.qc_daily_entries
GROUP BY entry_date;

CREATE OR REPLACE VIEW public.qc_daily_totals_by_person AS
SELECT
  entry_date,
  name,
  employee_number,
  SUM(inspected_quantity) AS total_quantity_inspected_by_person,
  SUM(inspected_quantity) FILTER (WHERE flat_or_3d = 'Flat') AS flat_totals_by_person,
  SUM(inspected_quantity) FILTER (WHERE flat_or_3d = '3D') AS three_d_totals_by_person
FROM public.qc_daily_entries
GROUP BY entry_date, name, employee_number;
