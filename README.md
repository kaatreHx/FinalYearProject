# Land Chain

A blockchain-based **land registry** built as a final year project. Every property is
verified by the government and minted as a unique **ERC-721 NFT**. Buying and selling
happens through a transparent, request-based smart-contract flow with a complete
ownership history.

> Manish Rakaskoti · BSc (Hons) Software Engineering · Student No. 2337729

---

## 1. Overview

- **No fixed roles.** Any user can register, list, buy and sell. The only special
  account is the **government** verifier.
- **Wallet login.** There is no email/password. Users sign in with MetaMask by signing a
  one-time message (verified on the backend with `ethers.verifyMessage`).
- **KYC.** After connecting, a user submits a simple KYC that the government approves
  before they can register or buy property.
- **Government verification.** A property is minted as an NFT only after the government
  verifies it. A transfer is approved by the government again before payment.
- **Protected documents.** A buyer attaches documents that stay **locked and hidden from
  the seller** until the seller accepts the request.
- **Smart-contract payment.** After approval the buyer pays; the NFT moves to the buyer
  and the funds move to the seller in the same transaction.
- **Ownership history.** Each property page shows the current owner and every previous
  owner with dates and transaction hashes.

---

## 2. Tech stack

| Layer     | Technology                                                |
| --------- | --------------------------------------------------------- |
| Contracts | Solidity, Hardhat, OpenZeppelin (ERC-721), ethers.js       |
| Backend   | Node.js, Express, PostgreSQL (`pg`), JWT, ethers.js        |
| Frontend  | React (Vite), React Router, ethers.js, MetaMask            |

---

## 3. Folder structure

```
FinalYearProject/
├── contracts/                 # Hardhat + Solidity
│   ├── contracts/
│   │   ├── PropertyNFT.sol        # ERC-721 property registry (government mints)
│   │   └── LandMarketplace.sol    # Listings, requests, approval, payment
│   ├── scripts/deploy.js
│   ├── test/landchain.test.js
│   ├── hardhat.config.js
│   └── package.json
├── backend/                   # Express + PostgreSQL API
│   ├── db/schema.sql
│   ├── scripts/init-db.js
│   ├── scripts/e2e-test.js    # full end-to-end smoke test
│   ├── src/
│   │   ├── server.js
│   │   ├── db.js
│   │   ├── config.js
│   │   ├── middleware/        # auth, uploads, errors
│   │   ├── services/chain.js  # ethers provider + government signer
│   │   ├── utils/
│   │   └── routes/            # auth, kyc, properties, requests, government
│   └── package.json
└── frontend/                  # React + Vite
    ├── src/
    │   ├── pages/             # Landing, Login, Kyc, Dashboard, ...
    │   ├── components/        # Navbar, PropertyCard, Modal, ...
    │   ├── context/AuthContext.jsx
    │   ├── lib/               # api, ethers, format helpers
    │   └── index.css
    └── package.json
```

---

## 4. Prerequisites

- Node.js 18+ (20+ recommended)
- PostgreSQL 15+
- MetaMask browser extension _(for the wallet features)_

---

## 5. Quick start

Run each block in its own terminal.

### 5.1 Databases

Create a database named `landchain`:

```bash
createdb landchain
# or: psql -U postgres -c "CREATE DATABASE landchain;"
```

The backend creates all tables automatically on start (and there is also
`npm run db:init`). Adjust `DATABASE_URL` in `backend/.env` if your credentials differ.

### 5.2 Smart contracts

```bash
cd contracts
npm install
npx hardhat compile
npx hardhat test                 # 4 contract tests

npx hardhat node                 # (terminal A) start the local chain
# in a second terminal:
npm run deploy                   # (terminal B) deploy to localhost
```

Deploy prints the addresses and writes `contracts/deployments/localhost.json`, which the
backend reads automatically.

### 5.3 Backend

```bash
cd backend
npm install
cp .env.example .env             # already provided as .env in this repo
npm start                        # http://localhost:4000
```

### 5.4 Frontend

