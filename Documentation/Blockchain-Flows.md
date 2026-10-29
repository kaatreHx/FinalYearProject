# Land Chain — Blockchain Flow Notes

> Practical notes for the viva: **who** calls **which** contract method, **how** the backend talks to the chain,
> **what** is actually stored on-chain, and **how** ownership is shown in the UI.
>
> Every code reference below is from this repository.

---

## 0. The mental model (read this first)

The system keeps **two copies of the truth**, and they have different jobs:

| | Blockchain (Hardhat + Solidity) | PostgreSQL (backend) |
|---|---|---|
| **Authoritative for** | Who owns a property token, listing price, request existence + status, buyer document hash, ownership history (address + timestamp) | Names, emails, phones, KYC data, photos, uploaded files, readable statuses, searchable listings |
| **Access** | `eth_call` (free reads), transactions (cost gas) | SQL |
| **Can be edited?** | No — append-only ledger | Yes — normal application data |
| **Survives a restart?** | No (local Hardhat node is in-memory) | Yes |

**The rule the code follows:**

> The chain decides ownership. PostgreSQL is a fast, searchable mirror plus a home for private data.
> After every write transaction, the backend **re-reads the chain** before it updates PostgreSQL.

So when you are asked *"where is the land record stored?"* the correct answer is:

- The **proof of ownership** (NFT) and the **hash of the documents** are on-chain.
- The **documents themselves**, photos, names and phone numbers are off-chain in PostgreSQL + disk.
- `tokenURI` on-chain is just a URL pointing to a JSON metadata endpoint served by the backend.

---

## 1. The moving parts

```
┌──────────────────────┐        HTTP + JWT        ┌──────────────────────┐
│  React frontend      │ ───────────────────────► │  Express backend     │
│  (Vite, :5173)       │ ◄─────────────────────── │  (:4000)             │
│                      │                          │                      │
│  MetaMask signer     │                          │  govWallet           │
│  (user's key)        │                          │  (private key)       │
└──────────┬───────────┘                          └───────┬──────────────┘
           │ JSON-RPC (eth_sendRawTransaction)             │ JSON-RPC
           │                                               │
           └──────────────────────┬────────────────────────┘
                                  ▼
                    ┌──────────────────────────────┐
                    │  Hardhat node  :8545          │
                    │  chainId 31337                │
                    │  PropertyNFT + LandMarketplace│
                    └──────────────────────────────┘
                                  ▲
                                  │ tokenURI / metadata (HTTP)
                                  │
                            Express backend
```

### Deployed addresses

