const fs = require("fs");
const path = require("path");
const { Pool } = require("pg");
const config = require("./config");

/**
 * Single connection pool shared across the app.
 */
const pool = new Pool({ connectionString: config.databaseUrl });

pool.on("error", (err) => {
  console.error("[db] Unexpected error on idle client:", err.message);
});

/**
 * Creates all tables (safe to run repeatedly) and seeds the government user.
 */
async function initDb() {
  const schema = fs.readFileSync(path.join(__dirname, "..", "db", "schema.sql"), "utf8");
  await pool.query(schema);

  // Make sure the government wallet always exists as an approved user.
  if (config.governmentWallet) {
    await pool.query(
      `INSERT INTO users (wallet_address, role, kyc_status, full_name)
       VALUES ($1, 'government', 'approved', 'Government Authority')
       ON CONFLICT (wallet_address)
       DO UPDATE SET role = 'government', kyc_status = 'approved'`,
      [config.governmentWallet]
    );
    console.log("[db] Government wallet registered:", config.governmentWallet);
  }
}

module.exports = { pool, initDb };
