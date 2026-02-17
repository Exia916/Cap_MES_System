import dotenv from "dotenv";
import { Client } from "pg";

dotenv.config({ path: ".env.local" });

async function main() {
  const dbUrl = process.env.DATABASE_URL;
  if (!dbUrl) throw new Error("DATABASE_URL is not set");

  const client = new Client({ connectionString: dbUrl });
  await client.connect();

  const dbInfo = await client.query<{
    current_database: string;
    current_user: string;
    server_addr: string | null;
    server_port: number | null;
    search_path: string;
  }>(`
    SELECT
      current_database() AS current_database,
      current_user AS current_user,
      inet_server_addr()::text AS server_addr,
      inet_server_port() AS server_port,
      current_setting('search_path') AS search_path
  `);

  const exists = await client.query<{
    embroidery_daily_entries: string | null;
    embroidery_shift_totals: string | null;
    embroidery_shift_totals_by_person: string | null;
  }>(`
    SELECT
      to_regclass('public.embroidery_daily_entries')::text AS embroidery_daily_entries,
      to_regclass('public.embroidery_shift_totals')::text AS embroidery_shift_totals,
      to_regclass('public.embroidery_shift_totals_by_person')::text AS embroidery_shift_totals_by_person
  `);

  const migration = await client.query<{ applied: string }>(`
    SELECT applied_at::text AS applied
    FROM public._migrations
    WHERE filename = '003_embroidery_daily_entries.sql'
  `);

  console.log("DB:", dbInfo.rows[0]);
  console.log("Objects:", exists.rows[0]);
  console.log(
    "Migration 003 applied_at:",
    migration.rows.length ? migration.rows[0].applied : "NOT APPLIED"
  );

  await client.end();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
