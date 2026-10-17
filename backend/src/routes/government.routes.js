const express = require("express");
const path = require("path");
const config = require("../config");
const { pool } = require("../db");
const { asyncHandler } = require("../utils/helpers");
const { requireAuth, requireGovernment } = require("../middleware/auth");
const chain = require("../services/chain");

const router = express.Router();

router.use(requireAuth, requireGovernment);

/** Dashboard counters. */
router.get(
  "/stats",
  asyncHandler(async (_req, res) => {
    const q = async (sql) => Number((await pool.query(sql)).rows[0].count);
    res.json({
      pendingKyc: await q("SELECT COUNT(*) FROM kyc WHERE status = 'pending'"),
      pendingProperties: await q("SELECT COUNT(*) FROM properties WHERE status = 'pending'"),
      pendingRequests: await q("SELECT COUNT(*) FROM requests WHERE status = 'Accepted'"),
      totalProperties: await q("SELECT COUNT(*) FROM properties WHERE status <> 'pending'"),
      totalUsers: await q("SELECT COUNT(*) FROM users WHERE role = 'user'"),
    });
  })
);

// ---------------------------------------------------------------------------
// KYC
// ---------------------------------------------------------------------------

router.get(
  "/kyc",
  asyncHandler(async (req, res) => {
    const status = req.query.status || "pending";
    const { rows } = await pool.query(
      `SELECT k.*, u.wallet_address, u.kyc_status
         FROM kyc k JOIN users u ON u.id = k.user_id
        WHERE ($1 = 'all' OR k.status = $1)
        ORDER BY k.created_at ASC`,
      [status]
    );
    res.json({ applications: rows });
  })
);

router.get(
  "/kyc/:id/document",
  asyncHandler(async (req, res) => {
    const { rows } = await pool.query("SELECT * FROM kyc WHERE id = $1", [req.params.id]);
    if (!rows[0] || !rows[0].document_path) {
      return res.status(404).json({ error: "Document not found." });
    }
    res.download(rows[0].document_path, rows[0].document_name || path.basename(rows[0].document_path));
  })
);

/** Approve or reject a KYC application. */
router.patch(
  "/kyc/:id",
  asyncHandler(async (req, res) => {
    const action = req.body.action;
    if (!["approve", "reject"].includes(action)) {
      return res.status(400).json({ error: "action must be 'approve' or 'reject'." });
    }
    const { rows } = await pool.query("SELECT * FROM kyc WHERE id = $1", [req.params.id]);
    const application = rows[0];
    if (!application) return res.status(404).json({ error: "KYC application not found." });

    const status = action === "approve" ? "approved" : "rejected";
    await pool.query(
      "UPDATE kyc SET status = $1, reject_reason = $2, reviewed_at = NOW() WHERE id = $3",
      [status, req.body.reason || null, application.id]
    );
    await pool.query("UPDATE users SET kyc_status = $1, updated_at = NOW() WHERE id = $2", [
      status,
      application.user_id,
    ]);

    res.json({ message: `KYC ${status}.` });
  })
);

// ---------------------------------------------------------------------------
// Properties (verification + minting)
// ---------------------------------------------------------------------------

router.get(
  "/properties",
  asyncHandler(async (req, res) => {
    const status = req.query.status || "pending";
    const { rows } = await pool.query(
      `SELECT p.*, u.full_name AS owner_name
         FROM properties p JOIN users u ON u.id = p.owner_id
        WHERE ($1 = 'all' OR p.status = $1)
        ORDER BY p.created_at ASC`,
      [status]
    );
    res.json({ properties: rows });
  })
);

/**
 * Approve a property -> mint it as an NFT to the owner (on-chain) and mark verified.
 */
