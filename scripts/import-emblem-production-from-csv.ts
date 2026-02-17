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

function normalizeEmblemType(raw: string): "Sew" | "Sticker" | "Heat Seal" | null {
  const v = (raw ?? "").trim().toLowerCase();
  if (v === "sew") return "Sew";
  if (v === "sticker") return "Sticker";
  if (v === "heat seal" || v === "heatseal" || v === "heat-seal") return "Heat Seal";
  return null;
}

function normalizeName(raw: string): string {
  return (raw ?? "").trim().replace(/\s+/g, " ");
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const apply = Boolean(args.apply);
  const fileArg = (args.file as string | undefined) ?? "";
  if (!fileArg) {
    console.error("Missing --file. Example: --file \"C:\\path\\Emblem Production.csv\"");
    process.exit(1);
  }

  const filePath = path.isAbsolute(fileArg) ? fileArg : path.join(process.cwd(), fileArg);
  const csvText = fs.readFileSync(filePath, "utf8");
  const rows = toRowsWithHeaders(parseCsv(csvText));

  const COL_TS = "Date Timestamp";
  const COL_NAME = "Name";
  const COL_EMP = "Employee Number";
  const COL_SO = "Sales Order";
  const COL_DETAIL = "Detail Number";
  const COL_TYPE = "Emblem Type";
  const COL_LOGO = "Logo Name";
  const COL_PIECES = "Pieces";
  const COL_NOTES = "Notes";

  const usersRes = await pool.query<UserRow>(
    `SELECT name, employee_number
     FROM public.users
     WHERE employee_number IS NOT NULL AND name IS NOT NULL`
  );
  const usersByEmployee = new Map<number, UserRow[]>();
  for (const u of usersRes.rows) {
    const arr = usersByEmployee.get(u.employee_number) ?? [];
    arr.push(u);
    usersByEmployee.set(u.employee_number, arr);
  }

  let seen = 0;
  let inserted = 0;
  let duplicates = 0;
  let skippedBadTimestamp = 0;
  let skippedMissingEmployee = 0;
  let skippedUnknownUser = 0;
  let skippedInvalidSalesOrder = 0;
  let skippedInvalidPieces = 0;
  let skippedInvalidEmblemType = 0;

  for (const r of rows) {
    seen++;
    const entryTs = parseDateTimestamp(r[COL_TS]);
    if (!entryTs) {
      skippedBadTimestamp++;
      continue;
    }

    const employeeNumber = parseInteger(r[COL_EMP]);
    if (employeeNumber === null) {
      skippedMissingEmployee++;
      continue;
    }

    const userCandidates = usersByEmployee.get(employeeNumber) ?? [];
    if (!userCandidates.length) {
      skippedUnknownUser++;
      continue;
    }

    const csvName = normalizeName(r[COL_NAME]);
    const matchedUser =
      userCandidates.find(
        (u) => normalizeName(u.name).toUpperCase() === csvName.toUpperCase()
      ) ?? userCandidates[0];

    const salesOrder = parseInteger(r[COL_SO]);
    if (salesOrder !== null && (salesOrder < 1000000 || salesOrder > 9999999)) {
      skippedInvalidSalesOrder++;
      continue;
    }

    const detailNumber = parseInteger(r[COL_DETAIL]);
    const emblemType = normalizeEmblemType(r[COL_TYPE]);
    if (!emblemType) {
      skippedInvalidEmblemType++;
      continue;
    }

    const pieces = parseInteger(r[COL_PIECES]);
    if (pieces === null || pieces < 0) {
      skippedInvalidPieces++;
      continue;
    }

    const logoName = (r[COL_LOGO] ?? "").trim() || null;
    const notes = (r[COL_NOTES] ?? "").trim() || null;

    if (!apply) {
      inserted++;
      continue;
    }

    const insertRes = await pool.query(
      `INSERT INTO public.emblem_entries (
         entry_ts, name, employee_number, sales_order, detail_number,
         emblem_type, logo_name, pieces, notes
       )
       SELECT
         $1, $2, $3, $4, $5,
         $6, $7, $8, $9
       WHERE NOT EXISTS (
         SELECT 1
         FROM public.emblem_entries e
         WHERE e.entry_ts = $1
           AND e.name = $2
           AND e.employee_number = $3
           AND e.sales_order IS NOT DISTINCT FROM $4
           AND e.detail_number IS NOT DISTINCT FROM $5
           AND e.emblem_type = $6
           AND e.logo_name IS NOT DISTINCT FROM $7
           AND e.pieces = $8
           AND e.notes IS NOT DISTINCT FROM $9
       )`,
      [
        entryTs,
        matchedUser.name,
        matchedUser.employee_number,
        salesOrder,
        detailNumber,
        emblemType,
        logoName,
        pieces,
        notes,
      ]
    );

    if (insertRes.rowCount && insertRes.rowCount > 0) inserted++;
    else duplicates++;
  }

  console.log("=== Emblem Production CSV Import Summary ===");
  console.log(`File: ${filePath}`);
  console.log(`Rows seen: ${seen}`);
  console.log(`Inserted: ${inserted}`);
  console.log(`Already existed (skipped): ${duplicates}`);
  console.log(`Skipped (bad timestamp): ${skippedBadTimestamp}`);
  console.log(`Skipped (missing/invalid employee number): ${skippedMissingEmployee}`);
  console.log(`Skipped (no matching user for FK): ${skippedUnknownUser}`);
  console.log(`Skipped (invalid sales order not 7 digits): ${skippedInvalidSalesOrder}`);
  console.log(`Skipped (invalid pieces): ${skippedInvalidPieces}`);
  console.log(`Skipped (invalid emblem type): ${skippedInvalidEmblemType}`);
  console.log(`Mode: ${apply ? "APPLY (writes enabled)" : "DRY RUN (no writes)"}`);

  await pool.end();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
