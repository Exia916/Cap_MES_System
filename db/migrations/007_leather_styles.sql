CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS public.leather_styles (
  style_color text
);

ALTER TABLE public.leather_styles
  ADD COLUMN IF NOT EXISTS id uuid DEFAULT gen_random_uuid(),
  ADD COLUMN IF NOT EXISTS style_color text,
  ADD COLUMN IF NOT EXISTS is_active boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS created_at timestamptz NOT NULL DEFAULT now(),
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

UPDATE public.leather_styles
SET
  style_color = NULLIF(BTRIM(style_color), ''),
  is_active = COALESCE(is_active, true),
  created_at = COALESCE(created_at, now()),
  updated_at = COALESCE(updated_at, now()),
  id = COALESCE(id, gen_random_uuid())
WHERE
  style_color IS DISTINCT FROM NULLIF(BTRIM(style_color), '')
  OR is_active IS NULL
  OR created_at IS NULL
  OR updated_at IS NULL
  OR id IS NULL;

DELETE FROM public.leather_styles
WHERE style_color IS NULL;

ALTER TABLE public.leather_styles
  ALTER COLUMN id SET NOT NULL,
  ALTER COLUMN id SET DEFAULT gen_random_uuid(),
  ALTER COLUMN style_color SET NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conrelid = 'public.leather_styles'::regclass
      AND conname = 'leather_styles_pkey'
  ) THEN
    ALTER TABLE public.leather_styles
      ADD CONSTRAINT leather_styles_pkey PRIMARY KEY (id);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conrelid = 'public.leather_styles'::regclass
      AND conname = 'leather_styles_style_color_key'
  ) THEN
    ALTER TABLE public.leather_styles
      ADD CONSTRAINT leather_styles_style_color_key UNIQUE (style_color);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_leather_styles_style_color
  ON public.leather_styles (style_color);
