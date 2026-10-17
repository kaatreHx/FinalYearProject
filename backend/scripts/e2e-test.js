/**
 * End-to-end smoke test for the Land Chain flow.
 *
 * It drives the real HTTP API and the deployed contracts on the local Hardhat
 * node using three Hardhat accounts:
 *   #0 = government, #1 = seller, #2 = buyer
 *
 * Run:  node scripts/e2e-test.js
 */
const { ethers } = require("ethers");
const fs = require("fs");
const path = require("path");

const API = process.env.API_URL || "http://localhost:4000";
const RPC = process.env.RPC_URL || "http://127.0.0.1:8545";

// Well-known Hardhat test accounts.
const ACCOUNTS = {
  government: {
    address: "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266",
    key: "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80",
  },
  seller: {
    address: "0x70997970C51812dc3A010C7d01b50e0d17dc79C8",
    key: "0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d",
  },
  buyer: {
    address: "0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC",
    key: "0x5de4111afa1a4b94908f83103eb1f1706367c2e68ca870fc3fb9a804cdab365a",
  },
};

const deployment = JSON.parse(
  fs.readFileSync(path.join(__dirname, "..", "..", "contracts", "deployments", "localhost.json"), "utf8")
);

const MARKET_ABI = [
  "function listProperty(uint256 tokenId, uint256 price)",
  "function createRequest(uint256 tokenId, bytes32 documentHash) returns (uint256)",
  "function acceptRequest(uint256 requestId)",
  "function payAndTransfer(uint256 requestId) payable",
  "function requestCount() view returns (uint256)",
  "function getRequest(uint256 requestId) view returns (tuple(uint256 id, uint256 tokenId, address buyer, address seller, uint256 price, bytes32 documentHash, uint8 status))",
];
const NFT_ABI = [
  "function approve(address to, uint256 tokenId)",
  "function ownerOf(uint256 tokenId) view returns (address)",
];

const provider = new ethers.JsonRpcProvider(RPC);
const wallets = {
  government: new ethers.Wallet(ACCOUNTS.government.key, provider),
  seller: new ethers.Wallet(ACCOUNTS.seller.key, provider),
  buyer: new ethers.Wallet(ACCOUNTS.buyer.key, provider),
};
// NonceManager keeps transaction nonces correct across repeated runs.
const signers = {
  government: new ethers.NonceManager(wallets.government),
  seller: new ethers.NonceManager(wallets.seller),
  buyer: new ethers.NonceManager(wallets.buyer),
};
const market = (signer) => new ethers.Contract(deployment.marketplace, MARKET_ABI, signer);
const nft = (signer) => new ethers.Contract(deployment.propertyNFT, NFT_ABI, signer);

let step = 0;
function log(msg) {
  console.log(`  ${String(++step).padStart(2, "0")}. ${msg}`);
}

