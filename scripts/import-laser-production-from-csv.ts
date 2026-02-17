import fs from "node:fs";
import path from "node:path";
import dotenv from "dotenv";
import { Pool } from "pg";

dotenv.config({ path: ".env.local" });

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: 10,
});

type CsvRow = Record<string, string>;
type UserRow = { name: string; employee_number: number };

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

    if (c === '"') inQuotes = true;
    else if (c === ",") {
      row.push(field);
      field = "";
    } else if (c === "\n") {
      row.push(field);
      field = "";
      rows.push(row.map((v) => v.replace(/\r$/, "")));
      row = [];
    } else field += c;
  }

  if (field.length || row.length) {
    row.push(field.replace(/\r$/, ""));
    rows.push(row);
  }

  return rows;
}

function toRowsWithHeaders(matrix: string[][]): CsvRow[] {
  if (matrix.length < 2) return [];
  const headers = matrix[0].map((h) => h.trim());
  const out: CsvRow[] = [];
  for (let i = 1; i < matrix.length; i++) {
    const r = matrix[i];
    if (r.every((cell) => !cell || !cell.trim())) continue;
    const obj: CsvRow = {};
    for (let j = 0; j < headers.length; j++) obj[headers[j]] = (r[j] ?? "").trim();
    out.push(obj);
  }
  return out;
}

function parseDateTimestamp(raw: string): Date | null {
  const v = (raw ?? "").trim();
  const m = v.match(
    /^(\d{1,2})\/(\d{1,2})\/(\d{4})\s+(\d{1,2}):(\d{2})(?::(\d{2}))?$/
  );
  if (!m) return null;
  const month = Number(m[1]);
  const day = Number(m[2]);
  const year = Number(m[3]);
  const hour = Number(m[4]);
  const minute = Number(m[5]);
  const second = m[6] ? Number(m[6]) : 0;
  return new Date(year, month - 1, day, hour, minute, second, 0);
}

function parseInteger(raw: string): number | null {
  const v = (raw ?? "").trim();
  if (!v) return null;
  const cleaned = v.replace(/,/g, "");
  if (!/^-?\d+$/.test(cleaned)) return null;
  return Number.parseInt(cleaned, 10);
}

function normalizeName(raw: string): string {
  return (raw ?? "").trim().replace(/\s+/g, " ");
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const apply = Boolean(args.apply);
  const fileArg = (args.file as string | undefined) ?? "";
  if (!fileArg) {
    console.error("Missing --file. Example: --file \"C:\\path\\Laser Production.csv\"");
    process.exit(1);
  }

  const filePath = path.isAbsolute(fileArg) ? fileArg : path.join(process.cwd(), fileArg);
  const csvText = fs.readFileSync(filePath, "utf8");
  const rows = toRowsWithHeaders(parseCsv(csvText));

  const COL_TS = "Date Timestamp";
  const COL_NAME = "Name";
  const COL_SO = "Sales Order";
  const COL_STYLE = "Leather Style/Color";
  const COL_PIECES = "Pieces Cut";
  const COL_NOTES = "Notes";

  const usersRes = await pool.query<UserRow>(
    `SELECT name, employee_number
     FROM public.users
     WHERE name IS NOT NULL AND employee_number IS NOT NULL`
  );
  const usersByName = new Map<string, UserRow[]>();
  for (const u of usersRes.rows) {
    const key = normalizeName(u.name).toUpperCase();
    const arr = usersByName.get(key) ?? [];
    arr.push(u);
    usersByName.set(key, arr);
  }

  const styleRes = await pool.query<{ style_color: string }>(
    `SELECT style_color FROM public.leather_styles`
  );
  const styles = new Set(styleRes.rows.map((r) => (r.style_color ?? "").trim().toUpperCase()));

  let seen = 0;
  let inserted = 0;
  let duplicates = 0;
  let skippedBadTimestamp = 0;
  let skippedUnknownUser = 0;
  let skippedInvalidSalesOrder = 0;
  let skippedInvalidPieces = 0;
  let skippedMissingStyle = 0;
  let skippedUnknownStyle = 0;

  for (const r of rows) {
    seen++;

    const entryTs = parseDateTimestamp(r[COL_TS]);
    if (!entryTs) {
      skippedBadTimestamp++;
      continue;
    }

    const csvName = normalizeName(r[COL_NAME]);
    const matchedUsers = usersByName.get(csvName.toUpperCase()) ?? [];
    if (!matchedUsers.length) {
      skippedUnknownUser++;
      continue;
    }
    const matchedUser = matchedUsers[0];

    const salesOrder = parseInteger(r[COL_SO]);
    if (salesOrder !== null && (salesOrder < 1000000 || salesOrder > 9999999)) {
      skippedInvalidSalesOrder++;
      continue;
    }

    const style = (r[COL_STYLE] ?? "").trim();
    if (!style) {
      skippedMissingStyle++;
      continue;
    }
    if (!styles.has(style.toUpperCase())) {
      skippedUnknownStyle++;
      continue;
    }

    const piecesCut = parseInteger(r[COL_PIECES]);
    if (piecesCut === null || piecesCut < 0) {
      skippedInvalidPieces++;
      continue;
    }

    const notes = (r[COL_NOTES] ?? "").trim() || null;

    if (!apply) {
      inserted++;
      continue;
    }

    const res = await pool.query(
      `INSERT INTO public.laser_entries (
         entry_ts, name, employee_number, sales_order, leather_style_color, pieces_cut, notes
       )
       SELECT
         $1, $2, $3, $4, $5, $6, $7
       WHERE NOT EXISTS (
         SELECT 1
         FROM public.laser_entries e
         WHERE e.entry_ts = $1
           AND e.name = $2
           AND e.employee_number = $3
           AND e.sales_order IS NOT DISTINCT FROM $4
           AND e.leather_style_color = $5
           AND e.pieces_cut = $6
           AND e.notes IS NOT DISTINCT FROM $7
       )`,
      [
        entryTs,
        matchedUser.name,
        matchedUser.employee_number,
        salesOrder,
        style,
        piecesCut,
        notes,
      ]
    );

    if (res.rowCount && res.rowCount > 0) inserted++;
    else duplicates++;
  }

  console.log("=== Laser Production CSV Import Summary ===");
  console.log(`File: ${filePath}`);
  console.log(`Rows seen: ${seen}`);
  console.log(`Inserted: ${inserted}`);
  console.log(`Already existed (skipped): ${duplicates}`);
  console.log(`Skipped (bad timestamp): ${skippedBadTimestamp}`);
  console.log(`Skipped (no matching user): ${skippedUnknownUser}`);
  console.log(`Skipped (invalid sales order): ${skippedInvalidSalesOrder}`);
  console.log(`Skipped (invalid pieces_cut): ${skippedInvalidPieces}`);
  console.log(`Skipped (missing leather style/color): ${skippedMissingStyle}`);
  console.log(`Skipped (unknown leather style/color FK): ${skippedUnknownStyle}`);
  console.log(`Mode: ${apply ? "APPLY (writes enabled)" : "DRY RUN (no writes)"}`);

  await pool.end();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
