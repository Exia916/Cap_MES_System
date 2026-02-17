import { Pool } from "pg";

declare global {
  // eslint-disable-next-line no-var
  var pgPool: Pool | undefined;
}

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error("Missing DATABASE_URL environment variable. Set DATABASE_URL in your environment before starting the app.");
}

const db =
  process.env.NODE_ENV === "production"
    ? new Pool({ connectionString })
    : (globalThis.pgPool ??= new Pool({ connectionString }));

export { db };
