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

type UserRow = {
  name: string;
  employee_number: number;
  shift: string;
};

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

function toRowsWithHeaders(matrix: string[][]): CsvRow[] {
  if (matrix.length < 2) return [];
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
  return out;
}

function normalizeShift(raw: string): string | null {
  const v = (raw ?? "").trim().toUpperCase();
  if (v === "DAY") return "DAY";
  if (v === "NIGHT") return "NIGHT";
  return null;
}

function parseDateTimestamp(raw: string): Date | null {
  const v = (raw ?? "").trim();
  // Expected format M/D/YYYY H:mm
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
  if (
    month < 1 ||
    month > 12 ||
    day < 1 ||
    day > 31 ||
    hour < 0 ||
    hour > 23 ||
    minute < 0 ||
    minute > 59 ||
    second < 0 ||
    second > 59
  ) {
    return null;
  }
  return new Date(year, month - 1, day, hour, minute, second, 0);
}

function parseInteger(raw: string): number | null {
  const v = (raw ?? "").trim();
  if (!v) return null;
  const cleaned = v.replace(/,/g, "");
  if (!/^-?\d+$/.test(cleaned)) return null;
  return Number.parseInt(cleaned, 10);
}

function parseMachineNumber(raw: string): { value: number | null; coerced: boolean } {
  const v = (raw ?? "").trim();
  if (!v) return { value: null, coerced: false };
  const direct = parseInteger(v);
  if (direct !== null) return { value: direct, coerced: false };
  const prefixDigits = v.match(/^(\d+)/);
  if (!prefixDigits) return { value: null, coerced: false };
  return { value: Number.parseInt(prefixDigits[1], 10), coerced: true };
}

function parseBoolean(raw: string): boolean {
  const v = (raw ?? "").trim().toUpperCase();
  return v === "TRUE";
}

function normName(raw: string): string {
  return (raw ?? "").trim().replace(/\s+/g, " ");
}

