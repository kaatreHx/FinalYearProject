# Property listing + government verification + NFT

## Setup
1. `npm i ethers`
2. Merge `prisma/property.prisma` into your `schema.prisma` (+ the two `User` fields noted at the top), then `npx prisma migrate dev -n property_listing`
3. Mark government officers in the DB: `UPDATE "User" SET "isGovernment" = true WHERE email = '...'`
4. Add to `.env`:
   ```
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
| POST | /api/properties/:id/mint | seller | VERIFIED only; body `{ "walletAddress": "0x..." }` if not set at listing |
| GET | /api/government/properties | gov | review queue, `?status=PENDING` (default) |
| GET | /api/government/properties/:id | gov | full record + status history |
| POST | /api/government/properties/:id/dispatch | gov | PENDING -> DISPATCHED, body `{ note? }` |
| POST | /api/government/properties/:id/verify | gov | DISPATCHED -> VERIFIED, body `{ governmentRefNumber, notes? }` |
| POST | /api/government/properties/:id/reject | gov | body `{ reason }` |

Create fields: title, description, propertyType (HOUSE|APARTMENT|LAND|COMMERCIAL), price, areaSqFt,
bedrooms?, bathrooms?, street, city, zip, landRegistrationNumber, ownerWalletAddress?
