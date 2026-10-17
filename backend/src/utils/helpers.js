/** Wraps an async Express handler so thrown errors reach the error middleware. */
function asyncHandler(fn) {
  return (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);
}

/** Convert a user row into the shape the frontend expects. */
function publicUser(u) {
  if (!u) return null;
  return {
    id: u.id,
    wallet: u.wallet_address,
    fullName: u.full_name,
    email: u.email,
    phone: u.phone,
    role: u.role,
    kycStatus: u.kyc_status,
    createdAt: u.created_at,
  };
}

/** Default country dial code (Nepal). */
const DEFAULT_COUNTRY_CODE = "+977";

/**
 * Make a phone number consistent by always including its country code.
 * "+977 9801234567" is kept as-is; a bare "9801234567" becomes
 * "+977 9801234567" so every stored number carries a code.
 */
function normalizePhone(value) {
  if (value === undefined || value === null) return null;
  const text = String(value).trim();
  if (!text) return null;
  return text.startsWith("+") ? text : `${DEFAULT_COUNTRY_CODE} ${text}`;
}

module.exports = { asyncHandler, publicUser, normalizePhone, DEFAULT_COUNTRY_CODE };
