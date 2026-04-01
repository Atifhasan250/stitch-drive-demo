import crypto from "crypto";
import * as config from "../config/index.js";

// ── Fernet-compatible AES-128-CBC encryption ──────────────────────────────────
// Python's cryptography.fernet uses AES-128-CBC with HMAC-SHA256.
// We replicate the same wire format so tokens stored by either implementation
// are interchangeable.
//
// Fernet token layout (base64url):
//   version(1) | timestamp(8) | iv(16) | ciphertext(N) | hmac(32)
// The signing key is the first 16 bytes of the 32-byte decoded key.
// The encryption key is the last 16 bytes.

function _fernetKeys(b64Key) {
  const raw = Buffer.from(b64Key, "base64"); // 32 bytes
  if (raw.length !== 32) throw new Error("Fernet key must be 32 bytes");
  return {
    signingKey: raw.slice(0, 16),
    encryptionKey: raw.slice(16, 32),
  };
}

export function encryptToken(plaintext) {
  const { signingKey, encryptionKey } = _fernetKeys(config.ENCRYPTION_KEY);
  const iv = crypto.randomBytes(16);
  const nowSecs = Math.floor(Date.now() / 1000);

  const cipher = crypto.createCipheriv("aes-128-cbc", encryptionKey, iv);
  const ciphertext = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);

  // Build the to-sign payload: version + timestamp + iv + ciphertext
  const version = Buffer.from([0x80]);
  const ts = Buffer.allocUnsafe(8);
  ts.writeBigUInt64BE(BigInt(nowSecs));
  const basicParts = Buffer.concat([version, ts, iv, ciphertext]);

  const hmac = crypto.createHmac("sha256", signingKey).update(basicParts).digest();
  const token = Buffer.concat([basicParts, hmac]);
  return token.toString("base64url");
}

export function decryptToken(fernetToken) {
  const { signingKey, encryptionKey } = _fernetKeys(config.ENCRYPTION_KEY);
  const raw = Buffer.from(fernetToken, "base64url");

  if (raw.length < 1 + 8 + 16 + 32) throw new Error("Token too short");
  // version(1) + ts(8) + iv(16) = 25 bytes prefix
  const hmacStart = raw.length - 32;
  const basicParts = raw.slice(0, hmacStart);
  const storedHmac = raw.slice(hmacStart);

  // Verify HMAC
  const expectedHmac = crypto.createHmac("sha256", signingKey).update(basicParts).digest();
  if (!crypto.timingSafeEqual(storedHmac, expectedHmac)) {
    throw new Error("Invalid token signature");
  }

  const iv = raw.slice(9, 25);
  const ciphertext = raw.slice(25, hmacStart);

  const decipher = crypto.createDecipheriv("aes-128-cbc", encryptionKey, iv);
  const decrypted = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
  return decrypted.toString("utf8");
}
