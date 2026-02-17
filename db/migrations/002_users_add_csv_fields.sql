-- Expand existing users table to support CSV user data while preserving
-- current auth/login behavior and existing records.

-- Existing schema has:
-- - users.display_name (kept for app compatibility)
-- - users.role using enum type role
-- This migration adds missing attributes and constraints/indexes.

-- Add role values needed by CSV/import workflow.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'users'
      AND column_name = 'role'
  ) THEN
    ALTER TYPE role ADD VALUE IF NOT EXISTS 'USER';
    ALTER TYPE role ADD VALUE IF NOT EXISTS 'MANAGER';
  END IF;
END $$;

ALTER TABLE IF EXISTS public.users
  ADD COLUMN IF NOT EXISTS employee_number integer,
  ADD COLUMN IF NOT EXISTS shift text,
  ADD COLUMN IF NOT EXISTS department text;

-- username uniqueness already exists in 001_init.sql; ensure only if missing.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'users_username_key'
      AND conrelid = 'public.users'::regclass
  ) THEN
    ALTER TABLE public.users
      ADD CONSTRAINT users_username_key UNIQUE (username);
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
    WHERE conname = 'users_shift_check'
      AND conrelid = 'public.users'::regclass
  ) THEN
    ALTER TABLE public.users
      ADD CONSTRAINT users_shift_check CHECK (shift IN ('DAY', 'NIGHT'));
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS users_role_idx
  ON public.users (role);

CREATE INDEX IF NOT EXISTS users_department_idx
  ON public.users (department);
