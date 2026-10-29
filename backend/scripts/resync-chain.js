/**
 * Rebuild the on-chain mirror after the Hardhat node has been restarted.
 *
 * A Hardhat node keeps everything in memory, so restarting it wipes every NFT,
 * listing and request. PostgreSQL still remembers `nft_token_id`, so the app
 * then asks the chain about a token that no longer exists
 * ("ERC721NonexistentToken" / "could not decode result data").
 *
 * What this script does:
 *   1. Checks that the contracts are actually deployed on the current chain.
 *   2. For every verified/listed property, checks `ownerOf(tokenId)`.
 *   3. If the token is missing (or owned by somebody else), mints a fresh one
 *      to the recorded owner and updates the database + mint transaction hash.
 *   4. Resets 'listed' properties back to 'verified' because their on-chain
 *      listing is gone too - the owner has to list again.
 *   5. Reports requests that are still open but can no longer exist on-chain.
 *
 * Usage:
 *   cd backend && npm run chain:resync
 *
 * Run this AFTER redeploying the contracts:
 *   cd contracts && npm run deploy
 */
const { pool } = require("../src/db");
const config = require("../src/config");
const chain = require("../src/services/chain");

async function main() {
  // 1. Are the contracts on this chain at all?
  const code = await chain.provider.getCode(config.propertyNftAddress);
  if (!code || code === "0x") {
    console.error("Contracts are not deployed on the current chain.");
    console.error(`Nothing at ${config.propertyNftAddress}.`);
    console.error("Run:  cd contracts && npm run deploy   then start the backend again.");
    process.exitCode = 1;
    return;
  }

  const { rows: properties } = await pool.query("SELECT * FROM properties ORDER BY id");
  if (!properties.length) {
    console.log("No properties in the database.");
    return;
  }

  console.log(`Checking ${properties.length} propert${properties.length === 1 ? "y" : "ies"}...\n`);
  let restored = 0;
  let ok = 0;

  for (const property of properties) {
    // Properties that were never verified have no token by design.
    if (!property.nft_token_id || property.status === "pending" || property.status === "rejected") {
      console.log(`#${property.id} ${property.title}: skipped (status ${property.status})`);
      continue;
    }

    const onchainOwner = await chain.ownerOf(property.nft_token_id);
    if (onchainOwner && onchainOwner.toLowerCase() === property.owner_wallet.toLowerCase()) {
      console.log(`#${property.id} ${property.title}: OK (token ${property.nft_token_id})`);
      ok += 1;
      continue;
    }

    // Token is missing or belongs to a stale owner -> mint a fresh one.
    const tokenId = await chain.nextFreeTokenId(property.id);
    const metadataUri = `${config.publicApiUrl}/api/properties/${property.id}/metadata`;
    const receipt = await chain.mintProperty(property.owner_wallet, tokenId, metadataUri);

    await pool.query(
      `UPDATE properties
          SET status = 'verified', price = NULL, nft_token_id = $1,
              metadata_uri = $2, mint_tx_hash = $3, updated_at = NOW()
        WHERE id = $4`,
      [tokenId, metadataUri, receipt.hash, property.id]
    );

    // First owner entry, only when this property has no history yet.
    await pool.query(
      `INSERT INTO ownership_history (property_id, owner_id, owner_wallet, tx_hash)
       SELECT $1, $2, $3, $4
        WHERE NOT EXISTS (SELECT 1 FROM ownership_history WHERE property_id = $1)`,
      [property.id, property.owner_id, property.owner_wallet, receipt.hash]
    );

    console.log(
      `#${property.id} ${property.title}: re-minted token ${tokenId} -> ${property.owner_wallet}`
    );
    console.log(`   tx ${receipt.hash}`);
    if (property.status === "listed") {
      console.log("   reset from 'listed' to 'verified' - the on-chain listing was lost, list again.");
    }
    restored += 1;
  }

  // Open requests cannot survive a chain reset.
  const { rows: openRequests } = await pool.query(
    "SELECT id, status, onchain_request_id FROM requests WHERE status IN ('Pending','Accepted','GovApproved') ORDER BY id"
  );
  if (openRequests.length) {
    console.log("\nWARNING - these requests were open when the chain was reset and can no longer be completed:");
    for (const request of openRequests) {
      console.log(`  request #${request.id} (${request.status}, on-chain id ${request.onchain_request_id})`);
    }
    console.log("Reject them so the properties can be bought again.");
  }

  console.log(`\nDone. ${ok} already correct, ${restored} re-minted.`);
}

main()
  .catch((error) => {
    console.error("\nResync failed:", error.message);
    process.exitCode = 1;
  })
  .finally(() => pool.end());
