const { ethers } = require("ethers");
const config = require("../config");

/**
 * Minimal ABIs - only the functions the backend needs.
 */
const NFT_ABI = [
  "function mintProperty(address to, uint256 tokenId, string uri) external",
  "function ownerOf(uint256 tokenId) view returns (address)",
  "function tokenURI(uint256 tokenId) view returns (string)",
  "function propertyMinted(uint256 tokenId) view returns (bool)",
  "function getOwnershipHistory(uint256 tokenId) view returns (tuple(address owner, uint256 since)[])",
];

const MARKETPLACE_ABI = [
  "function listProperty(uint256 tokenId, uint256 price) external",
  "function createRequest(uint256 tokenId, bytes32 documentHash) returns (uint256)",
  "function acceptRequest(uint256 requestId) external",
  "function rejectRequest(uint256 requestId) external",
  "function govApproveRequest(uint256 requestId) external",
  "function payAndTransfer(uint256 requestId) payable",
  "function getRequest(uint256 requestId) view returns (tuple(uint256 id, uint256 tokenId, address buyer, address seller, uint256 price, bytes32 documentHash, uint8 status))",
  "function listings(uint256 tokenId) view returns (uint256 tokenId, address seller, uint256 price, bool active)",
  "function requestCount() view returns (uint256)",
];

const provider = new ethers.JsonRpcProvider(config.rpcUrl);

const govWallet = config.governmentPrivateKey
  ? new ethers.Wallet(config.governmentPrivateKey, provider)
  : null;

function requireConfig() {
  if (!config.propertyNftAddress || !config.marketplaceAddress) {
    throw new Error(
      "Contract addresses missing. Deploy the contracts and set PROPERTY_NFT_ADDRESS / MARKETPLACE_ADDRESS."
    );
  }
}

function nftGov() {
  requireConfig();
  if (!govWallet) throw new Error("GOVERNMENT_PRIVATE_KEY not configured.");
  return new ethers.Contract(config.propertyNftAddress, NFT_ABI, govWallet);
}

function nftRead() {
  requireConfig();
  return new ethers.Contract(config.propertyNftAddress, NFT_ABI, provider);
}

function marketGov() {
  requireConfig();
  if (!govWallet) throw new Error("GOVERNMENT_PRIVATE_KEY not configured.");
  return new ethers.Contract(config.marketplaceAddress, MARKETPLACE_ABI, govWallet);
}

function marketRead() {
  requireConfig();
  return new ethers.Contract(config.marketplaceAddress, MARKETPLACE_ABI, provider);
}

/**
 * Fail fast with a helpful message when the configured address has no contract
 * code (e.g. the Hardhat node was restarted and the contracts were not
 * re-deployed). Without this the raw "could not decode result data" error is
 * very hard to understand.
 */
async function ensureDeployed(address, label) {
  const code = await provider.getCode(address);
  if (!code || code === "0x") {
    throw new Error(
      `${label} contract not found at ${address}. The chain may have been reset - ` +
        `run "cd contracts && npm run deploy" and check the addresses in backend/.env.`
    );
  }
}

/**
 * Send a transaction and wait for it. Hardhat mines instantly, so two fast
 * government actions can otherwise try to reuse the same nonce - retry those
 * transient errors instead of failing the request.
 */
async function sendWithRetry(makeTx, tries = 3) {
  let lastError;
  for (let attempt = 1; attempt <= tries; attempt += 1) {
    try {
      const tx = await makeTx();
      return await tx.wait();
    } catch (err) {
      lastError = err;
      const message = String((err && err.message) || err);
      const transient = /nonce|already known|replacement transaction/i.test(message);
      if (!transient || attempt === tries) throw err;
      await new Promise((resolve) => setTimeout(resolve, 750 * attempt));
    }
  }
  throw lastError;
}

/** Confirm a transaction succeeded and was sent by the expected wallet. */
async function assertSuccessfulTx(txHash, expectedFrom) {
  if (!txHash || !/^0x[a-fA-F0-9]{64}$/.test(txHash)) throw new Error("Invalid transaction hash.");
  const receipt = await provider.getTransactionReceipt(txHash);
  if (!receipt) throw new Error("Transaction not found on-chain.");
  if (receipt.status !== 1) throw new Error("Transaction failed on-chain.");
  if (expectedFrom && receipt.from.toLowerCase() !== expectedFrom.toLowerCase()) {
    throw new Error("Transaction was not sent by the expected wallet.");
  }
  return receipt;
}

/** Mint a property NFT (government only). */
async function mintProperty(to, tokenId, uri) {
  await ensureDeployed(config.propertyNftAddress, "PropertyNFT");
  return sendWithRetry(() => nftGov().mintProperty(to, tokenId, uri));
}

/** Check whether a token has already been minted (on-chain). */
async function isTokenMinted(tokenId) {
  const nft = nftRead();
  return nft.propertyMinted(tokenId);
}

/** On-chain owner of a token, or null when the token does not exist. */
async function ownerOf(tokenId) {
  try {
    return await nftRead().ownerOf(tokenId);
  } catch {
    return null; // ERC721NonexistentToken - the token was never minted.
  }
}

/**
 * First token id >= startId that has not been minted yet.
 * Used so the backend never tries to re-mint an id that is already taken.
 */
async function nextFreeTokenId(startId) {
  await ensureDeployed(config.propertyNftAddress, "PropertyNFT");
  let id = Number(startId);
  while (await isTokenMinted(id)) id += 1;
  return id;
}

/** Government approves an accepted request on-chain. */
async function govApproveRequest(onchainRequestId) {
  await ensureDeployed(config.marketplaceAddress, "LandMarketplace");
  return sendWithRetry(() => marketGov().govApproveRequest(onchainRequestId));
}

/** Government rejects a request on-chain (best-effort). */
async function govRejectRequest(onchainRequestId) {
  await ensureDeployed(config.marketplaceAddress, "LandMarketplace");
  return sendWithRetry(() => marketGov().rejectRequest(onchainRequestId));
}

async function getOnchainRequest(onchainRequestId) {
  return marketRead().getRequest(onchainRequestId);
}

const STATUS_NAMES = ["Pending", "Accepted", "GovApproved", "Paid", "Rejected"];

module.exports = {
  provider,
  govWallet,
  assertSuccessfulTx,
  mintProperty,
  govApproveRequest,
  govRejectRequest,
  isTokenMinted,
  ownerOf,
  nextFreeTokenId,
  getOnchainRequest,
  nftRead,
  marketRead,
  STATUS_NAMES,
};
