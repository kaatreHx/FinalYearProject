const express = require("express");
const crypto = require("crypto");
const jwt = require("jsonwebtoken");
const { ethers } = require("ethers");
const config = require("../config");
const { pool } = require("../db");
const { asyncHandler, publicUser, normalizePhone } = require("../utils/helpers");
const { requireAuth } = require("../middleware/auth");

const router = express.Router();

const WALLET_RE = /^0x[a-f0-9]{40}$/;

/** Message the user signs in MetaMask. Must match the frontend exactly. */
function buildMessage(wallet, nonce) {
  return `Land Chain wants you to sign in with your wallet:\n${wallet}\n\nNonce: ${nonce}`;
}

/**
 * Step 1 of login: request a one-time nonce for a wallet.
 * Creates the user if this wallet has never logged in.
 */
router.post(
  "/nonce",
  asyncHandler(async (req, res) => {
    const wallet = String(req.body.wallet || "").toLowerCase();
    if (!WALLET_RE.test(wallet)) return res.status(400).json({ error: "Invalid wallet address." });

    const nonce = crypto.randomBytes(16).toString("hex");
    const role = wallet === config.governmentWallet ? "government" : "user";
    const kycStatus = role === "government" ? "approved" : "none";

    const { rows } = await pool.query(
      `INSERT INTO users (wallet_address, nonce, role, kyc_status)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (wallet_address)
       DO UPDATE SET nonce = EXCLUDED.nonce, updated_at = NOW()
       RETURNING wallet_address, nonce, role, kyc_status`,
      [wallet, nonce, role, kycStatus]
    );

    const user = rows[0];
    res.json({
      wallet: user.wallet_address,
      nonce: user.nonce,
      message: buildMessage(user.wallet_address, user.nonce),
    });
  })
);

/**
 * Step 2 of login: verify the signed message and issue a JWT.
 */
router.post(
  "/verify",
  asyncHandler(async (req, res) => {
    const wallet = String(req.body.wallet || "").toLowerCase();
    const signature = req.body.signature;
    if (!WALLET_RE.test(wallet) || !signature) {
      return res.status(400).json({ error: "Wallet and signature are required." });
    }

    const { rows } = await pool.query("SELECT * FROM users WHERE wallet_address = $1", [wallet]);
    const user = rows[0];
    if (!user) return res.status(404).json({ error: "Unknown wallet. Request a nonce first." });

    let recovered;
    try {
      recovered = ethers.verifyMessage(buildMessage(wallet, user.nonce), signature);
    } catch (_) {
      return res.status(400).json({ error: "Invalid signature." });
    }
    if (recovered.toLowerCase() !== wallet) {
      return res.status(401).json({ error: "Signature does not match the wallet." });
    }

    // Rotate the nonce so a signature cannot be replayed.
    const newNonce = crypto.randomBytes(16).toString("hex");
    const updated = await pool.query(
      "UPDATE users SET nonce = $1, updated_at = NOW() WHERE id = $2 RETURNING *",
      [newNonce, user.id]
    );

    const token = jwt.sign({ uid: user.id }, config.jwtSecret, { expiresIn: "7d" });
    res.json({ token, user: publicUser(updated.rows[0]) });
  })
);

/** Return the currently logged-in user. */
router.get(
  "/me",
  requireAuth,
  asyncHandler(async (req, res) => {
    res.json({ user: publicUser(req.user) });
  })
);

/**
 * Update the logged-in user's profile (name, email, phone).
 * Only these three fields can be changed here; KYC approval is separate.
 */
router.patch(
  "/me",
  requireAuth,
  asyncHandler(async (req, res) => {
    const fullName = req.body.fullName !== undefined ? String(req.body.fullName).trim() : null;
    const email = req.body.email !== undefined ? String(req.body.email).trim() : null;
    const phone = req.body.phone !== undefined ? normalizePhone(req.body.phone) : null;

    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return res.status(400).json({ error: "Please enter a valid email address." });
    }
    if (phone && !/^[+0-9][0-9\s\-()]{5,24}$/.test(phone)) {
      return res.status(400).json({ error: "Please enter a valid phone number." });
    }

    const { rows } = await pool.query(
      `UPDATE users
          SET full_name = $1, email = $2, phone = $3, updated_at = NOW()
        WHERE id = $4
        RETURNING *`,
      [fullName || null, email || null, phone || null, req.user.id]
    );

    res.json({ message: "Profile updated.", user: publicUser(rows[0]) });
  })
);

module.exports = router;