function findBestUser(
  usersByEmployee: Map<number, UserRow[]>,
  employeeNumber: number,
  csvName: string | null,
  csvShift: string | null
): UserRow | null {
  const candidates = usersByEmployee.get(employeeNumber) ?? [];
  if (!candidates.length) return null;

  const nCsv = csvName ? normName(csvName).toUpperCase() : null;
  const sCsv = csvShift ? csvShift.toUpperCase() : null;

  const exact = candidates.find(
    (u) =>
      (!nCsv || normName(u.name).toUpperCase() === nCsv) &&
      (!sCsv || (u.shift ?? "").toUpperCase() === sCsv)
  );
  if (exact) return exact;

  if (sCsv) {
    const sameShift = candidates.find((u) => (u.shift ?? "").toUpperCase() === sCsv);
    if (sameShift) return sameShift;
  }

  if (candidates.length === 1) return candidates[0];
  return null;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const apply = Boolean(args.apply);
  const fileArg = (args.file as string | undefined) ?? "";

  if (!fileArg) {
    console.error("Missing --file. Example: --file \"C:\\path\\Embroidery Daily Production.csv\"");
    process.exit(1);
  }

  const filePath = path.isAbsolute(fileArg) ? fileArg : path.join(process.cwd(), fileArg);
  const csvText = fs.readFileSync(filePath, "utf8");
  const rows = toRowsWithHeaders(parseCsv(csvText));

  const COL_TS = "Date Timestamp";
  const COL_NAME = "Name";
  const COL_MACHINE = "Machine Number";
  const COL_SO = "Sales Order";
  const COL_DETAIL = "Detail Number";
  const COL_LOC = "Embroidery Location";
  const COL_STITCHES = "Stitches";
  const COL_PIECES = "Pieces";
  const COL_3D = "3D";
  const COL_KNIT = "Knit";
  const COL_COMPLETE = "Detail Complete";
  const COL_NOTES = "Notes";
  const COL_EMP = "Employee Number";
  const COL_SHIFT = "Shift";

  const usersRes = await pool.query<UserRow>(
    `SELECT name, employee_number, shift
     FROM public.users
     WHERE employee_number IS NOT NULL
       AND name IS NOT NULL
       AND shift IS NOT NULL`
  );
  const usersByEmployee = new Map<number, UserRow[]>();
  for (const u of usersRes.rows) {
    const arr = usersByEmployee.get(u.employee_number) ?? [];
    arr.push(u);
    usersByEmployee.set(u.employee_number, arr);
  }

  const uniqueLocations = new Set<string>();
  for (const r of rows) {
    const loc = (r[COL_LOC] ?? "").trim();
    if (loc) uniqueLocations.add(loc);
  }

  if (apply && uniqueLocations.size > 0) {
    for (const loc of uniqueLocations) {
      await pool.query(
        `INSERT INTO public.emb_type_locations (location)
         VALUES ($1)
         ON CONFLICT (location) DO NOTHING`,
        [loc]
      );
    }
  }

  let seen = 0;
  let inserted = 0;
  let duplicates = 0;
  let skippedBadTimestamp = 0;
  let skippedMissingEmployee = 0;
  let skippedUnknownUser = 0;
  let skippedInvalidSalesOrder = 0;
  let coercedMachineNumber = 0;

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

    const csvName = (r[COL_NAME] ?? "").trim() || null;
    const csvShift = normalizeShift(r[COL_SHIFT] ?? "");
    const matchedUser = findBestUser(usersByEmployee, employeeNumber, csvName, csvShift);
    if (!matchedUser) {
      skippedUnknownUser++;
      continue;
    }

    const parsedMachine = parseMachineNumber(r[COL_MACHINE] ?? "");
    if (parsedMachine.coerced) coercedMachineNumber++;

    const salesOrder = parseInteger(r[COL_SO]);
    if (salesOrder !== null && (salesOrder < 1000000 || salesOrder > 9999999)) {
      skippedInvalidSalesOrder++;
      continue;
    }

    const detailNumber = parseInteger(r[COL_DETAIL]);
    const stitches = parseInteger(r[COL_STITCHES]);
    const pieces = parseInteger(r[COL_PIECES]);

    const location = (r[COL_LOC] ?? "").trim() || null;
    const is3d = parseBoolean(r[COL_3D] ?? "");
    const isKnit = parseBoolean(r[COL_KNIT] ?? "");
    const detailComplete = parseBoolean(r[COL_COMPLETE] ?? "");
    const notes = (r[COL_NOTES] ?? "").trim() || null;

    if (!apply) {
      inserted++;
      continue;
    }

    const insertRes = await pool.query(
      `INSERT INTO public.embroidery_daily_entries (
         entry_ts, name, employee_number, shift,
         machine_number, sales_order, detail_number,
         embroidery_location, stitches, pieces,
         is_3d, is_knit, detail_complete, notes
       )
       SELECT
         $1, $2, $3, $4,
         $5, $6, $7,
         $8, $9, $10,
         $11, $12, $13, $14
       WHERE NOT EXISTS (
         SELECT 1
         FROM public.embroidery_daily_entries e
         WHERE e.entry_ts = $1
           AND e.name = $2
           AND e.employee_number = $3
           AND e.shift = $4
           AND e.machine_number IS NOT DISTINCT FROM $5
           AND e.sales_order IS NOT DISTINCT FROM $6
           AND e.detail_number IS NOT DISTINCT FROM $7
           AND e.embroidery_location IS NOT DISTINCT FROM $8
           AND e.stitches IS NOT DISTINCT FROM $9
           AND e.pieces IS NOT DISTINCT FROM $10
           AND e.is_3d = $11
           AND e.is_knit = $12
           AND e.detail_complete = $13
           AND e.notes IS NOT DISTINCT FROM $14
       )`,
      [
        entryTs,
        matchedUser.name,
        matchedUser.employee_number,
        matchedUser.shift,
        parsedMachine.value,
        salesOrder,
        detailNumber,
        location,
        stitches,
        pieces,
        is3d,
        isKnit,
        detailComplete,
        notes,
      ]
    );

    if (insertRes.rowCount && insertRes.rowCount > 0) inserted++;
    else duplicates++;
  }

  console.log("=== Embroidery CSV Import Summary ===");
  console.log(`File: ${filePath}`);
  console.log(`Rows seen: ${seen}`);
  console.log(`Inserted: ${inserted}`);
  console.log(`Already existed (skipped): ${duplicates}`);
  console.log(`Skipped (bad timestamp): ${skippedBadTimestamp}`);
  console.log(`Skipped (missing/invalid employee number): ${skippedMissingEmployee}`);
  console.log(`Skipped (no matching user for FK): ${skippedUnknownUser}`);
  console.log(`Skipped (invalid sales order not 7 digits): ${skippedInvalidSalesOrder}`);
  console.log(`Machine numbers coerced (e.g. 48a -> 48): ${coercedMachineNumber}`);
  console.log(`Mode: ${apply ? "APPLY (writes enabled)" : "DRY RUN (no writes)"}`);

  await pool.end();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
