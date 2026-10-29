const { ethers, network } = require("hardhat");
const fs = require("fs");
const path = require("path");

/**
 * Prints the on-chain state that the web app shows in its UI.
 *
 * Usage (Hardhat node running + contracts deployed):
 *   npm run inspect
 *   TOKEN_IDS=1,4,6 npm run inspect
 *
 * Everything printed here is read straight from the blockchain. Nothing comes
 * from PostgreSQL, so this is the easiest way to prove in a viva that the
 * ownership really lives on-chain.
 */

const STATUS_NAMES = ["Pending", "Accepted", "GovApproved", "Paid", "Rejected"];

const fmtTime = (seconds) => new Date(Number(seconds) * 1000).toISOString();

async function main() {
  // Addresses come from the file written by scripts/deploy.js, so no .env is needed.
  const file = path.join(__dirname, "..", "deployments", "localhost.json");
  if (!fs.existsSync(file)) {
    console.log("No deployment found.");
    console.log("Start the chain in one terminal : npm run node");
    console.log("Deploy the contracts in another : npm run deploy");
    return;
  }

  const deployment = JSON.parse(fs.readFileSync(file, "utf8"));
  const { propertyNFT: nftAddress, marketplace: marketAddress, government } = deployment;

  const provider = ethers.provider;
  const nft = await ethers.getContractAt("PropertyNFT", nftAddress);
  const market = await ethers.getContractAt("LandMarketplace", marketAddress);

  const blockNumber = await provider.getBlockNumber();
  const govBalance = await provider.getBalance(government);

  console.log("=".repeat(72));
  console.log("LAND CHAIN - ON-CHAIN STATE");
  console.log("=".repeat(72));
  console.log("RPC URL          :", network.config.url || "http://127.0.0.1:8545");
  console.log("Chain id         :", String(network.config.chainId || 31337));
  console.log("Latest block     :", blockNumber);
  console.log("Government       :", government);
  console.log("Government ETH   :", ethers.formatEther(govBalance));
  console.log("PropertyNFT      :", nftAddress);
  console.log("LandMarketplace  :", marketAddress);
  console.log();

  // -------------------------------------------------------------------------
  // NFTs: owner, metadata URI and the on-chain ownership history
  // -------------------------------------------------------------------------
  const tokenIds = String(process.env.TOKEN_IDS || "1")
    .split(",")
    .map((v) => Number(v.trim()))
    .filter((v) => Number.isInteger(v) && v > 0);

  console.log("-".repeat(72));
  console.log("PROPERTY NFTs  (TOKEN_IDS=" + tokenIds.join(",") + ")");
  console.log("-".repeat(72));

  for (const tokenId of tokenIds) {
    const minted = await nft.propertyMinted(tokenId);
    if (!minted) {
      console.log(`Token #${tokenId}: not minted`);
      console.log();
      continue;
    }

    const owner = await nft.ownerOf(tokenId);
    const uri = await nft.tokenURI(tokenId);
    const history = await nft.getOwnershipHistory(tokenId);

    console.log(`Token #${tokenId}`);
    console.log("  current owner :", owner);
    console.log("  tokenURI      :", uri);
    console.log("  history       :");
    history.forEach((record, index) => {
      const tag = index === history.length - 1 ? " <-- current" : "";
      console.log(`    ${index + 1}. ${record.owner}  since ${fmtTime(record.since)}${tag}`);
    });
    console.log();
  }

  // -------------------------------------------------------------------------
  // Listings for the same tokens
  // -------------------------------------------------------------------------
  console.log("-".repeat(72));
  console.log("MARKETPLACE LISTINGS");
  console.log("-".repeat(72));

  for (const tokenId of tokenIds) {
    const listing = await market.listings(tokenId);
    console.log(`Token #${tokenId}`);
    console.log("  seller :", listing.seller);
    console.log("  price  :", `${ethers.formatEther(listing.price)} ETH (${listing.price.toString()} wei)`);
    console.log("  active :", listing.active);
    console.log();
  }

  // -------------------------------------------------------------------------
  // Every purchase request stored in the contract
  // -------------------------------------------------------------------------
  const count = Number(await market.requestCount());

  console.log("-".repeat(72));
  console.log(`PURCHASE REQUESTS  (requestCount = ${count})`);
  console.log("-".repeat(72));

  if (count === 0) {
    console.log("No requests have been created on-chain yet.");
  }

  for (let id = 1; id <= count; id += 1) {
    const request = await market.getRequest(id);
    console.log(`Request #${id}`);
    console.log("  token        :", request.tokenId.toString());
    console.log("  buyer        :", request.buyer);
    console.log("  seller       :", request.seller);
    console.log("  price        :", `${ethers.formatEther(request.price)} ETH`);
    console.log("  documentHash :", request.documentHash);
    console.log("  status       :", `${STATUS_NAMES[Number(request.status)]} (${request.status})`);
    console.log();
  }

  console.log("=".repeat(72));
  console.log("Tip: the document hash above is the SHA-256 digest of the uploaded");
  console.log("     citizenship + PAN files. The files themselves stay off-chain.");
  console.log("=".repeat(72));
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