```bash
cd frontend
npm install
npm run dev                      # http://localhost:5173
```

### 5.5 MetaMask setup

1. Add the **Hardhat Localhost** network — the app offers to add it automatically:
   - RPC URL: `http://127.0.0.1:8545`
   - Chain ID: `31337`
   - Currency: `ETH`
2. Import Hardhat test accounts using their private keys (printed by `npx hardhat node`):
   - **Account #0** → the **government** wallet
     `0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266`
   - **Account #1 / #2 / #3…** → normal users (sellers / buyers)

You can switch between accounts in MetaMask to play different roles.

---

## 6. Purchase flow (text diagram)

```
                    ┌──────────────────────────────┐
                    │  Connect MetaMask (wallet)   │
                    │  sign one-time message → JWT │
                    └───────────────┬──────────────┘
                                    │
                    ┌───────────────▼──────────────┐
                    │  Submit KYC → government     │
                    │  approves → user verified    │
                    └───────────────┬──────────────┘
                                    │
        ┌───────────────────────────▼───────────────────────────┐
        │ 1. USER registers a property  (status: pending)       │
        └───────────────────────────┬───────────────────────────┘
                                    │
                    ┌───────────────▼──────────────┐
                    │  GOVERNMENT verifies          │
                    └───────┬───────────────┬───────┘
                      reject│               │approve
                            ▼               ▼
                     [rejected]     mint NFT to owner
                                    (status: verified)
                                            │
        ┌───────────────────────────────────▼───────────────────┐
        │ 2. OWNER lists the verified property with a price     │
        └───────────────────────────┬───────────────────────────┘
                                    │
        ┌───────────────────────────▼───────────────────────────┐
        │ 3. BUYER sends a purchase request + documents         │
        │    (documents LOCKED, hidden from the seller)         │
        └───────────────────────────┬───────────────────────────┘
                                    │
                    ┌───────────────▼──────────────┐
                    │  SELLER accepts / rejects     │
                    └───────┬───────────────┬───────┘
                      reject│               │accept
                            ▼               ▼
                     [rejected]   documents UNLOCKED for seller
                                  (status: Accepted)
                                            │
                    ┌───────────────────────▼──────┐
                    │  GOVERNMENT verifies again    │
                    └───────┬───────────────┬───────┘
                      reject│               │approve
                            ▼               ▼
                     [rejected]    status: GovApproved
                                            │
        ┌───────────────────────────────────▼───────────────────┐
        │ 4. BUYER pays through the smart contract (MetaMask)   │
        └───────────────────────────┬───────────────────────────┘
                                    │
        ┌───────────────────────────▼───────────────────────────┐
        │  NFT → buyer   ·   ETH → seller   ·   previous owner  │
        │  saved in ownership history   (status: Paid)          │
        └───────────────────────────┬───────────────────────────┘
                                    │
                    Property page shows current owner + all
                    previous owners with dates and tx hashes
```

### Request statuses

| Status        | Meaning                                             |
| ------------- | --------------------------------------------------- |
| `Pending`     | Buyer created the request; waiting for the seller   |
| `Accepted`    | Seller accepted; documents unlocked for the seller  |
| `GovApproved` | Government verified; the buyer may now pay          |
| `Paid`        | Buyer paid; ownership transferred, sale complete    |
| `Rejected`    | Rejected by the seller or the government            |

---

## 7. Testing

**Contract tests**

```bash
cd contracts && npx hardhat test
```

Covers government-only minting, on-chain ownership history, the full purchase flow, and
the "seller cannot buy their own property" rule.

**Full end-to-end test** (drives the real API + contracts with three Hardhat accounts)

```bash
# with the Hardhat node running, contracts deployed, and the backend running:
cd backend && node scripts/e2e-test.js
```

It walks through: login → KYC → approve KYC → register property → verify & mint → list →
buyer request (with documents) → documents hidden check → seller accept → government
approve → buyer pay → final ownership + history check.

---

## 8. API reference (summary)