async function api(pathName, { method = "GET", token, body, form } = {}) {
  const headers = {};
  if (token) headers.Authorization = `Bearer ${token}`;
  if (body) headers["Content-Type"] = "application/json";
  const res = await fetch(API + pathName, {
    method,
    headers,
    body: form ? form : body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let data;
  try {
    data = JSON.parse(text);
  } catch {
    data = { raw: text };
  }
  if (!res.ok) throw new Error(`${method} ${pathName} -> ${res.status} ${data.error || text}`);
  return data;
}

/** Full MetaMask-style login: request nonce, sign the message, verify it. */
async function login(who) {
  const wallet = wallets[who];
  const address = ACCOUNTS[who].address.toLowerCase();
  const { message } = await api("/api/auth/nonce", { method: "POST", body: { wallet: address } });
  const signature = await wallet.signMessage(message);
  const { token, user } = await api("/api/auth/verify", {
    method: "POST",
    body: { wallet: address, signature },
  });
  return { token, user };
}

/** Submit KYC unless it is already approved (makes the test re-runnable). */
async function submitKyc(form, token) {
  try {
    await api("/api/kyc", { method: "POST", token, form });
  } catch (err) {
    if (!/already approved/i.test(err.message)) throw err;
  }
}

async function main() {
  console.log("Land Chain end-to-end test\n");

  // --- Authentication -----------------------------------------------------
  const gov = await login("government");
  const seller = await login("seller");
  const buyer = await login("buyer");
  log(`logged in government=${gov.user.role}, seller, buyer`);

  // --- KYC ---------------------------------------------------------------
  const kycForm = new FormData();
  kycForm.append("fullName", "Seller One");
  kycForm.append("nationality", "Nepali");
  kycForm.append("idNumber", "ID-123456");
  kycForm.append("address", "Kathmandu");
  kycForm.append("document", new Blob([Buffer.from("fake-id-card")]), "id.txt");
  await submitKyc(kycForm, seller.token);
  log("seller KYC ready");

  const buyerKyc = new FormData();
  buyerKyc.append("fullName", "Buyer Two");
  buyerKyc.append("idNumber", "ID-999999");
  await submitKyc(buyerKyc, buyer.token);
  log("buyer KYC ready");

  const pendingKyc = await api("/api/government/kyc?status=pending", { token: gov.token });
  for (const app of pendingKyc.applications) {
    await api(`/api/government/kyc/${app.id}`, {
      method: "PATCH",
      token: gov.token,
      body: { action: "approve" },
    });
  }
  log(`government approved ${pendingKyc.applications.length} KYC application(s)`);

  // --- Property registration + verification ------------------------------
  const created = await api("/api/properties", {
    method: "POST",
    token: seller.token,
    body: {
      title: "Riverside Plot 21",
      description: "A 4-anna plot near the river.",
      location: "Pokhara, Kaski",
      propertyType: "Residential",
      areaSqft: 2200,
    },
  });
  const propertyId = created.property.id;
  log(`seller registered property #${propertyId}`);

  const pendingProps = await api("/api/government/properties?status=pending", { token: gov.token });
  const prop = pendingProps.properties.find((p) => p.id === propertyId);
  const approveProp = await api(`/api/government/properties/${prop.id}/approve`, {
    method: "PATCH",
    token: gov.token,
  });
  const tokenId = approveProp.tokenId;
  log(`government verified + minted property as NFT #${tokenId} (tx ${approveProp.txHash.slice(0, 10)}…)`);

  // --- Listing -----------------------------------------------------------
  const price = ethers.parseEther("2");
  await (await nft(signers.seller).approve(deployment.marketplace, tokenId)).wait();
  const listTx = await market(signers.seller).listProperty(tokenId, price);
  await listTx.wait();
  await api(`/api/properties/${propertyId}/list`, {
    method: "PATCH",
    token: seller.token,
    body: { price: price.toString(), txHash: listTx.hash },
  });
  log("seller listed property for 2 ETH");

  // --- Buyer request -----------------------------------------------------
  const reqForm = new FormData();
  reqForm.append("propertyId", String(propertyId));
  reqForm.append("citizenship", new Blob([Buffer.from("buyer-citizenship")]), "citizenship.txt");
  reqForm.append("pan", new Blob([Buffer.from("buyer-pan-card")]), "pan.txt");
  const requestRes = await api("/api/requests", { method: "POST", token: buyer.token, form: reqForm });
  const requestId = requestRes.request.id;
  const { tokenId: tId, documentHash } = requestRes.chain;
  log(`buyer created request #${requestId} with citizenship + PAN card (hidden from seller)`);

  // Seller must NOT see documents before accepting.
  const beforeAccept = await api(`/api/requests/${requestId}`, { token: seller.token });
  if (beforeAccept.documentsVisible) throw new Error("Documents leaked to seller before acceptance!");
  log("verified documents are hidden from seller before acceptance");

  // Create the request on-chain.
  const createTx = await market(signers.buyer).createRequest(tId, documentHash);
  await createTx.wait();
  const onchainRequestId = Number(await market(signers.buyer).requestCount());
  await api(`/api/requests/${requestId}/onchain`, {
    method: "PATCH",
    token: buyer.token,
    body: { onchainRequestId, txHash: createTx.hash },
  });
  log(`buyer linked request on-chain (onchainRequestId=${onchainRequestId})`);

  // --- Seller accepts ----------------------------------------------------
  const acceptTx = await market(signers.seller).acceptRequest(onchainRequestId);
  await acceptTx.wait();
  await api(`/api/requests/${requestId}/accept`, {
    method: "PATCH",
    token: seller.token,
    body: { txHash: acceptTx.hash },
  });
  const afterAccept = await api(`/api/requests/${requestId}`, { token: seller.token });
  if (!afterAccept.documentsVisible) throw new Error("Documents did not unlock for seller!");
  log("seller accepted; documents are now visible to the seller");

  // --- Government approves the transfer ----------------------------------
  await api(`/api/government/requests/${requestId}/approve`, { method: "PATCH", token: gov.token });
  log("government approved the transfer on-chain");

  // --- Buyer pays --------------------------------------------------------
  const payTx = await market(signers.buyer).payAndTransfer(onchainRequestId, { value: price });
  await payTx.wait();
  await api(`/api/requests/${requestId}/paid`, {
    method: "PATCH",
    token: buyer.token,
    body: { txHash: payTx.hash },
  });
  log("buyer paid; NFT transferred and payment sent to seller");

  // --- Verify final state ------------------------------------------------
  const finalProp = await api(`/api/properties/${propertyId}`);
  const onchainOwner = await nft(signers.buyer).ownerOf(tokenId);
  if (finalProp.property.ownerWallet.toLowerCase() !== ACCOUNTS.buyer.address.toLowerCase()) {
    throw new Error("DB owner did not update to buyer");
  }
  if (onchainOwner.toLowerCase() !== ACCOUNTS.buyer.address.toLowerCase()) {
    throw new Error("On-chain owner did not update to buyer");
  }
  if (finalProp.history.length !== 2) {
    throw new Error(`Expected 2 ownership records, got ${finalProp.history.length}`);
  }
  log(`final owner is buyer on-chain and in DB; history has ${finalProp.history.length} owners`);

  console.log("\nAll end-to-end steps passed.");
}

main().catch((err) => {
  console.error("\nE2E test FAILED:", err.message);
  process.exit(1);
});
