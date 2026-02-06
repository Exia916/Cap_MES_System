import dotenv from "dotenv";
dotenv.config({ path: ".env.local" });

import fs from "node:fs";
import path from "node:path";
import { Client } from "pg";

const MIGRATIONS_DIR = path.join(process.cwd(), "db", "migrations");

async function main() {
  const dbUrl = process.env.DATABASE_URL;
  if (!dbUrl) {
    throw new Error("DATABASE_URL is not set");
  }

  const client = new Client({ connectionString: dbUrl });
  await client.connect();

  // Ensure migrations table exists
  await client.query(`
    CREATE TABLE IF NOT EXISTS _migrations (
      id serial PRIMARY KEY,
      filename text NOT NULL UNIQUE,
      applied_at timestamptz NOT NULL DEFAULT now()
    );
  `);

  const files = fs
    .readdirSync(MIGRATIONS_DIR)
    .filter((f) => f.endsWith(".sql"))
    .sort();

  for (const file of files) {
    const res = await client.query(
      `SELECT 1 FROM _migrations WHERE filename = $1`,
      [file]
    );

    if (res.rowCount && res.rowCount > 0) {
      continue;
    }

    const sql = fs.readFileSync(
      path.join(MIGRATIONS_DIR, file),
      "utf8"
    );

    console.log(`Applying migration: ${file}`);

    await client.query("BEGIN");
    try {
      await client.query(sql);
      await client.query(
        `INSERT INTO _migrations (filename) VALUES ($1)`,
        [file]
      );
      await client.query("COMMIT");
    } catch (err) {
      await client.query("ROLLBACK");
      throw err;
    }
  }

  await client.end();
  console.log("Migrations complete.");
}

main().catch((err) => {
  console.error("Migration failed:");
  console.error(err);
  process.exit(1);
});
