const express = require("express");
const { pool } = require("../db");
const { asyncHandler, publicUser, normalizePhone } = require("../utils/helpers");
const { requireAuth } = require("../middleware/auth");
const { kycUpload } = require("../middleware/upload");

const router = express.Router();

/**
 * Submit a KYC application (simple identity verification).
 * Any logged-in user can submit once; the government approves or rejects it.
 */
router.post(
  "/",
  requireAuth,
  kycUpload.single("document"),
  asyncHandler(async (req, res) => {
    if (req.user.kyc_status === "approved") {
      return res.status(400).json({ error: "Your KYC is already approved." });
    }

    const { fullName, dateOfBirth, nationality, idNumber, address, phone } = req.body;
    if (!fullName || !idNumber) {
      return res.status(400).json({ error: "Full name and ID number are required." });
    }

    // Replace any previous pending application so the user can resubmit.
    await pool.query("DELETE FROM kyc WHERE user_id = $1 AND status <> 'approved'", [req.user.id]);

    const { rows } = await pool.query(
      `INSERT INTO kyc
         (user_id, full_name, date_of_birth, nationality, id_number, address, document_name, document_path, status)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'pending')
       RETURNING *`,
      [
        req.user.id,
        fullName,
        dateOfBirth || null,
        nationality || null,
        idNumber,
        address || null,
        req.file ? req.file.originalname : null,
        req.file ? req.file.path : null,
      ]
    );

    await pool.query(
      `UPDATE users
          SET full_name = $1, phone = COALESCE($2, phone), kyc_status = 'pending', updated_at = NOW()
        WHERE id = $3`,
      [fullName, normalizePhone(phone), req.user.id]
    );

    res.status(201).json({ message: "KYC submitted for review.", kyc: rows[0] });
  })
);

/** Get the current user's KYC status and latest application. */
router.get(
  "/me",
  requireAuth,
  asyncHandler(async (req, res) => {
    const { rows } = await pool.query(
      "SELECT * FROM kyc WHERE user_id = $1 ORDER BY created_at DESC LIMIT 1",
      [req.user.id]
    );
    res.json({ user: publicUser(req.user), kyc: rows[0] || null });
  })
);

module.exports = router;
