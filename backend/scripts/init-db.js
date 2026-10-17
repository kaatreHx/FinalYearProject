const path = require("path");
require("dotenv").config({ path: path.join(__dirname, "..", ".env") });
const { pool } = require("../src/db");
const fs = require("fs");

/**
 * Runs db/schema.sql against the configured database.
 * Usage: npm run db:init
 */
(async () => {
  try {
    const schema = fs.readFileSync(path.join(__dirname, "..", "db", "schema.sql"), "utf8");
    await pool.query(schema);
    console.log("Database schema created/updated successfully.");
    process.exit(0);
  } catch (err) {
    console.error("Failed to initialise database:", err.message);
    process.exit(1);
  }
})();
