import fs from "node:fs";
import path from "node:path";
import dotenv from "dotenv";
import { Pool, PoolClient } from "pg";

dotenv.config({ path: ".env.local" });

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: 10,
});

type CsvRow = Record<string, string>;

function parseArgs(argv: string[]) {
  const out: Record<string, string | boolean> = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--apply") out.apply = true;
    else if (a === "--file") out.file = argv[++i];
    else if (a.startsWith("--file=")) out.file = a.split("=", 2)[1];
  }
  return out;
}

// Minimal CSV parser (handles quoted fields, commas, and newlines in quotes)
function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const c = text[i];

    if (inQuotes) {
      if (c === '"') {
        const next = text[i + 1];
        if (next === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        field += c;
      }
      continue;
    }

    if (c === '"') {
      inQuotes = true;
    } else if (c === ",") {
      row.push(field);
      field = "";
    } else if (c === "\n") {
      row.push(field);
      field = "";
      rows.push(row.map((v) => v.replace(/\r$/, "")));
      row = [];
    } else {
      field += c;
    }
  }

  if (field.length || row.length) {
    row.push(field.replace(/\r$/, ""));
    rows.push(row);
  }

  return rows;
}

function toRowsWithHeaders(matrix: string[][]): { headers: string[]; rows: CsvRow[] } {
  if (matrix.length < 2) return { headers: [], rows: [] };
  const headers = matrix[0].map((h) => h.trim());
  const out: CsvRow[] = [];

  for (let i = 1; i < matrix.length; i++) {
    const r = matrix[i];
    if (r.every((cell) => !cell || !cell.trim())) continue;
    const obj: CsvRow = {};
    for (let j = 0; j < headers.length; j++) {
      obj[headers[j]] = (r[j] ?? "").trim();
    }
    out.push(obj);
  }

  return { headers, rows: out };
}

function qIdent(identifier: string): string {
  return `"${identifier.replace(/"/g, '""')}"`;
}

