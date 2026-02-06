-- Enable UUID generation
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Enums
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'role') THEN
    CREATE TYPE role AS ENUM ('OPERATOR','QC','SUPERVISOR','ADMIN');
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'department') THEN
    CREATE TYPE department AS ENUM ('EMBROIDERY','QC','EMBLEM','LASER');
  END IF;
END $$;

-- Users
CREATE TABLE IF NOT EXISTS users (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  username      text NOT NULL UNIQUE,
  password_hash text NOT NULL,
  display_name  text NOT NULL,
  role          role NOT NULL DEFAULT 'OPERATOR',
  is_active     boolean NOT NULL DEFAULT true,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);

-- Machines
CREATE TABLE IF NOT EXISTS machines (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name        text NOT NULL,
  department  department NOT NULL,
  is_active   boolean NOT NULL DEFAULT true,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now(),
  UNIQUE (name, department)
);

-- Orders
CREATE TABLE IF NOT EXISTS orders (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sales_order_number text NOT NULL,
  detail_number      text NULL,
  customer           text NULL,
  due_date           date NULL,
  stitch_count       integer NULL,
  pieces_ordered     integer NULL,
  created_at         timestamptz NOT NULL DEFAULT now(),
  updated_at         timestamptz NOT NULL DEFAULT now(),
  UNIQUE (sales_order_number, detail_number)
);

CREATE INDEX IF NOT EXISTS idx_orders_sales_order_number
  ON orders (sales_order_number);

CREATE INDEX IF NOT EXISTS idx_orders_detail_number
  ON orders (detail_number);

-- Production Events
CREATE TABLE IF NOT EXISTS production_events (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ts          timestamptz NOT NULL DEFAULT now(),
  shift_date  date NOT NULL,
  department  department NOT NULL,
  pieces      integer NOT NULL CHECK (pieces >= 0),
  stitches    integer NULL CHECK (stitches >= 0),
  notes       text NULL,
  user_id     uuid NOT NULL REFERENCES users(id),
  machine_id  uuid NULL REFERENCES machines(id),
  order_id    uuid NULL REFERENCES orders(id),
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_prod_shift_dept
  ON production_events (shift_date, department);

CREATE INDEX IF NOT EXISTS idx_prod_user_shift
  ON production_events (user_id, shift_date);

-- QC Events
CREATE TABLE IF NOT EXISTS qc_events (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ts            timestamptz NOT NULL DEFAULT now(),
  shift_date    date NOT NULL,
  flat_or_3d    text NOT NULL,
  inspected_qty integer NOT NULL CHECK (inspected_qty >= 0),
  rejected_qty  integer NULL CHECK (rejected_qty >= 0),
  notes         text NULL,
  user_id       uuid NOT NULL REFERENCES users(id),
  order_id      uuid NULL REFERENCES orders(id),
  created_at    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_qc_shift
  ON qc_events (shift_date);

CREATE INDEX IF NOT EXISTS idx_qc_user_shift
  ON qc_events (user_id, shift_date);

-- Updated_at trigger
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS trigger AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_users_updated_at ON users;
CREATE TRIGGER trg_users_updated_at
BEFORE UPDATE ON users
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

DROP TRIGGER IF EXISTS trg_machines_updated_at ON machines;
CREATE TRIGGER trg_machines_updated_at
BEFORE UPDATE ON machines
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

DROP TRIGGER IF EXISTS trg_orders_updated_at ON orders;
CREATE TRIGGER trg_orders_updated_at
BEFORE UPDATE ON orders
FOR EACH ROW EXECUTE FUNCTION set_updated_at();
