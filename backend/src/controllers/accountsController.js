import crypto from "crypto";
import { google } from "googleapis";
import DriveAccount from "../models/DriveAccount.js";
import File from "../models/File.js";
import { encryptToken } from "../services/authService.js";
import {
  getAllQuotas,
  invalidateOAuth2Cache,
  invalidateQuotaCache,
  getOAuth2Client,
  getOAuthFlow,
  getAuthUrl,
  syncFilesFromDrives,
  loadClientConfig,
} from "../services/driveService.js";
import * as config from "../config/index.js";
import { getDecryptedCredentials } from "./credentialsController.js";

const OAUTH_STATE_TTL_MS = 10 * 60_000;

function getStateSecret() {
  if (!config.STATE_SECRET) {
    throw new Error("STATE_SECRET is not configured");
  }
  return config.STATE_SECRET;
}

function createSignedOAuthState(ownerId, accountIndex) {
  const payload = Buffer.from(
    JSON.stringify({ ownerId, accountIndex, issuedAt: Date.now() })
  ).toString("base64url");
  const signature = crypto
    .createHmac("sha256", getStateSecret())
    .update(payload)
    .digest("base64url");

  return `${payload}.${signature}`;
}

function parseSignedOAuthState(state) {
  if (typeof state !== "string") return null;

  const [payload, signature] = state.split(".");
  if (!payload || !signature) return null;

  const expected = crypto.createHmac("sha256", getStateSecret()).update(payload).digest();
  const actual = Buffer.from(signature, "base64url");
  if (expected.length !== actual.length || !crypto.timingSafeEqual(expected, actual)) {
    return null;
  }

  const parsed = JSON.parse(Buffer.from(payload, "base64url").toString("utf-8"));
  if (
    typeof parsed?.ownerId !== "string" ||
    typeof parsed?.accountIndex !== "number" ||
    typeof parsed?.issuedAt !== "number"
  ) {
    return null;
  }

  if (Date.now() - parsed.issuedAt > OAUTH_STATE_TTL_MS) {
    return null;
  }

  return parsed;
}

// ── GET /api/accounts ─────────────────────────────────────────────────────────
export async function listAccounts(req, res) {
  const ownerId = req.ownerId;
  const connectedAccounts = await DriveAccount.find({ ownerId, isConnected: true }).lean();
  const quotas = await getAllQuotas(connectedAccounts, req.clientCredentials);
  const connectedIndices = new Set(quotas.map((q) => q.accountIndex));

  const disconnected = await DriveAccount.find({ ownerId, isConnected: false }).lean();
  for (const acc of disconnected) {
    if (!connectedIndices.has(acc.accountIndex)) {
      quotas.push({
        accountIndex: acc.accountIndex,
        email: acc.email,
        isConnected: false,
        used: 0,
        limit: 0,
        free: 0,
      });
    }
  }

  quotas.sort((a, b) => a.accountIndex - b.accountIndex);

  return res.json(
    quotas.map((q) => ({
      account_index: q.accountIndex,
      email: q.email,
      is_connected: q.isConnected,
      used: q.used,
      limit: q.limit,
      free: q.free,
    }))
  );
}

// ── DELETE /api/accounts/:accountIndex ────────────────────────────────────────
export async function disconnectAccount(req, res) {
  const accountIndex = parseInt(req.params.accountIndex, 10);
  const ownerId = req.ownerId;
  
  if (isNaN(accountIndex)) {
    return res.status(400).json({ detail: "Invalid account index" });
  }

  const account = await DriveAccount.findOne({ ownerId, accountIndex });
  if (account) {
    if (!account.isConnected) {
      await account.deleteOne();
      invalidateOAuth2Cache(ownerId, accountIndex);
      invalidateQuotaCache(ownerId, accountIndex);
      return res.json({ ok: true, removed: true });
    }

    await File.deleteMany({ ownerId, accountIndex });
    account.isConnected = false;
    account.email = null;
    account.refreshToken = null;
    account.accessToken = null;
    account.tokenExpiry = null;
    await account.save();

    invalidateOAuth2Cache(ownerId, accountIndex);
    invalidateQuotaCache(ownerId, accountIndex);
  }

  return res.json({ ok: true });
}

// ── GET /api/accounts/:accountIndex/token ────────────────────────────────────
export async function getAccessToken(req, res) {
  const accountIndex = parseInt(req.params.accountIndex, 10);
  const ownerId = req.ownerId;
  
  if (isNaN(accountIndex)) {
    return res.status(400).json({ detail: "Invalid account index" });
  }

  const account = await DriveAccount.findOne({ ownerId, accountIndex });
  if (!account || !account.isConnected) {
    return res.status(404).json({ detail: "Account not found or not connected" });
  }

  try {
    const oauth2Client = getOAuth2Client(account, req.clientCredentials);
    const { token } = await oauth2Client.getAccessToken();
    return res.json({ accessToken: token });
  } catch (err) {
    console.error("[Account] Error getting token:", err.message);
    const status = err.message.includes("credentials") ? 401 : 500;
    return res.status(status).json({ detail: err.message });
  }
}

