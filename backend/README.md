# Property listing + government verification + NFT

## Setup
1. `npm install`
2. Add the Prisma wallet fields with `npx prisma migrate dev -n add_user_wallet`
3. Configure the wallet encryption secret and NFT settings below
3. Mark government officers in the DB: `UPDATE "User" SET "isGovernment" = true WHERE email = '...'`
4. Add to `.env`:
   ```
   WALLET_ENCRYPTION_KEY=replace-with-a-long-random-secret
   PUBLIC_BASE_URL=https://your-api-domain      # used in NFT tokenURI / image URLs
   NFT_RPC_URL=...                              # JSON-RPC endpoint of your chain
   NFT_CONTRACT_ADDRESS=0x...                   # deployed contracts/PropertyNFT.sol
   NFT_MINTER_PRIVATE_KEY=0x...                 # the contract owner's key (keep in a secret manager)
   ```
5. Add `private-uploads/` to `.gitignore`.

## Flow
seller creates (PENDING) -> gov dispatch (DISPATCHED) -> gov verify (VERIFIED) -> seller mint (MINTING -> MINTED)
gov can reject from PENDING/DISPATCHED (REJECTED); seller edits -> back to PENDING.

## Endpoints
| Method | Path | Who | Notes |
|---|---|---|---|
| GET | /api/properties | public | VERIFIED + MINTED only. `?city&propertyType&minPrice&maxPrice&page&limit` |
| GET | /api/properties/:id | public / owner / gov | public view if VERIFIED/MINTED; otherwise owner or gov only (404 for everyone else) |
| GET | /api/properties/:id/metadata | public | ERC-721 tokenURI JSON (MINTING/MINTED) |
| POST | /api/properties | seller (KYC approved) | multipart: fields + `images[]` (1-10) + `documents[]` (1-5). Starts PENDING |
| GET | /api/properties/mine | seller | `?status=` |
| PUT | /api/properties/:id | seller | PENDING/REJECTED only; optional new files + `removeFileIds`; resets to PENDING |
| DELETE | /api/properties/:id | seller | PENDING/REJECTED only |
| GET | /api/properties/:id/documents/:fileId | owner / gov | private ownership docs |
| POST | /api/properties/:id/mint | seller | VERIFIED only; backend automatically uses the seller's registered wallet |
| GET | /api/government/properties | gov | review queue, `?status=PENDING` (default) |
| GET | /api/government/properties/:id | gov | full record + status history |
| POST | /api/government/properties/:id/dispatch | gov | PENDING -> DISPATCHED, body `{ note? }` |
| POST | /api/government/properties/:id/verify | gov | DISPATCHED -> VERIFIED, body `{ governmentRefNumber, notes? }` |
| POST | /api/government/properties/:id/reject | gov | body `{ reason }` |

Create fields: title, description, propertyType (HOUSE|APARTMENT|LAND|COMMERCIAL), price, areaSqFt,
bedrooms?, bathrooms?, street, city, zip, landRegistrationNumber, ownerWalletAddress?


### User wallet flow
At registration the backend generates one Ethereum-compatible wallet per user with `ethers.Wallet.createRandom()`.
The public address is stored in `User.walletAddress`. The private key is encrypted at rest using
`WALLET_ENCRYPTION_KEY`; the plaintext private key is returned once in the registration response so
the user can back it up. It is never placed in browser localStorage. No MetaMask is required.

The NFT contract owner/minter wallet is separate from user wallets. `NFT_MINTER_PRIVATE_KEY` is the
backend wallet that owns `PropertyNFT` and pays gas for `safeMint()`. The user's wallet is the NFT
recipient.
