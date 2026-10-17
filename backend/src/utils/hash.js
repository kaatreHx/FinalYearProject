const crypto = require("crypto");

/** sha256 of a buffer, formatted as a 0x-prefixed 32-byte value. */
function sha256(buffer) {
  return "0x" + crypto.createHash("sha256").update(buffer).digest("hex");
}

/**
 * Combine several uploaded files into a single on-chain document hash.
 */
function hashFiles(files) {
  const parts = files
    .map((f) => crypto.createHash("sha256").update(require("fs").readFileSync(f.path)).digest("hex"))
    .sort();
  const combined = parts.join("");
  return "0x" + crypto.createHash("sha256").update(combined).digest("hex");
}

module.exports = { sha256, hashFiles };