// ── GET /api/accounts/oauth/new ───────────────────────────────────────────────
export async function getNewOAuthUrl(req, res) {
  const ownerId = req.ownerId;

  // Cleanup old uncompleted accounts for this user
  await DriveAccount.deleteMany({
    ownerId,
    isConnected: false,
    email: null,
    refreshToken: null,
  });

  const maxAccount = await DriveAccount.findOne({ ownerId }).sort({ accountIndex: -1 });
  const newIndex = maxAccount ? maxAccount.accountIndex + 1 : 1;

  await DriveAccount.create({ ownerId, accountIndex: newIndex, isConnected: false });

  const redirectUri = config.BACKEND_URL.replace(/\/$/, "") + "/api/accounts/oauth/callback";
  const oauth2Client = getOAuthFlow(redirectUri, req.clientCredentials);
  
  const state = createSignedOAuthState(ownerId, newIndex);
  const authUrl = getAuthUrl(oauth2Client, state);

  return res.json({ auth_url: authUrl });
}

// ── GET /api/accounts/oauth/:accountIndex ─────────────────────────────────────
export async function getOAuthUrl(req, res) {
  const accountIndex = parseInt(req.params.accountIndex, 10);
  const ownerId = req.ownerId;
  
  if (isNaN(accountIndex)) {
    return res.status(400).json({ detail: "Invalid account index" });
  }
  
  const redirectUri = config.BACKEND_URL.replace(/\/$/, "") + "/api/accounts/oauth/callback";
  const oauth2Client = getOAuthFlow(redirectUri, req.clientCredentials);
  
  const state = createSignedOAuthState(ownerId, accountIndex);
  const authUrl = getAuthUrl(oauth2Client, state);
  
  return res.json({ auth_url: authUrl });
}

// ── GET /api/accounts/oauth/callback ──────────────────────────────────────────
export async function oauthCallback(req, res) {
  const { code, state, error } = req.query;

  if (error) {
    console.warn("[OAuth] User denied consent or error returned:", error);
    return res.redirect(`${config.FRONTEND_URL}/dashboard/settings?error=oauth_denied`);
  }

  if (!code || !state) {
    return res.redirect(`${config.FRONTEND_URL}/dashboard/settings?error=oauth_invalid`);
  }

  let stateObj;
  try {
    stateObj = parseSignedOAuthState(state);
  } catch {
    stateObj = null;
  }

  if (!stateObj) {
    return res.redirect(`${config.FRONTEND_URL}/dashboard/settings?error=oauth_invalid`);
  }

  const accountIndex = parseInt(stateObj.accountIndex, 10);
  const ownerId = stateObj.ownerId;
  
  if (isNaN(accountIndex) || !ownerId) {
    return res.redirect(`${config.FRONTEND_URL}/dashboard/settings?error=oauth_invalid`);
  }

  try {
    const account = await DriveAccount.findOne({ ownerId, accountIndex });
    if (!account) {
      throw new Error("Account slot not found");
    }

    const clientCredentials = await getDecryptedCredentials(ownerId);
    if (!clientCredentials) {
      throw new Error("Stored credentials not found for this user");
    }

    const redirectUri = config.BACKEND_URL.replace(/\/$/, "") + "/api/accounts/oauth/callback";
    const oauth2Client = getOAuthFlow(redirectUri, clientCredentials);
    const { tokens } = await oauth2Client.getToken(code);
    oauth2Client.setCredentials(tokens);

    const driveApi = google.drive({ version: "v3", auth: oauth2Client });
    const about = await driveApi.about.get({ fields: "user" });
    const email = about.data.user?.emailAddress || "";

    // Check if this email is already connected to another slot for this user
    const existingOther = await DriveAccount.findOne({
      ownerId,
      email,
      accountIndex: { $ne: accountIndex },
      isConnected: true
    });

    if (existingOther) {
      console.warn(`[OAuth] Duplicate account detected: ${email} for owner ${ownerId}`);
      // If we were creating a NEW slot, let's clean it up since it's a duplicate
      if (!account.isConnected && !account.email) {
        await account.deleteOne();
      }
      return res.redirect(`${config.FRONTEND_URL}/dashboard/settings?error=account_already_connected`);
    }

    invalidateOAuth2Cache(ownerId, accountIndex);

    account.email = email;
    account.isConnected = true;

    if (tokens.refresh_token) {
      account.refreshToken = encryptToken(tokens.refresh_token);
    }

    await account.save();

    // Sync in the background for this user
    syncFilesFromDrives(ownerId, clientCredentials).catch((err) =>
      console.error("[Sync] Background sync error:", err.message)
    );

    return res.redirect(`${config.FRONTEND_URL}/dashboard/settings?status=success`);
  } catch (err) {
    console.error("[OAuth] Callback Processing Error:", {
      message: err.message,
      stack: err.stack,
      code: err.code,
      response: err.response?.data
    });
    return res.redirect(`${config.FRONTEND_URL}/dashboard/settings?error=oauth_processing_failed`);
  }
}

// ── POST /api/accounts/verify-credentials ────────────────────────────────────
export async function verifyCredentials(req, res) {
  const creds = req.body?.credentials || req.clientCredentials;
  if (!creds) {
    return res.status(400).json({ detail: "No credentials provided" });
  }

  try {
    const cfg = loadClientConfig(creds);
    if (!cfg.client_id || !cfg.client_secret) {
      throw new Error("Missing client_id or client_secret");
    }
    // Basic verification: try to create an OAuth2 client
    new google.auth.OAuth2(cfg.client_id, cfg.client_secret, cfg.redirect_uris?.[0]);
    return res.json({ ok: true });
  } catch (err) {
    console.warn("[Verify] Invalid credentials provided:", err.message);
    return res.status(400).json({ detail: "Invalid credentials format: " + err.message });
  }
}
