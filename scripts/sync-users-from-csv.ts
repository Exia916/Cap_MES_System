/* scripts/sync-users-from-csv.ts
   Usage:
     npx tsx scripts/sync-users-from-csv.ts --file AppUserList.csv           (dry run)
     npx tsx scripts/sync-users-from-csv.ts --file AppUserList.csv --apply   (write changes)
     npx tsx scripts/sync-users-from-csv.ts --file AppUserList.csv --apply --update-passwords
*/

import fs from "node:fs";
import path from "node:path";
import dotenv from "dotenv";
import { Pool } from "pg";

dotenv.config({ path: ".env.local" });

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: 10,
});

async function query<T = any>(text: string, params?: any[]) {
  const res = await pool.query(text, params);
  return res as { rows: T[]; rowCount: number };
}

type Role = "ADMIN" | "MANAGER" | "SUPERVISOR" | "USER";

type CsvRow = Record<string, string>;

function parseArgs(argv: string[]) {
  const out: Record<string, string | boolean> = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--apply") out.apply = true;
    else if (a === "--update-passwords") out.updatePasswords = true;
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
      // Ignore possible trailing \r
      rows.push(row.map((v) => v.replace(/\r$/, "")));
      row = [];
    } else {
      field += c;
    }
  }

  // last field/row (if file doesn't end with newline)
  if (field.length || row.length) {
    row.push(field.replace(/\r$/, ""));
    rows.push(row);
  }

  return rows;
}

function normalizeUsername(raw: string) {
  return (raw ?? "").trim();
}

function normalizeDisplayName(raw: string) {
  return (raw ?? "").trim();
}

function normalizeEmployeeNumber(raw: string): string | null {
  const v = (raw ?? "").trim();
  return v ? v : null;
}

function normalizeShift(raw: string): "DAY" | "NIGHT" | null {
  const v = (raw ?? "").trim().toUpperCase();
  if (v === "DAY" || v === "NIGHT") return v;
  return null;
}

function normalizeDepartment(raw: string): string | null {
  const v = (raw ?? "").trim();
  return v ? v : null;
}

function normalizeRoleAndActive(rawRole: string): { role: Role; isActive: boolean } {
  const r = (rawRole ?? "").trim();
  const lower = r.toLowerCase();

  // Spreadsheet includes: User/user, Supervisor, Admin, Inactive
  if (lower === "inactive") return { role: "USER", isActive: false };
  if (lower === "admin") return { role: "ADMIN", isActive: true };
  if (lower === "supervisor" || lower === "manager") return { role: "MANAGER", isActive: true };
  if (lower === "user") return { role: "USER", isActive: true };

  // Default
  return { role: "USER", isActive: true };
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

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const fileArg = args.file as string | undefined;
  const apply = Boolean(args.apply);
  const updatePasswords = Boolean(args.updatePasswords);

  if (!fileArg) {
    console.error("Missing --file. Example: --file AppUserList.csv");
    process.exit(1);
  }

  const filePath = path.isAbsolute(fileArg) ? fileArg : path.join(process.cwd(), fileArg);
  const csvText = fs.readFileSync(filePath, "utf8");
  const matrix = parseCsv(csvText);
  const rows = toRowsWithHeaders(matrix);

  // Expected columns from your sheet export:
  // Name, Username, Password Hash, Employee Number, Role, Shift, Department
  const COL_NAME = "Name";
  const COL_USERNAME = "Username";
  const COL_PWHASH = "Password Hash";
  const COL_EMPNO = "Employee Number";
  const COL_ROLE = "Role";
  const COL_SHIFT = "Shift";
  const COL_DEPT = "Department";

  let seen = 0;
  let skippedNoUsername = 0;

  let wouldInsert = 0;
  let wouldUpdate = 0;
  let wouldSkipNoHashNew = 0;

  for (const r of rows) {
    const username = normalizeUsername(r[COL_USERNAME]);
    if (!username) {
      skippedNoUsername++;
      continue;
    }

    seen++;

    const displayName = normalizeDisplayName(r[COL_NAME]);
    const employeeNumber = normalizeEmployeeNumber(r[COL_EMPNO]);
    const { role, isActive } = normalizeRoleAndActive(r[COL_ROLE]);
    const shift = normalizeShift(r[COL_SHIFT]);
    const department = normalizeDepartment(r[COL_DEPT]);
    const passwordHash = (r[COL_PWHASH] ?? "").trim() || null;

    const existing = await query<{
      id: string;
      username: string;
      employee_number: number | null;
      password_hash: string | null;
    }>(
      `SELECT id, username, employee_number, password_hash
       FROM users
       WHERE username = $1
          OR ($2::integer IS NOT NULL AND employee_number = $2::integer)
       ORDER BY CASE WHEN username = $1 THEN 0 ELSE 1 END
       LIMIT 1`,
      [username, employeeNumber]
    );

    const exists = existing.rows.length > 0;

    if (!exists) {
      // Don't create accounts that can't log in (unless you want to later)
      if (!passwordHash) {
        wouldSkipNoHashNew++;
        continue;
      }

      wouldInsert++;
      if (apply) {
        await query(
          `INSERT INTO users (
             username, display_name, role, is_active, employee_number, shift, department, password_hash
           )
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
          [username, displayName, role, isActive, employeeNumber, shift, department, passwordHash]
        );
      }
    } else {
      wouldUpdate++;
      if (apply) {
        if (updatePasswords && passwordHash) {
          await query(
            `UPDATE users
             SET display_name = $2,
                 role = $3,
                 is_active = $4,
                 employee_number = $5,
                 shift = $6,
                 department = $7,
                 password_hash = $8
             WHERE id = $1`,
            [existing.rows[0].id, displayName, role, isActive, employeeNumber, shift, department, passwordHash]
          );
        } else {
          await query(
            `UPDATE users
             SET display_name = $2,
                 role = $3,
                 is_active = $4,
                 employee_number = $5,
                 shift = $6,
                 department = $7
             WHERE id = $1`,
            [existing.rows[0].id, displayName, role, isActive, employeeNumber, shift, department]
          );
        }
      }
    }
  }

  console.log("=== User Sync Summary ===");
  console.log(`File: ${filePath}`);
  console.log(`Rows processed (non-empty username): ${seen}`);
  console.log(`Rows skipped (missing username): ${skippedNoUsername}`);
  console.log(`Would insert: ${wouldInsert}`);
  console.log(`Would update: ${wouldUpdate}`);
  console.log(`Would skip (new user missing password hash): ${wouldSkipNoHashNew}`);
  console.log(`Mode: ${apply ? "APPLY (writes enabled)" : "DRY RUN (no writes)"}`);
  console.log(`Update passwords: ${updatePasswords ? "YES (if hash present)" : "NO"}`);

  await pool.end();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
