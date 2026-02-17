async function main() {
  const { config } = await import("dotenv");
  config({ path: ".env.local" });

  const { db } = await import("../lib/db");

  let hasFailure = false;

  try {
    await db.query("SELECT 1");
    console.log("DB CONNECT: PASS");
  } catch (error) {
    hasFailure = true;
    console.error("DB CONNECT: FAIL");
    console.error(error);
  }

  const tables = [
    "users",
    "embroidery_daily_entries",
    "qc_daily_entries",
    "emblem_entries",
    "laser_entries",
    "emb_type_locations",
    "leather_styles",
  ];

  for (const table of tables) {
    try {
      await db.query(`SELECT 1 FROM ${table} LIMIT 1`);
      console.log(`${table}: PASS`);
    } catch (error) {
      hasFailure = true;
      console.error(`${table}: FAIL`);
      console.error(error);
    }
  }

  await db.end();
  process.exit(hasFailure ? 1 : 0);
}

main().catch((error) => {
  console.error("smoke-db: FAIL");
  console.error(error);
  process.exit(1);
});
