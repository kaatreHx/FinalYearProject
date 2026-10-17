const jwt = require("jsonwebtoken");
const config = require("../config");
const { pool } = require("../db");

/**
 * Verifies the JWT and loads the current user into req.user.
 */
async function requireAuth(req, res, next) {
  try {
    const header = req.headers.authorization || "";
    const token = header.startsWith("Bearer ") ? header.slice(7) : null;
    if (!token) return res.status(401).json({ error: "Authentication required." });

    const payload = jwt.verify(token, config.jwtSecret);
    const { rows } = await pool.query("SELECT * FROM users WHERE id = $1", [payload.uid]);
    if (!rows[0]) return res.status(401).json({ error: "User not found." });

    req.user = rows[0];
    next();
  } catch (err) {
    return res.status(401).json({ error: "Invalid or expired session." });
  }
}

/** Only the government wallet may pass. */
function requireGovernment(req, res, next) {
  if (!req.user || req.user.role !== "government") {
    return res.status(403).json({ error: "Government access only." });
  }
  next();
}

/** User must have an approved KYC to continue. */
function requireKyc(req, res, next) {
  if (!req.user || req.user.kyc_status !== "approved") {
    return res.status(403).json({ error: "KYC verification required." });
  }
  next();
}

/**
 * Optional authentication: loads the user when a valid token is present but
 * never blocks the request. Used by public routes that show extra data to
 * signed-in viewers (e.g. ownership documents on a property page).
 */
async function optionalAuth(req, _res, next) {
  try {
    const header = req.headers.authorization || "";
    const token = header.startsWith("Bearer ") ? header.slice(7) : null;
    if (token) {
      const payload = jwt.verify(token, config.jwtSecret);
      const { rows } = await pool.query("SELECT * FROM users WHERE id = $1", [payload.uid]);
      if (rows[0]) req.user = rows[0];
    }
  } catch (_) {
    /* ignore invalid tokens - treat as anonymous */
  }
  next();
}

module.exports = { requireAuth, requireGovernment, requireKyc, optionalAuth };