These are deterministic for a fresh Hardhat node (account #0 deploys them):

| Contract | Address |
|---|---|
| `PropertyNFT` | `0x5FbDB2315678afecb367f032d93F642f64180aa3` |
| `LandMarketplace` | `0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512` |
| Government wallet (Hardhat account #0) | `0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266` |

Where they come from:

- `contracts/scripts/deploy.js` deploys both contracts and writes `contracts/deployments/localhost.json`.
- `backend/src/config.js` reads that JSON automatically, so you normally do **not** have to copy addresses into `.env`.
- `frontend/src/lib/ethers.js` reads `VITE_PROPERTY_NFT_ADDRESS` / `VITE_MARKETPLACE_ADDRESS` from `frontend/.env`.

---

## 2. The two doors into the blockchain

There are exactly **two ways** a contract method gets called in this project. Being able to point at them is the core of the viva answer.

### 2.1 Door A — the user's wallet (MetaMask, frontend)

Used for actions that must be **signed by the user**: listing, requesting, accepting, paying.

```js
// frontend/src/lib/ethers.js
export async function getSigner() {
  const provider = new ethers.BrowserProvider(window.ethereum); // EIP-1193 provider
  return provider.getSigner();                                  // wraps the MetaMask account
}

export const marketContract = (runner) =>
  new ethers.Contract(MARKETPLACE_ADDRESS, MARKETPLACE_ABI, runner);
```

Call site (`frontend/src/pages/RequestDetail.jsx`):

```js
const signer = await getSigner();
const market = marketContract(signer);
const tx = await market.payAndTransfer(r.onchainRequestId, { value: BigInt(r.price) });
await tx.wait();                                   // wait for the block
await api.patch(`/api/requests/${r.id}/paid`, { txHash: tx.hash });
```

What happens under the hood:

1. ethers builds the transaction (`to`, `data`, `value`, `gas`, `nonce`, `chainId`).
2. MetaMask shows a confirmation popup and **signs with the user's private key** (the key never leaves the extension).
3. MetaMask forwards the signed raw transaction to its RPC (`eth_sendRawTransaction`); the node never sees the private key.
4. Hardhat mines a block, the EVM executes the function, storage changes, events are emitted.
5. `tx.wait()` resolves with a **receipt** `{ status: 1, hash, blockNumber, gasUsed }`.
6. The frontend sends the **hash** to the backend as proof.

### 2.2 Door B — the backend's government wallet (no MetaMask)

Used for actions only the government may perform: **minting** and **approving a transfer**.

```js
// backend/src/services/chain.js
const provider = new ethers.JsonRpcProvider(config.rpcUrl);

const govWallet = config.governmentPrivateKey
  ? new ethers.Wallet(config.governmentPrivateKey, provider) // key loaded from backend/.env
  : null;

function nftGov() {
  return new ethers.Contract(config.propertyNftAddress, NFT_ABI, govWallet);
}

async function mintProperty(to, tokenId, uri) {
  await ensureDeployed(config.propertyNftAddress, "PropertyNFT");
  return sendWithRetry(() => nftGov().mintProperty(to, tokenId, uri));
}
```

Here ethers itself signs and sends — there is no browser involved. The HTTP route is protected by
`requireAuth` + `requireGovernment` (`backend/src/middleware/auth.js`), and the **contract** independently
enforces `onlyOwner`, so even a leaked JWT cannot mint from a non-government wallet.

### 2.3 Reads (free, no signature, no gas)

Reads use the provider only:

```js
function nftRead() {
  return new ethers.Contract(config.propertyNftAddress, NFT_ABI, provider);
}
// usage: await chain.nftRead().ownerOf(tokenId)
```

`eth_call` executes the function against the latest state and returns the result **without creating a transaction**.

### 2.4 Anatomy of a write transaction

```
sign (secp256k1) ──► eth_sendRawTransaction ──► mempool ──► block ──► receipt
                                                                      │
                                    storage slot writes + event logs ◄─┘
```

Important properties:

- **Nonce** = per-account transaction counter. Two government transactions fired quickly can race → `sendWithRetry()` handles `nonce` / `already known` errors.
- **Gas** = fee paid to execute. Hardhat gives test ETH, but MetaMask still shows an estimated fee.
- **Revert** = the whole transaction is undone, including storage writes and ETH transfers (`require(...)` failed).
- **Receipt status 1** = success, `0` = reverted. The backend checks this in `assertSuccessfulTx()`.

---

## 3. What is actually stored on-chain

### 3.1 `PropertyNFT.sol`

| Storage | Type | Meaning |
|---|---|---|
| `_owners[tokenId]` | `mapping(uint256 => address)` | ERC721 owner — **the current owner** |
| `_balances[address]` | `mapping(address => uint256)` | how many properties an address owns |
| `_tokenURIs[tokenId]` | `mapping(uint256 => string)` | metadata URL (`ERC721URIStorage`) |
| `propertyMinted[tokenId]` | `mapping(uint256 => bool)` | prevents double minting |
| `_ownershipHistory[tokenId]` | `array of {address owner, uint256 since}` | append-only ownership trail |

```solidity
function mintProperty(address to, uint256 tokenId, string memory uri) external onlyOwner {
    require(!propertyMinted[tokenId], "PropertyNFT: token already minted");
    propertyMinted[tokenId] = true;

    _safeMint(to, tokenId);          // writes _owners[tokenId] = to
    _setTokenURI(tokenId, uri);      // writes _tokenURIs[tokenId] = uri

    _ownershipHistory[tokenId].push(OwnershipRecord({ owner: to, since: block.timestamp }));

    emit PropertyMinted(tokenId, to, uri);
}
```

Every later transfer is captured by the OpenZeppelin v5 hook:

```solidity
function _update(address to, uint256 tokenId, address auth) internal override returns (address) {
    address from = super._update(to, tokenId, auth);   // does the real owner change
    if (from != address(0)) {                          // skip mint (handled above)
        _ownershipHistory[tokenId].push(OwnershipRecord({ owner: to, since: block.timestamp }));
    }
    return from;
}
```

> Because `_update` is called by `transferFrom`, `safeTransferFrom` **and** mint/burn, no transfer can
> silently skip the history. This is the cleanest "blockchain" answer you can give.

### 3.2 `LandMarketplace.sol`

| Storage | Type | Meaning |
|---|---|---|
| `listings[tokenId]` | `{tokenId, seller, price, active}` | the sale offer |
| `requests[id]` | `{id, tokenId, buyer, seller, price, documentHash, status}` | a purchase request |
| `requestCount` | `uint256` | id counter (ids start at 1) |

`status` is an enum stored as a `uint8`:

| Value | Name | Meaning |
|---|---|---|
| 0 | `Pending` | buyer created the request |
| 1 | `Accepted` | seller accepted |
| 2 | `GovApproved` | government approved the transfer |
| 3 | `Paid` | paid + ownership transferred |
| 4 | `Rejected` | rejected by seller or government |

### 3.3 What is deliberately **not** on-chain

| Data | Where it lives | Why not on-chain |
|---|---|---|
| Property title, description, location, area | `properties` table | strings are expensive; may need correction |
| Photos | `backend/uploads/properties` | too large |
| Citizenship / PAN scans | `backend/uploads/documents` | **private** — a blockchain is public forever |
| Ownership certificates | `backend/uploads/ownership` | private, access-controlled |
| Names, emails, phones, KYC | `users`, `kyc` | personal data (privacy law) |
| NFT metadata JSON | `/api/properties/:id/metadata` | only the URL is stored on-chain |

The buyer's document hash **is** on-chain because it is a fixed 32-byte fingerprint that proves
"these exact files were submitted with this request" without revealing them.

### 3.4 How the hash is produced

`backend/src/utils/hash.js`:

```js
function hashFiles(files) {
  const parts = files
    .map((f) => crypto.createHash("sha256").update(fs.readFileSync(f.path)).digest("hex"))
    .sort();                                  // order-independent
  const combined = parts.join("");
  return "0x" + crypto.createHash("sha256").update(combined).digest("hex");
}
```

- Each file → SHA-256.
- Sort the hex strings (so citizenship-first or PAN-first gives the same result).
- Hash the concatenation → a 32-byte value → `bytes32 documentHash`.
- The individual file hashes are also stored in `documents.file_hash` (SQL) for per-file integrity checks.

---

## 4. Every flow, end to end

Legend: **🦊 = MetaMask signature** · **🏛 = backend government key** · **📖 = read-only**

### 4.1 Login — signature, not a transaction

No contract is touched, no gas is spent.

```
Browser                         Backend
  │ POST /api/auth/nonce {wallet}   │
  │────────────────────────────────►│  stores a random nonce in users.nonce
  │◄────────────────────────────────│  returns the message to sign
  │                                 │
  │ MetaMask personal_sign          │
  │ (signs text, no blockchain tx)  │
  │ POST /api/auth/verify           │
  │ {wallet, signature}             │
  │────────────────────────────────►│  ethers.verifyMessage() recovers the address
  │                                 │  compares with wallet → issues JWT
  │◄────────────────────────────────│  rotates nonce (no replay)
```

Key line (`backend/src/routes/auth.routes.js`):

```js
recovered = ethers.verifyMessage(buildMessage(wallet, user.nonce), signature);
if (recovered.toLowerCase() !== wallet) return res.status(401).json({ ... });
```

`GOVERNMENT_WALLET` matching this address is what makes the account `role = 'government'`.

### 4.2 KYC — no blockchain at all

Upload → `kyc` table → government approves → `users.kyc_status = 'approved'`.
`requireKyc` then unlocks property registration and purchase requests. This is pure PostgreSQL.

### 4.3 Register a property — no blockchain yet

`POST /api/properties` (`RegisterProperty.jsx`) writes:

- a `properties` row with `status = 'pending'`
- `property_images` rows (photos)
- `property_documents` rows (ownership certificates — **required**)

There is **no NFT yet**. A property only becomes a token after the government verifies it.
This is the answer to *"when does the property enter the blockchain?"* → at minting, not at registration.

### 4.4 Government verifies → **mint** 🏛

Triggered from the government dashboard: `PATCH /api/government/properties/:id/approve`.

```
Express                                  Hardhat node
  │ 1. nextFreeTokenId(property.id) ──────► propertyMinted(id)? increment
  │ 2. mintProperty(owner, tokenId, uri) ─► PropertyNFT.mintProperty()
  │                                          onlyOwner ✓
  │                                          propertyMinted = true
  │                                          _safeMint → _owners[tokenId] = owner
  │                                          _setTokenURI
  │                                          push ownership history
  │◄──────────────── receipt.hash ──────────┘
  │ 3. UPDATE properties SET status='verified', nft_token_id, metadata_uri, mint_tx_hash
  │ 4. INSERT first ownership_history row (if none)
```

The metadata URI is `http://localhost:4000/api/properties/<id>/metadata`, and that endpoint
(`properties.routes.js`) returns ERC721 JSON:

```json
{
  "name": "Pokhara Lakeside Land",
  "description": "...",
  "image": "http://localhost:4000/api/properties/6/images/9",
  "attributes": [{ "trait_type": "Location", "value": "..." }, ...]
}
```

> **Viva point:** the NFT stores the *URL*, not the JSON. If the backend is down, the image and
> attributes disappear, but **ownership does not** — `ownerOf()` still works from the chain.

Why `nextFreeTokenId()` exists: normally `tokenId == property.id`, but after a chain reset an old
token may still exist. The helper walks forward until it finds an unminted id, and
`government.routes.js` also refuses to reuse a token whose on-chain owner is someone else.

### 4.5 List for sale 🦊

`PropertyDetail.jsx` → two MetaMask confirmations:

```js
const approved = await nft.getApproved(p.nftTokenId);
if (approved.toLowerCase() !== MARKETPLACE_ADDRESS.toLowerCase()) {
  const approveTx = await nft.approve(MARKETPLACE_ADDRESS, p.nftTokenId);  // tx 1
  await approveTx.wait();
}
const listTx = await market.listProperty(p.nftTokenId, wei);               // tx 2
await listTx.wait();
await api.patch(`/api/properties/${p.id}/list`, { price: wei.toString(), txHash: listTx.hash });
```

The contract checks (`LandMarketplace.listProperty`):

```solidity
require(propertyNFT.ownerOf(tokenId) == msg.sender, "Marketplace: not the owner");
require(price > 0, "Marketplace: price must be > 0");
require(propertyNFT.getApproved(tokenId) == address(this) ||
        propertyNFT.isApprovedForAll(msg.sender, address(this)), "Marketplace: approve NFT first");
```

Backend verification (`properties.routes.js`):

```js
await chain.assertSuccessfulTx(txHash, req.user.wallet_address);
const listing = await chain.marketRead().listings(property.nft_token_id);
if (!listing.active || listing.seller.toLowerCase() !== req.user.wallet_address) {
  return res.status(400).json({ error: "On-chain listing not found." });
}
```

> The `approve` transaction is the seller's permission for the marketplace to move **this one token**
> later, at payment time. That is why the buyer can complete the transfer without the seller signing again.

### 4.6 Buyer sends a purchase request 🦊

Step 1 — upload + DB row (`POST /api/requests`, multipart):

```js
const documentHash = hashFiles(attachments.map((a) => a.file));

INSERT INTO requests (..., status, document_hash, documents_visible_to_seller)
VALUES (..., 'Pending', documentHash, FALSE);

// one row per file, doc_type = 'citizenship' | 'pan'
INSERT INTO documents (request_id, file_name, file_path, file_hash, doc_type, visible_to_seller)
VALUES (..., 'citizenship', FALSE);
```

The response includes exactly what the chain call needs:

```json
{
  "request": { "id": 7, ... },
  "chain": { "tokenId": 6, "documentHash": "0x…", "price": "…", "sellerWallet": "0x…" }
}
```

Step 2 — MetaMask:

```js
const tx = await market.createRequest(tokenId, documentHash);
await tx.wait();
const onchainRequestId = Number(await market.requestCount());
await api.patch(`/api/requests/${res.request.id}/onchain`, { onchainRequestId, txHash: tx.hash });
```

The contract **snapshots** the price into the request:

```solidity
require(listing.active, "Marketplace: property not listed");
require(listing.seller != msg.sender, "Marketplace: cannot buy your own property");
requests[++requestCount] = PurchaseRequest({
    id: requestCount, tokenId, buyer: msg.sender, seller: listing.seller,
    price: listing.price, documentHash, status: RequestStatus.Pending
});
```

So if the seller changes the listing later, **this request keeps its original price**.
The document hash is now immutable and public, but the files are not.

### 4.7 Seller accepts 🦊

```js
const tx = await market.acceptRequest(r.onchainRequestId);
await tx.wait();
await api.patch(`/api/requests/${r.id}/accept`, { txHash: tx.hash });
```

Contract: `require(request.seller == msg.sender)`, `require(status == Pending)` → `Accepted`.

Backend: verifies the receipt, then

```sql
UPDATE requests SET status='Accepted', documents_visible_to_seller=TRUE, accept_tx_hash=$1 ...
UPDATE documents SET visible_to_seller=TRUE WHERE request_id=$1
```

This is the **only** place the seller gains access to the buyer's citizenship/PAN files.
Before acceptance, `GET /api/requests/:id` returns an empty `documents` array for the seller.

### 4.8 Government approves the transfer 🏛

`PATCH /api/government/requests/:id/approve`:

```js
const receipt = await chain.govApproveRequest(request.onchain_request_id);
await pool.query("UPDATE requests SET status='GovApproved', approve_tx_hash=$1 ...");
```

Contract:

```solidity
function govApproveRequest(uint256 requestId) external onlyOwner {
    require(requests[requestId].status == RequestStatus.Accepted, "Marketplace: seller must accept first");
    requests[requestId].status = RequestStatus.GovApproved;
}
```

Only now does the buyer's UI show the **Pay** button.

### 4.9 Pay + transfer — the important transaction 🦊

```
Buyer (MetaMask)                LandMarketplace                 PropertyNFT
      │ payAndTransfer(id)            │                             │
      │ { value: price }              │                             │
      │──────────────────────────────►│ checks:                     │
      │                               │  buyer == msg.sender        │
      │                               │  status == GovApproved      │
      │                               │  msg.value == price         │
      │                               │  seller still owns token    │
      │                               │                             │
      │                               │ status = Paid               │
      │                               │ listing.active = false      │
      │                               │                             │
      │                               │ safeTransferFrom ──────────►│ _owners[token] = buyer
      │                               │                             │ _update → history.push(buyer)
      │                               │                             │
      │                               │ seller.call{value} ─────────┼──► seller receives ETH
      │◄──── receipt (status 1) ──────│                             │
```

```solidity
function payAndTransfer(uint256 requestId) external payable nonReentrant {
    PurchaseRequest storage request = requests[requestId];
    require(request.buyer == msg.sender, "Marketplace: not the buyer");
    require(request.status == RequestStatus.GovApproved, "Marketplace: not approved");
    require(msg.value == request.price, "Marketplace: incorrect payment");
    require(propertyNFT.ownerOf(request.tokenId) == request.seller, "Marketplace: seller no longer owns the property");

    request.status = RequestStatus.Paid;
    listings[request.tokenId].active = false;

    propertyNFT.safeTransferFrom(request.seller, request.buyer, request.tokenId);
    (bool sent, ) = payable(request.seller).call{ value: msg.value }("");
    require(sent, "Marketplace: payment failed");
}
```

Things worth saying out loud:

- **Atomic:** NFT and ETH move in one transaction. If the ETH transfer fails, the NFT transfer is rolled back too.
- **Checks → Effects → Interactions:** status/listing are updated *before* the external transfer and payment.
- **`nonReentrant`:** the seller cannot re-enter `payAndTransfer` while being paid.
- **Exact payment:** `msg.value == price`, no over/underpayment.
- **Seller needs no second signature:** the earlier `approve` is what lets the marketplace transfer the token.

Then the backend confirms (`PATCH /api/requests/:id/paid`):

```js
await chain.assertSuccessfulTx(txHash, req.user.wallet_address);       // receipt.status === 1, sent by buyer

const onchain = await chain.getOnchainRequest(request.onchain_request_id);
if (Number(onchain.status) !== 3) return res.status(400).json({ error: "On-chain payment not completed." });

const onchainOwner = await chain.nftRead().ownerOf(property.nft_token_id);
if (onchainOwner.toLowerCase() !== req.user.wallet_address) {
  return res.status(400).json({ error: "On-chain ownership not transferred to buyer." });
}
```

Only after those three checks does PostgreSQL change:

```sql
UPDATE ownership_history SET ended_at = NOW() WHERE property_id=$1 AND ended_at IS NULL;
INSERT INTO ownership_history (property_id, owner_id, owner_wallet, price, tx_hash) VALUES (...);
UPDATE properties SET owner_id=$1, owner_wallet=$2, status='verified', price=NULL WHERE id=$3;
```

### 4.10 Rejections

| Who | Where | On-chain | DB |
|---|---|---|---|
| Seller | `RequestDetail.jsx` | `rejectRequest(id)` 🦊 (best-effort) | `status='Rejected'` |
| Government | `PATCH /api/government/requests/:id/reject` | `govRejectRequest(id)` 🏛 (best-effort) | `status='Rejected'` |

```solidity
require(request.seller == msg.sender || owner() == msg.sender, "Marketplace: not authorized");
require(status == Pending || status == Accepted, "Marketplace: cannot reject now");
request.status = RequestStatus.Rejected;
listings[request.tokenId].active = false;   // the property leaves the marketplace
```

### 4.11 How ownership is shown

Two different sources are used on purpose:

**Current owner card** (`PropertyDetail.jsx`):

```jsx
<dt>Current owner</dt>
<dd>{p.ownerName} <span className="mono muted">({shortAddr(p.ownerWallet)})</span></dd>
```

`p.ownerWallet` comes from PostgreSQL — but it was written **only after** `ownerOf()` on-chain matched
the buyer (step 4.9). So the mirror is verified, not trusted blindly.

**Ownership history section** — from `ownership_history` in PostgreSQL:

```sql
SELECT h.*, u.full_name AS owner_name, u.phone AS owner_phone
  FROM ownership_history h
  LEFT JOIN users u ON u.id = h.owner_id
 WHERE h.property_id = $1
 ORDER BY h.started_at ASC
```

Each row renders: owner name (or short address), wallet, phone (click-to-call), start date,
end date for previous owners, and the transaction hash.

**The same history also exists on-chain:**

```js
await nft.getOwnershipHistory(tokenId);
// → [{ owner: "0x…", since: 1712345678 }, ...]
```

The UI currently renders the SQL copy because it can join names and phone numbers, which are
not on-chain. A good viva answer:

> "Ownership is *proven* by the chain (`ownerOf`, `getOwnershipHistory`), and *displayed* from the
> database, which mirrors the chain and adds human-readable fields. The database copy is written
> only after the transaction is verified."

You can demonstrate the on-chain version with `npm run inspect` (see §6).

---

## 5. How the backend verifies the chain (why a fake `txHash` fails)

A malicious client could send any hash. `backend/src/services/chain.js`:

```js
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
```

Checked after a write:

| Flow | Receipt exists | status = 1 | sender matches | On-chain state re-read |
|---|---|---|---|---|
| List | ✅ | ✅ | seller | `listings(tokenId).active` + `seller` |
| Create request | ✅ | ✅ | buyer | — (request id stored) |
| Accept | ✅ | ✅ | seller | — |
| Pay | ✅ | ✅ | buyer | `getRequest(id).status === 3` **and** `ownerOf(tokenId) === buyer` |
| Mint | server-signed | `tx.wait()` throws on revert | — | `propertyMinted`, `ownerOf` |

That is the practical meaning of **"the backend communicates with the blockchain"**: it *sends*
transactions with the government key and *reads back* state with the provider.

---

## 6. Practical lab — see it yourself

> **Note:** this worktree is a fresh checkout: `node_modules` and `.env` files are not present.
> The already-configured copy is at `~/Desktop/AssignmentCore/FinalYearProject/FinalYearProject`.
> Either run the commands there, or set this one up first.

### 6.1 Start everything (fresh setup)

```bash
# 1. contracts
cd contracts
npm install
cp .env.example .env          # optional; deploy writes deployments/localhost.json anyway
npm run node                  # terminal 1 — keep running

# 2. deploy (terminal 2)
npm run deploy                # prints the two addresses

# 3. backend (terminal 3)
cd ../backend
npm install
cp .env.example .env
npm start                     # http://localhost:4000

# 4. frontend (terminal 4)
cd ../frontend
npm install
cp .env.example .env          # set VITE_PROPERTY_NFT_ADDRESS / VITE_MARKETPLACE_ADDRESS
npm run dev                   # http://localhost:5173
```

### 6.2 Print the whole on-chain state

```bash
cd contracts
npm run inspect
# or pick tokens:
TOKEN_IDS=1,4,6 npm run inspect
```

It prints, straight from the chain:

- chain id, block number, government address and balance
- for each token: current owner, `tokenURI`, full ownership history with timestamps
- listing (seller, price in wei + ETH, active)
- every purchase request with its `documentHash` and status

### 6.3 Hardhat console one-liners

```bash
cd contracts
npx hardhat console --network localhost
```

```js
const nft = await ethers.getContractAt("PropertyNFT", "0x5FbDB2315678afecb367f032d93F642f64180aa3");
const market = await ethers.getContractAt("LandMarketplace", "0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512");

await nft.ownerOf(1);                 // current owner address
await nft.tokenURI(1);                // http://localhost:4000/api/properties/1/metadata
await nft.propertyMinted(1);          // true
await nft.getOwnershipHistory(1);     // [{ owner, since }]

await market.requestCount();          // how many requests exist
await market.getRequest(1);           // full struct, including documentHash + status
await market.listings(6);             // seller, price, active

await ethers.provider.getBlockNumber();
```

### 6.4 Raw JSON-RPC (no ethers) — proves there is no magic

```bash
# current block
curl -s -X POST http://127.0.0.1:8545 -H 'Content-Type: application/json' \
  --data '{"jsonrpc":"2.0","id":1,"method":"eth_blockNumber","params":[]}'

# is there really code at the NFT address?
curl -s -X POST http://127.0.0.1:8545 -H 'Content-Type: application/json' \
  --data '{"jsonrpc":"2.0","id":1,"method":"eth_getCode","params":["0x5FbDB2315678afecb367f032d93F642f64180aa3","latest"]}'

# ownerOf(1): selector 0x6352211e + 32-byte token id
curl -s -X POST http://127.0.0.1:8545 -H 'Content-Type: application/json' \
  --data '{"jsonrpc":"2.0","id":1,"method":"eth_call","params":[{"to":"0x5FbDB2315678afecb367f032d93F642f64180aa3","data":"0x6352211e0000000000000000000000000000000000000000000000000000000000000001"},"latest"]}'
```

The last call returns a 32-byte word whose last 20 bytes are the owner address.

### 6.5 Join your database rows to the chain

```sql
-- properties and their mint transaction
SELECT id, title, status, nft_token_id, mint_tx_hash
  FROM properties ORDER BY id;

-- the full request lifecycle, one column per step
SELECT id, status, onchain_request_id,
       create_tx_hash, accept_tx_hash, approve_tx_hash, pay_tx_hash
  FROM requests ORDER BY id;

-- who owned what, when
SELECT property_id, owner_wallet, price, tx_hash, started_at, ended_at
  FROM ownership_history ORDER BY property_id, started_at;
```

Paste any `*_tx_hash` into a block explorer (or `eth_getTransactionReceipt`) to prove the DB row
corresponds to a real transaction.

### 6.6 In MetaMask

- Import Hardhat accounts #1 (`0x7099…79C8`), #2 (`0x3C44…93BC`), #19 (Sujan) for buyer/seller roles.
- After each action, open **Activity → the transaction** to see the method and the block.
- Watch the `npm run node` terminal: each transaction is printed with its method and contract address.

### 6.7 10-minute demo order

1. `npm run inspect` → show token 1 owner + history (empty requests).
2. Register a property → show `status = pending`, **no token**.
3. Government approve → `npm run inspect` → token minted, history entry #1.
4. List → show `listings(tokenId)` active + price.
5. Buyer request → `npm run inspect` → request #1 `Pending`, note the `documentHash`.
6. Seller accept → docs become visible (refresh buyer/seller views).
7. Government approve → status `GovApproved`.
8. Buyer pays → `npm run inspect` → status `Paid`, owner = buyer, history entry #2.
9. Property page → current owner + history row with tx hash.

---

## 7. Cheat sheet: UI action → HTTP → signer → contract

| UI action | HTTP endpoint | Signer | Contract method |
|---|---|---|---|
| Login | `POST /api/auth/nonce`, `/verify` | 🦊 signature only | — |
| Submit KYC | `POST /api/kyc` | — | — |
| Register property | `POST /api/properties` | — | — |
| Verify + mint | `PATCH /api/government/properties/:id/approve` | 🏛 | `PropertyNFT.mintProperty` |
| List for sale | `PATCH /api/properties/:id/list` | 🦊 | `NFT.approve` + `Marketplace.listProperty` |
| Send request | `POST /api/requests` + `PATCH /api/requests/:id/onchain` | 🦊 | `Marketplace.createRequest` |
| Seller accepts | `PATCH /api/requests/:id/accept` | 🦊 | `Marketplace.acceptRequest` |
| Seller rejects | `PATCH /api/requests/:id/reject` | 🦊 (best-effort) | `Marketplace.rejectRequest` |
| Gov approves | `PATCH /api/government/requests/:id/approve` | 🏛 | `Marketplace.govApproveRequest` |
| Gov rejects | `PATCH /api/government/requests/:id/reject` | 🏛 (best-effort) | `Marketplace.rejectRequest` |
| Buyer pays | `PATCH /api/requests/:id/paid` | 🦊 | `Marketplace.payAndTransfer` |

---

## 8. Failure modes you will actually meet

| Symptom | Cause | Fix |
|---|---|---|
| `could not decode result data (value="0x")` | Hardhat node restarted, contracts gone | `cd contracts && npm run deploy`; restart backend |
| `PropertyNFT contract not found at 0x…` | same, caught early by `ensureDeployed()` | redeploy |
| `nonce has already been used` / `replacement transaction underpriced` | two gov transactions fired too fast | handled by `sendWithRetry()` |
| `PropertyNFT: token already minted` | stale `nft_token_id` after a reset | `nextFreeTokenId()` walks forward; or approve again |
| `Marketplace: approve NFT first` | seller skipped the `approve` tx | MetaMask flow does it automatically |
| `Marketplace: not approved` (on pay) | government has not clicked Approve | approve the request first |
| `Marketplace: incorrect payment` | price in DB differs from on-chain snapshot | pay exactly `request.price` |
| MetaMask on the wrong network | chain id mismatch | `switchToLocalChain()` prompts to add/switch to 31337 |
| DB says `Paid` but chain has no request | chain was reset after the sale | redeploy + re-mint; historical DB rows point to dead hashes |

---

## 9. Viva Q&A (short answers)

**Q: Where is the land ownership stored?**
In the `PropertyNFT` ERC721 contract: `_owners[tokenId]` plus an append-only `_ownershipHistory`.
The database mirrors it for display.

**Q: Why an NFT instead of a row in a database?**
An NFT gives a unique, transferable, tamper-proof token whose owner can be verified by anyone,
without trusting the operator's database. The contract enforces who may mint and how transfers happen.

**Q: What exactly goes on-chain when a buyer requests?**
A 32-byte SHA-256 hash of the citizenship + PAN files, not the files. The hash proves integrity;
the files stay private off-chain.

**Q: What stops the government from minting fake properties?**
Nothing in code — the government is the trusted authority (`onlyOwner`). The design assumes the
government is the verifier; the chain makes its actions auditable and permanent.

**Q: What stops a seller from taking the money and not transferring?**
The transfer and the payment are in the **same transaction** (`payAndTransfer`), so both happen or
neither does.

**Q: Can the buyer pay before government approval?**
No: `require(status == GovApproved)`. Can the seller accept after payment? No: payment requires
`GovApproved`, and acceptance requires `Pending`.

**Q: Can someone re-mint token 1?**
No: `propertyMinted[1]` is true forever on that deployment.

**Q: Where does the backend get the authority to mint?**
`GOVERNMENT_PRIVATE_KEY` in `backend/.env`, loaded into an ethers `Wallet`. The HTTP route also
requires a JWT with `role = 'government'`, but the real enforcement is `onlyOwner` in Solidity.

**Q: How does the frontend know the request id?**
After `createRequest`, it reads `market.requestCount()` and stores it as `onchain_request_id`.
(Production would decode the `RequestCreated` event instead, to avoid a race between two buyers.)

**Q: What happens to the old owner?**
A new `ownership_history` row is inserted and the previous row gets `ended_at = NOW()`. On-chain,
the same event appends `{ owner: buyer, since: block.timestamp }`.

---

## 10. Honest limitations (say them before the examiner does)

1. **Metadata is centralized.** `tokenURI` points at `localhost:4000`; if the backend dies the image
   disappears. IPFS/Arweave would make it permanent.
2. **The government key is a hot key in `.env`.** A production system would use a KMS, HSM or multisig.
3. **`assertSuccessfulTx` checks the receipt, sender and resulting state, but does not decode the
   method/arguments** from the transaction input. A stricter version would compare the `to` address
   and the 4-byte selector (or the emitted event).
4. **The on-chain request id is linked by the client** (`requestCount()` after the call); two
   simultaneous buyers could race. Decoding `RequestCreated` logs removes that risk.
5. **No reorg/indexer handling.** Hardhat has instant finality; a real chain would need confirmations
   and an event indexer to rebuild the DB.
6. **Postgres can drift from the chain** if a DB write fails after a successful transaction. The paid
   endpoint re-checks the chain, and a reconciliation script could rebuild the mirror from events.
