import UserCredentials from "../models/UserCredentials.js";
import { encryptToken, decryptToken } from "../services/authService.js";
import { loadClientConfig } from "../services/driveService.js";

export async function storeCredentials(req, res) {
  const ownerId = req.ownerId;
  const { credentials } = req.body;

  if (!credentials || typeof credentials !== "object" || Array.isArray(credentials)) {
    return res.status(400).json({ detail: "credentials object is required" });
  }

  let config;
  try {
    config = loadClientConfig(credentials);
  } catch (err) {
    return res.status(400).json({ detail: err.message || "Invalid credentials format" });
  }

  if (!config.client_id || !config.client_secret) {
    return res.status(400).json({ detail: "Missing client_id or client_secret in credentials" });
  }

  await UserCredentials.findOneAndUpdate(
    { ownerId },
    {
      encryptedCredentials: encryptToken(JSON.stringify(credentials)),
      clientId: config.client_id,
      uploadedAt: new Date(),
    },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );

  return res.json({ ok: true, clientId: config.client_id });
}

export async function getCredentialsStatus(req, res) {
  const ownerId = req.ownerId;
  const record = await UserCredentials.findOne({ ownerId }).lean();

  return res.json({
    hasCredentials: !!record,
    clientId: record?.clientId || null,
    uploadedAt: record?.uploadedAt || null,
  });
}

export async function deleteCredentials(req, res) {
  await UserCredentials.deleteOne({ ownerId: req.ownerId });
  return res.json({ ok: true });
}

export async function getDecryptedCredentials(ownerId) {
  const record = await UserCredentials.findOne({ ownerId }).lean();
  if (!record?.encryptedCredentials) return null;

  try {
    return JSON.parse(decryptToken(record.encryptedCredentials));
  } catch {
    return null;
  }
}
