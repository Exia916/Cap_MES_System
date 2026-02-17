// scripts/seed-admin.ts

import dotenv from "dotenv";
dotenv.config({ path: ".env.local" });

import bcrypt from "bcryptjs";
import { Pool } from "pg";

function requireEnv(name: string) {
  const value = process.env[name];
  if (!value || value.trim() === "") {
    throw new Error(`${name} is missing or empty in environment variables.`);
  }
  return value;
}

const DATABASE_URL = requireEnv("DATABASE_URL");
const ADMIN_USERNAME = requireEnv("ADMIN_USERNAME");
const ADMIN_PASSWORD = requireEnv("ADMIN_PASSWORD");
const ADMIN_DISPLAY_NAME = requireEnv("ADMIN_DISPLAY_NAME");

console.log("Seeding admin with:");
console.log("- DATABASE_URL present:", Boolean(DATABASE_URL));
console.log("- ADMIN_USERNAME:", ADMIN_USERNAME);
console.log("- ADMIN_DISPLAY_NAME:", ADMIN_DISPLAY_NAME);

const pool = new Pool({
  connectionString: DATABASE_URL,
});

async function seedAdmin() {
  const hashedPassword = await bcrypt.hash(ADMIN_PASSWORD, 10);

  await pool.query(
    `
    INSERT INTO users (
      username,
      display_name,
      password_hash,
      employee_number,
      role,
      shift,
      department,
      is_active
    )
    VALUES ($1, $2, $3, 1, 'ADMIN', 'DAY', 'IT', true)
    ON CONFLICT (username)
    DO UPDATE SET
      display_name = EXCLUDED.display_name,
      password_hash = EXCLUDED.password_hash,
      is_active = true
    `,
    [ADMIN_USERNAME, ADMIN_DISPLAY_NAME, hashedPassword]
  );

  console.log("Admin seeded/updated successfully.");
}

seedAdmin()
  .then(async () => {
    await pool.end();
    process.exit(0);
  })
  .catch(async (err) => {
    console.error(err);
    await pool.end().catch(() => {});
    process.exit(1);
  });