| Method & path                               | Who          | Purpose                                   |
| ------------------------------------------- | ------------ | ----------------------------------------- |
| `POST /api/auth/nonce`                      | public       | Get a signing nonce for a wallet          |
| `POST /api/auth/verify`                     | public       | Verify signature, return JWT               |
| `GET  /api/auth/me`                         | user         | Current user                               |
| `POST /api/kyc`                             | user         | Submit KYC                                 |
| `GET  /api/kyc/me`                          | user         | KYC status                                 |
| `GET  /api/properties`                      | public       | Marketplace listing                        |
| `POST /api/properties`                      | verified     | Register a property                        |
| `GET  /api/properties/mine`                 | user         | My properties                              |
| `GET  /api/properties/:id`                  | public       | Detail + ownership history                 |
| `PATCH /api/properties/:id/list`            | owner        | Record an on-chain listing                 |
| `POST /api/requests`                        | verified     | Create request + upload documents          |
| `PATCH /api/requests/:id/onchain`           | buyer        | Link on-chain request id                    |
| `GET  /api/requests/mine`                   | user         | My sent + received requests                |
| `GET  /api/requests/:id`                    | participant  | Request detail + (gated) documents         |
| `PATCH /api/requests/:id/accept`            | seller       | Accept (unlocks documents)                 |
| `PATCH /api/requests/:id/reject`            | seller       | Reject                                     |
| `PATCH /api/requests/:id/paid`              | buyer        | Confirm payment, transfer ownership in DB  |
| `GET  /api/requests/:id/documents/:docId`   | participant  | Download a document (access-controlled)    |
| `GET  /api/government/stats`                | government   | Dashboard counters                         |
| `GET  /api/government/kyc`                  | government   | Pending KYC applications                   |
| `PATCH /api/government/kyc/:id`             | government   | Approve / reject KYC                       |
| `GET  /api/government/properties`           | government   | Pending properties                         |
| `PATCH /api/government/properties/:id/approve` | government | Verify + **mint NFT**                      |
| `PATCH /api/government/properties/:id/reject`  | government | Reject property                            |
| `GET  /api/government/requests`             | government   | Accepted requests                          |
| `PATCH /api/government/requests/:id/approve`   | government | Approve transfer on-chain                  |
| `PATCH /api/government/requests/:id/reject`    | government | Reject request                             |

---

## 9. How it maps to the proposal

| Proposal deliverable              | Where it lives                                          |
| --------------------------------- | ------------------------------------------------------- |
| Government-verified registry      | `government.routes.js` → `PropertyNFT.mintProperty`     |
| Smart contracts (mint/transfer/payment) | `PropertyNFT.sol`, `LandMarketplace.sol`         |
| User authentication               | `auth.routes.js` + `AuthContext.jsx` (MetaMask)         |
| Purchase request module           | `requests.routes.js` + `RequestDetail.jsx`              |
| Government verification of transfer | `government.routes.js` → `govApproveRequest`          |
| Payment & ownership transfer      | `LandMarketplace.payAndTransfer`                        |
| Ownership history                 | `ownership_history` table + `PropertyNFT` history       |
| Web interface                     | `frontend/`                                             |

---

## 10. Security notes

- Documents and KYC files are stored **off-chain**; only a **SHA-256 hash** of buyer
  documents is written on-chain.
- Documents are gated by `documents_visible_to_seller` (flipped true only on acceptance).
- Login uses a rotating one-time nonce to prevent signature replay.
- The backend holds the government private key to mint/approve server-side — in a real
  deployment this would be a KMS/signing service, not a plain env var.
- This runs on a local Hardhat chain for development; never use the well-known test keys
  on a public network.

---

## 11. Useful commands

```bash
# contracts
cd contracts && npx hardhat node          # local chain
cd contracts && npm run deploy            # deploy
cd contracts && npx hardhat test          # tests

# backend
cd backend && npm start                   # API on :4000
cd backend && npm run db:init             # (re)create tables
cd backend && node scripts/e2e-test.js    # end-to-end smoke test

# frontend
cd frontend && npm run dev                # app on :5173
cd frontend && npm run build              # production build
```
