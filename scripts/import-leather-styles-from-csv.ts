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

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const apply = Boolean(args.apply);
  const fileArg = (args.file as string | undefined) ?? "";
  if (!fileArg) {
    console.error("Missing --file. Example: --file \"C:\\path\\Leather Styles.csv\"");
    process.exit(1);
  }

  const filePath = path.isAbsolute(fileArg) ? fileArg : path.join(process.cwd(), fileArg);
  const csvText = fs.readFileSync(filePath, "utf8");
  const rows = toRowsWithHeaders(parseCsv(csvText));

  const COL_STYLE_COLOR = "Style/Color";

  let seen = 0;
  let inserted = 0;
  let updated = 0;
  let skippedBlank = 0;

  for (const r of rows) {
    seen++;
    const styleColor = (r[COL_STYLE_COLOR] ?? "").trim() || null;
    if (!styleColor) {
      skippedBlank++;
      continue;
    }

    if (!apply) {
      inserted++;
      continue;
    }

    const res = await pool.query(
      `INSERT INTO public.leather_styles (style_color, is_active, updated_at)
       VALUES ($1, true, now())
       ON CONFLICT (style_color)
       DO UPDATE
       SET is_active = true,
           updated_at = now()
       RETURNING (xmax = 0) AS inserted`,
      [styleColor]
    );

    if (res.rows[0]?.inserted) inserted++;
    else updated++;
  }

  console.log("=== Leather Styles CSV Import Summary ===");
  console.log(`File: ${filePath}`);
  console.log(`Rows seen: ${seen}`);
  console.log(`Inserted: ${inserted}`);
  console.log(`Updated/reactivated: ${updated}`);
  console.log(`Skipped (blank style/color): ${skippedBlank}`);
  console.log(`Mode: ${apply ? "APPLY (writes enabled)" : "DRY RUN (no writes)"}`);

  await pool.end();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
