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

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'leather_styles_style_color_key'
      AND conrelid = 'public.leather_styles'::regclass
  ) THEN
    ALTER TABLE public.leather_styles
      ADD CONSTRAINT leather_styles_style_color_key UNIQUE (style_color);
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS public.laser_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  entry_ts timestamptz NOT NULL,
  entry_date date GENERATED ALWAYS AS ((entry_ts AT TIME ZONE 'UTC')::date) STORED,
  name text NOT NULL,
  employee_number integer NOT NULL,
  sales_order bigint,
  leather_style_color text NOT NULL,
  pieces_cut integer NOT NULL CHECK (pieces_cut >= 0),
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT laser_entries_sales_order_7_digits_chk
    CHECK (sales_order IS NULL OR sales_order BETWEEN 1000000 AND 9999999),
  CONSTRAINT laser_entries_name_fk
    FOREIGN KEY (name)
    REFERENCES public.users (name)
    ON UPDATE CASCADE
    ON DELETE RESTRICT,
  CONSTRAINT laser_entries_employee_number_fk
    FOREIGN KEY (employee_number)
    REFERENCES public.users (employee_number)
    ON UPDATE CASCADE
    ON DELETE RESTRICT,
  CONSTRAINT laser_entries_leather_style_color_fk
    FOREIGN KEY (leather_style_color)
    REFERENCES public.leather_styles (style_color)
    ON UPDATE CASCADE
    ON DELETE RESTRICT
);

CREATE INDEX IF NOT EXISTS idx_laser_entries_entry_date
  ON public.laser_entries (entry_date);

CREATE INDEX IF NOT EXISTS idx_laser_entries_name_entry_date
  ON public.laser_entries (name, entry_date);

CREATE INDEX IF NOT EXISTS idx_laser_entries_sales_order
  ON public.laser_entries (sales_order);

CREATE INDEX IF NOT EXISTS idx_laser_entries_leather_style_color
  ON public.laser_entries (leather_style_color);

CREATE OR REPLACE VIEW public.laser_daily_totals AS
SELECT
  entry_date,
  SUM(pieces_cut) AS total_pieces_per_day
FROM public.laser_entries
GROUP BY entry_date;