async function ensureSchema(client: PoolClient, hasEmbType: boolean) {
  await client.query(`CREATE EXTENSION IF NOT EXISTS pgcrypto`);

  await client.query(`
    CREATE TABLE IF NOT EXISTS public.emb_type_locations (
      location text
    )
  `);

  await client.query(`
    ALTER TABLE public.emb_type_locations
      ADD COLUMN IF NOT EXISTS id uuid DEFAULT gen_random_uuid(),
      ADD COLUMN IF NOT EXISTS emb_type text,
      ADD COLUMN IF NOT EXISTS flat_or_3d text,
      ADD COLUMN IF NOT EXISTS is_active boolean NOT NULL DEFAULT true,
      ADD COLUMN IF NOT EXISTS created_at timestamptz NOT NULL DEFAULT now(),
      ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now()
  `);

  await client.query(`
    UPDATE public.emb_type_locations
    SET
      location = NULLIF(BTRIM(location), ''),
      emb_type = NULLIF(BTRIM(emb_type), ''),
      flat_or_3d = NULLIF(BTRIM(flat_or_3d), ''),
      is_active = COALESCE(is_active, true),
      created_at = COALESCE(created_at, now()),
      updated_at = COALESCE(updated_at, now()),
      id = COALESCE(id, gen_random_uuid())
  `);

  await client.query(`
    DELETE FROM public.emb_type_locations
    WHERE location IS NULL
  `);

  await client.query(`
    ALTER TABLE public.emb_type_locations
      ALTER COLUMN id SET NOT NULL,
      ALTER COLUMN id SET DEFAULT gen_random_uuid(),
      ALTER COLUMN location SET NOT NULL
  `);

  await client.query(`
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
  `);

  await client.query(`
    DO $$
    DECLARE
      pk_name text;
      pk_on_id boolean;
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
      INTO pk_on_id;

      IF pk_name IS NULL THEN
        ALTER TABLE public.emb_type_locations
          ADD CONSTRAINT emb_type_locations_pkey PRIMARY KEY (id);
      ELSIF NOT pk_on_id THEN
        -- Keep existing PK when dependent FKs exist; enforce id uniqueness instead.
        IF NOT EXISTS (
          SELECT 1
          FROM pg_constraint
          WHERE conrelid = 'public.emb_type_locations'::regclass
            AND conname = 'emb_type_locations_id_key'
        ) THEN
          ALTER TABLE public.emb_type_locations
            ADD CONSTRAINT emb_type_locations_id_key UNIQUE (id);
        END IF;
      END IF;
    END $$;
  `);

  await client.query(`
    CREATE INDEX IF NOT EXISTS idx_emb_type_locations_location
      ON public.emb_type_locations (location)
  `);

  if (hasEmbType) {
    await client.query(`
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
    `);
  }
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const apply = Boolean(args.apply);
  const fileArg = (args.file as string | undefined) ?? "";
  if (!fileArg) {
    console.error("Missing --file. Example: --file \"C:\\path\\Emb Type and Locations.csv\"");
    process.exit(1);
  }

  const filePath = path.isAbsolute(fileArg) ? fileArg : path.join(process.cwd(), fileArg);
  const csvText = fs.readFileSync(filePath, "utf8");
  const { headers, rows } = toRowsWithHeaders(parseCsv(csvText));

  const locationHeader =
    headers.find((h) => h.toLowerCase() === "location") ??
    headers.find((h) => h.toLowerCase() === "locations");
  const embTypeHeader =
    headers.find((h) => h.toLowerCase() === "emb type") ??
    headers.find((h) => h.toLowerCase() === "emblem type");
  const flatOr3dHeader =
    headers.find((h) => h.toLowerCase() === "flat or 3d") ??
    headers.find((h) => h.toLowerCase() === "flat/3d") ??
    headers.find((h) => h.toLowerCase() === "flat or 3-d");

  if (!locationHeader) {
    throw new Error(`CSV is missing required location column. Found headers: ${headers.join(", ")}`);
  }

  const hasEmbType = Boolean(embTypeHeader);

  if (!apply) {
    console.log("=== Emb Type/Location Import Dry Run ===");
    console.log(`File: ${filePath}`);
    console.log(`Headers: ${headers.join(", ")}`);
    console.log(`Rows: ${rows.length}`);
    console.log(`Location column: ${locationHeader}`);
    console.log(`Emb Type column: ${embTypeHeader ?? "(none)"}`);
    console.log(`Flat Or 3D column: ${flatOr3dHeader ?? "(none)"}`);
    console.log("Mode: DRY RUN (no writes)");
    await pool.end();
    return;
  }

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    await ensureSchema(client, hasEmbType);

    await client.query(`DROP TABLE IF EXISTS public.stg_emb_type_locations`);

    const stagingColsSql = headers.map((h) => `${qIdent(h)} text`).join(", ");
    await client.query(`CREATE TABLE public.stg_emb_type_locations (${stagingColsSql})`);
    await client.query(`TRUNCATE TABLE public.stg_emb_type_locations`);

    const insertCols = headers.map((h) => qIdent(h)).join(", ");
    const placeholders = headers.map((_, idx) => `$${idx + 1}`).join(", ");
    const insertSql = `INSERT INTO public.stg_emb_type_locations (${insertCols}) VALUES (${placeholders})`;

    for (const r of rows) {
      const values = headers.map((h) => r[h] ?? "");
      await client.query(insertSql, values);
    }

    const hasFlatOr3d = Boolean(flatOr3dHeader);
    const upsertSql = hasEmbType || hasFlatOr3d
      ? `
        INSERT INTO public.emb_type_locations (emb_type, flat_or_3d, location, is_active, updated_at)
        SELECT
          ${
            hasEmbType
              ? `NULLIF(BTRIM(${qIdent(embTypeHeader!)}), '')`
              : `NULL::text`
          } AS emb_type,
          ${
            hasFlatOr3d
              ? `NULLIF(BTRIM(${qIdent(flatOr3dHeader!)}), '')`
              : `NULL::text`
          } AS flat_or_3d,
          NULLIF(BTRIM(${qIdent(locationHeader)}), '') AS location,
          true,
          now()
        FROM public.stg_emb_type_locations
        WHERE NULLIF(BTRIM(${qIdent(locationHeader)}), '') IS NOT NULL
        ON CONFLICT (location)
        DO UPDATE
        SET
          emb_type = EXCLUDED.emb_type,
          flat_or_3d = EXCLUDED.flat_or_3d,
          is_active = true,
          updated_at = now()
      `
      : `
        INSERT INTO public.emb_type_locations (location, is_active, updated_at)
        SELECT
          NULLIF(BTRIM(${qIdent(locationHeader)}), '') AS location,
          true,
          now()
        FROM public.stg_emb_type_locations
        WHERE NULLIF(BTRIM(${qIdent(locationHeader)}), '') IS NOT NULL
        ON CONFLICT (location)
        DO UPDATE
        SET
          is_active = true,
          updated_at = now()
      `;

    const upsertRes = await client.query(upsertSql);

    const stgCount = await client.query<{ c: number }>(
      `SELECT COUNT(*)::int AS c FROM public.stg_emb_type_locations`
    );
    const finalCount = await client.query<{ c: number }>(
      `SELECT COUNT(*)::int AS c FROM public.emb_type_locations`
    );

    await client.query("COMMIT");

    console.log("=== Emb Type/Location Import Summary ===");
    console.log(`File: ${filePath}`);
    console.log(`Headers: ${headers.join(", ")}`);
    console.log(`Staging rows loaded: ${stgCount.rows[0].c}`);
    console.log(`Rows upserted/updated: ${upsertRes.rowCount ?? 0}`);
    console.log(`Final emb_type_locations row count: ${finalCount.rows[0].c}`);
    console.log(`Location column used: ${locationHeader}`);
    console.log(`Emb Type column used: ${embTypeHeader ?? "(none)"}`);
    console.log(`Flat Or 3D column used: ${flatOr3dHeader ?? "(none)"}`);
    console.log("Mode: APPLY (writes enabled)");
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
