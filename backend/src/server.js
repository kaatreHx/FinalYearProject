const express = require("express");
const cors = require("cors");
const config = require("./config");
const { initDb } = require("./db");
const { errorHandler } = require("./middleware/error");

const authRoutes = require("./routes/auth.routes");
const kycRoutes = require("./routes/kyc.routes");
const propertyRoutes = require("./routes/properties.routes");
const requestRoutes = require("./routes/requests.routes");
const governmentRoutes = require("./routes/government.routes");

const app = express();

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.get("/health", (_req, res) => res.json({ status: "ok", service: "landchain-backend" }));

app.use("/api/auth", authRoutes);
app.use("/api/kyc", kycRoutes);
app.use("/api/properties", propertyRoutes);
app.use("/api/requests", requestRoutes);
app.use("/api/government", governmentRoutes);

app.use(errorHandler);

(async () => {
  try {
    await initDb();
  } catch (err) {
    console.error("[db] Initialisation failed:", err.message);
    console.error("Check DATABASE_URL and that PostgreSQL is running.");
  }
  app.listen(config.port, () => {
    console.log(`[server] Land Chain backend running on http://localhost:${config.port}`);
    console.log(`[server] Government wallet: ${config.governmentWallet || "(not set)"}`);
  });
})();
