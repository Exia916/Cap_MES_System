import dotenv from "dotenv";
dotenv.config({ path: ".env.local" });

import bcrypt from "bcryptjs";
import { Client } from "pg";

async function main() {
  const dbUrl = process.env.DATABASE_URL;
  if (!dbUrl) throw new Error("DATABASE_URL is not set");

  const username = process.env.ADMIN_USERNAME ?? "admin";
  const password = process.env.ADMIN_PASSWORD ?? "ChangeMe123!";
  const displayName = process.env.ADMIN_DISPLAY_NAME ?? "Administrator";

  const passwordHash = await bcrypt.hash(password, 12);

  const client = new Client({ connectionString: dbUrl });
  await client.connect();

  await client.query(
    `INSERT INTO users (username, password_hash, display_name, role)
     VALUES ($1, $2, $3, 'ADMIN')
     ON CONFLICT (username) DO NOTHING`,
    [username, passwordHash, displayName]
  );

  await client.end();
  console.log(`Seeded admin (if not existing): ${username}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
