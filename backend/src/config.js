require("dotenv").config();
const fs = require("fs");
const path = require("path");

/**
 * Reads the deployed contract addresses from the contracts package so the
 * backend works with zero manual copying after `npm run deploy`.
 */
function readDeployment() {
  try {
    const file = path.join(__dirname, "..", "..", "contracts", "deployments", "localhost.json");
    if (fs.existsSync(file)) return JSON.parse(fs.readFileSync(file, "utf8"));
  } catch (_) {
    /* ignore */
  }
  return {};
}

const deployment = readDeployment();

const config = {
  port: Number(process.env.PORT || 4000),
  publicApiUrl: process.env.PUBLIC_API_URL || "http://localhost:4000",
  databaseUrl:
    process.env.DATABASE_URL || "postgresql://postgres:postgres@localhost:5432/landchain",
  jwtSecret: process.env.JWT_SECRET || "landchain-dev-secret",

  rpcUrl: process.env.RPC_URL || "http://127.0.0.1:8545",
  chainId: Number(process.env.CHAIN_ID || 31337),

  governmentWallet: String(process.env.GOVERNMENT_WALLET || deployment.government || "").toLowerCase(),
  governmentPrivateKey: process.env.GOVERNMENT_PRIVATE_KEY || "",

  propertyNftAddress: process.env.PROPERTY_NFT_ADDRESS || deployment.propertyNFT || "",
  marketplaceAddress: process.env.MARKETPLACE_ADDRESS || deployment.marketplace || "",

  uploadDir: path.join(__dirname, "..", "uploads"),
};

module.exports = config;