router.patch(
  "/properties/:id/approve",
  asyncHandler(async (req, res) => {
    const { rows } = await pool.query("SELECT * FROM properties WHERE id = $1", [req.params.id]);
    const property = rows[0];
    if (!property) return res.status(404).json({ error: "Property not found." });
    if (property.status !== "pending" && property.status !== "verified") {
      return res.status(400).json({ error: "Only pending properties can be approved." });
    }

    const metadataUri = `${config.publicApiUrl}/api/properties/${property.id}/metadata`;

    // If a token was already recorded for this property, only reuse it when the
    // on-chain owner really is the property's owner. Otherwise that token
    // belongs to somebody else (left over from an older run) and reusing it
    // would let the recorded owner neither list nor transfer it.
    if (property.nft_token_id !== null) {
      const onchainOwner = await chain.ownerOf(property.nft_token_id);
      if (onchainOwner && onchainOwner.toLowerCase() === property.owner_wallet.toLowerCase()) {
        await pool.query(
          "UPDATE properties SET status = 'verified', updated_at = NOW() WHERE id = $1",
          [property.id]
        );
        return res.json({ message: "Property is already minted.", tokenId: property.nft_token_id });
      }
    }

    // Choose the first token id that is still free (normally the property id).
    let tokenId;
    try {
      tokenId = await chain.nextFreeTokenId(property.id);
    } catch (err) {
      return res.status(400).json({ error: "Could not read the chain: " + err.message });
    }

    let receipt;
    try {
      receipt = await chain.mintProperty(property.owner_wallet, tokenId, metadataUri);
    } catch (err) {
      return res.status(400).json({
        error: "Minting failed: " + err.message,
        hint: "Make sure the Hardhat node is running and the contract addresses are set.",
      });
    }

    await pool.query(
      `UPDATE properties
          SET status = 'verified', nft_token_id = $1, metadata_uri = $2, mint_tx_hash = $3, updated_at = NOW()
        WHERE id = $4`,
      [tokenId, metadataUri, receipt.hash, property.id]
    );

    // First entry in the ownership history (only when there is none yet).
    await pool.query(
      `INSERT INTO ownership_history (property_id, owner_id, owner_wallet, tx_hash)
       SELECT $1, $2, $3, $4
       WHERE NOT EXISTS (SELECT 1 FROM ownership_history WHERE property_id = $1)`,
      [property.id, property.owner_id, property.owner_wallet, receipt.hash]
    );

    res.json({ message: "Property verified and minted as NFT.", txHash: receipt.hash, tokenId });
  })
);

router.patch(
  "/properties/:id/reject",
  asyncHandler(async (req, res) => {
    const { rows } = await pool.query("SELECT * FROM properties WHERE id = $1", [req.params.id]);
    if (!rows[0]) return res.status(404).json({ error: "Property not found." });
    await pool.query(
      "UPDATE properties SET status = 'rejected', reject_reason = $1, updated_at = NOW() WHERE id = $2",
      [req.body.reason || null, req.params.id]
    );
    res.json({ message: "Property rejected." });
  })
);

// ---------------------------------------------------------------------------
// Purchase requests (transfer approval)
// ---------------------------------------------------------------------------

router.get(
  "/requests",
  asyncHandler(async (req, res) => {
    const status = req.query.status || "Accepted";
    const { rows } = await pool.query(
      `SELECT r.*, p.title AS property_title, bu.full_name AS buyer_name
         FROM requests r
         JOIN properties p ON p.id = r.property_id
         JOIN users bu ON bu.id = r.buyer_id
        WHERE ($1 = 'all' OR r.status = $1)
        ORDER BY r.created_at ASC`,
      [status]
    );
    res.json({ requests: rows });
  })
);

/**
 * Approve an accepted request on-chain (govApproveRequest), which allows the buyer to pay.
 */
router.patch(
  "/requests/:id/approve",
  asyncHandler(async (req, res) => {
    const { rows } = await pool.query("SELECT * FROM requests WHERE id = $1", [req.params.id]);
    const request = rows[0];
    if (!request) return res.status(404).json({ error: "Request not found." });
    if (request.status !== "Accepted") {
      return res.status(400).json({ error: "Only accepted requests can be approved." });
    }
    if (!request.onchain_request_id) {
      return res.status(400).json({ error: "Request is not linked on-chain yet." });
    }

    let receipt;
    try {
      receipt = await chain.govApproveRequest(request.onchain_request_id);
    } catch (err) {
      return res.status(400).json({ error: "On-chain approval failed: " + err.message });
    }

    await pool.query(
      "UPDATE requests SET status = 'GovApproved', approve_tx_hash = $1, updated_at = NOW() WHERE id = $2",
      [receipt.hash, request.id]
    );

    res.json({ message: "Transfer approved. Buyer may now pay.", txHash: receipt.hash });
  })
);

router.patch(
  "/requests/:id/reject",
  asyncHandler(async (req, res) => {
    const { rows } = await pool.query("SELECT * FROM requests WHERE id = $1", [req.params.id]);
    if (!rows[0]) return res.status(404).json({ error: "Request not found." });

    // Best-effort: also reject on-chain so the blockchain state matches.
    if (rows[0].onchain_request_id) {
      try {
        await chain.govRejectRequest(rows[0].onchain_request_id);
      } catch (_) {
        /* ignore - already paid or not rejectable on-chain */
      }
    }

    await pool.query(
      "UPDATE requests SET status = 'Rejected', reject_reason = $1, updated_at = NOW() WHERE id = $2",
      [req.body.reason || null, req.params.id]
    );
    res.json({ message: "Request rejected." });
  })
);

module.exports = router;
