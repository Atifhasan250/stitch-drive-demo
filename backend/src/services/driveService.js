import { google } from "googleapis";
import { Readable } from "stream";
import DriveAccount from "../models/DriveAccount.js";
import File from "../models/File.js";
import { decryptToken } from "./authService.js";
import * as config from "../config/index.js";
import { BoundedTTLCache } from "../utils/BoundedTTLCache.js";

const SCOPES = ["https://www.googleapis.com/auth/drive"];
const PROFILE_FOLDER_NAME = "_StitchDrive_";
const ACCOUNT_SYNC_CONCURRENCY = 2;
const _ownerSyncs = new Map();

export function loadClientConfig(credentials = null) {
  if (!credentials) {
    const err = new Error("You have to upload credentials before doing this action.");
    err.isMissingCredentials = true;
    err.statusCode = 401;
    throw err;
  }
  const parsed = typeof credentials === "string" ? JSON.parse(credentials) : credentials;
  return parsed.web || parsed.installed || parsed;
}

// ── OAuth2 client cache ───────────────────────────────────────────────────────
// One client per account per user. Using a basic cache to avoid expensive 
// decryption on every single request (like thumbnails).
const _oauth2Cache = new Map(); // `${ownerId}_${accountIndex}` → { client, hash }

const _oauth2CacheStore = new BoundedTTLCache(500, 30 * 60_000);
_oauth2Cache.get = _oauth2CacheStore.get.bind(_oauth2CacheStore);
_oauth2Cache.set = _oauth2CacheStore.set.bind(_oauth2CacheStore);
_oauth2Cache.delete = _oauth2CacheStore.delete.bind(_oauth2CacheStore);
_oauth2Cache.clear = _oauth2CacheStore.clear.bind(_oauth2CacheStore);

export function getOAuth2Client(account, credentials = null) {
  const cacheKey = `${account.ownerId}_${account.accountIndex}`;
  const credsHash = credentials ? JSON.stringify(credentials).length : "default";
  const cached = _oauth2Cache.get(cacheKey);

  // If we have a cached client and credentials haven't changed (or not providing custom ones)
  if (cached && cached.hash === credsHash) return cached.client;

  const clientConfig = loadClientConfig(credentials);
  const oauth2Client = new google.auth.OAuth2(
    clientConfig.client_id,
    clientConfig.client_secret,
    clientConfig.redirect_uris?.[0]
  );
  
  const refreshToken = decryptToken(account.refreshToken);
  oauth2Client.setCredentials({ refresh_token: refreshToken });
  
  // Cache the new client
  _oauth2Cache.set(cacheKey, { client: oauth2Client, hash: credsHash });
  
  return oauth2Client;
}

export function invalidateOAuth2Cache(ownerId, accountIndex) {
  if (ownerId && accountIndex != null) _oauth2Cache.delete(`${ownerId}_${accountIndex}`);
  else _oauth2Cache.clear();
}


// ── Quota cache (TTL: 5 minutes) ──────────────────────────────────────────────
// Increased TTL from 60s to 5 min — quota barely changes in real time.
// Invalidated explicitly after upload/delete so counts stay accurate.
const QUOTA_CACHE_TTL_MS = 5 * 60_000;
const _quotaCache = new Map(); // `${ownerId}_${accountIndex}` → { data, expiresAt }

const _quotaCacheStore = new BoundedTTLCache(500, QUOTA_CACHE_TTL_MS);
_quotaCache.get = _quotaCacheStore.get.bind(_quotaCacheStore);
_quotaCache.set = _quotaCacheStore.set.bind(_quotaCacheStore);
_quotaCache.delete = _quotaCacheStore.delete.bind(_quotaCacheStore);
_quotaCache.clear = _quotaCacheStore.clear.bind(_quotaCacheStore);

function getCachedQuota(ownerId, accountIndex) {
  return _quotaCache.get(`${ownerId}_${accountIndex}`) ?? null;
}

function setCachedQuota(ownerId, accountIndex, data) {
  _quotaCache.set(`${ownerId}_${accountIndex}`, data);
}

export function invalidateQuotaCache(ownerId, accountIndex) {
  if (ownerId && accountIndex != null) _quotaCache.delete(`${ownerId}_${accountIndex}`);
  else _quotaCache.clear();
}

/** Sanitize an ID for use in an unparameterized 'q' string to prevent injection */
function sanitizeId(id) {
  return id?.replace(/'/g, "");
}

// ── Rate-limit retry ──────────────────────────────────────────────────────────

async function retryOnRateLimit(fn) {
  const delays = [1000, 2000, 4000];
  for (let attempt = 0; attempt <= delays.length; attempt++) {
    try {
      return await fn();
    } catch (err) {
      const status = err?.code || err?.status || err?.response?.status;
      if (status === 429 && attempt < delays.length) {
        await new Promise((r) => setTimeout(r, delays[attempt]));
      } else {
        throw err;
      }
    }
  }
}

// ── Build authenticated Drive service ─────────────────────────────────────────

export function buildService(account, credentials = null) {
  if (!account.refreshToken) {
    throw new Error(`Account ${account.accountIndex} is not connected (no refresh token)`);
  }
  const oauth2Client = getOAuth2Client(account, credentials);
  return google.drive({ version: "v3", auth: oauth2Client });
}

// ── OAuth flow ────────────────────────────────────────────────────────────────

export function getOAuthFlow(redirectUri, credentials = null) {
  const clientConfig = loadClientConfig(credentials);
  const oauth2Client = new google.auth.OAuth2(
    clientConfig.client_id,
    clientConfig.client_secret,
    redirectUri
  );
  return oauth2Client;
}

export function getAuthUrl(oauth2Client, state) {
  return oauth2Client.generateAuthUrl({
    access_type: "offline",
    scope: SCOPES,
    include_granted_scopes: true,
    prompt: "select_account consent",
    state: String(state),
  });
}

// ── Storage quota (cached) ────────────────────────────────────────────────────

export async function getStorageQuota(account, credentials = null) {
  const cached = getCachedQuota(account.ownerId, account.accountIndex);
  if (cached && !credentials) return cached;
  try {
    const drive = buildService(account, credentials);
    const result = await retryOnRateLimit(() =>
      drive.about.get({ fields: "storageQuota" })
    );
    const quota = result.data.storageQuota;
    const used = parseInt(quota.usage || "0", 10);
    const limit = parseInt(quota.limit || String(15 * 1024 ** 3), 10);
    const data = {
      accountIndex: account.accountIndex,
      email: account.email,
      isConnected: account.isConnected,
      used,
      limit,
      free: Math.max(0, limit - used),
    };
    setCachedQuota(account.ownerId, account.accountIndex, data);
    return data;
  } catch (err) {
    const isRefreshError =
      err.message?.includes("invalid_grant") ||
      err.message?.includes("Token has been expired");
    return {
      accountIndex: account.accountIndex,
      email: account.email,
      isConnected: isRefreshError ? false : account.isConnected,
      used: 0,
      limit: 0,
      free: 0,
    };
  }
}

export async function getAllQuotas(accounts, credentials = null) {
  // All accounts fetched in parallel — not sequential
  const results = await Promise.all(accounts.map((acc) => getStorageQuota(acc, credentials)));
  return results.sort((a, b) => a.accountIndex - b.accountIndex);
}

export async function pickBestAccount(ownerId, credentials = null) {
  const accounts = await DriveAccount.find({ ownerId, isConnected: true }).lean();
  const quotas = await getAllQuotas(accounts, credentials);
  const connected = quotas.filter((q) => q.isConnected && q.free > 0);
  if (!connected.length) return null;
  return connected.reduce((best, q) => (q.free > best.free ? q : best)).accountIndex;
}

// ── Upload ────────────────────────────────────────────────────────────────────

export async function uploadFile(account, fileBuffer, filename, mimeType, parentFolderId = null, credentials = null) {
  const drive = buildService(account, credentials);
  const fileMetadata = { name: filename };
  if (parentFolderId) fileMetadata.parents = [parentFolderId];

  const media = {
    mimeType,
    body: Readable.from(fileBuffer),
  };

  const result = await retryOnRateLimit(() =>
    drive.files.create({
      requestBody: fileMetadata,
      media,
      fields: "id,size,mimeType,thumbnailLink,parents",
      supportsAllDrives: false,
    })
  );

  // Invalidate quota cache after upload so storage bar updates
  invalidateQuotaCache(account.ownerId, account.accountIndex);

  const data = result.data;
  const parent = data.parents?.[0] || null;
  return {
    driveFileId: data.id,
    size: parseInt(data.size || "0", 10),
    mimeType: data.mimeType || mimeType,
    thumbnailLink: data.thumbnailLink || null,
    parentDriveFileId: parent,
  };
}

// ── Download / Stream ─────────────────────────────────────────────────────────

export async function downloadFile(account, driveFileId, credentials = null) {
  const drive = buildService(account, credentials);
  const response = await retryOnRateLimit(() =>
    drive.files.get({ fileId: driveFileId, alt: "media" }, { responseType: "arraybuffer" })
  );
  return Buffer.from(response.data);
}

export async function* streamFile(account, driveFileId, credentials = null) {
  const drive = buildService(account, credentials);
  
  // 1. Get MIME type first to determine if we need to EXPORT or GET (media)
  const meta = await drive.files.get({ fileId: driveFileId, fields: "mimeType" });
  const mimeType = meta.data.mimeType;
  const isWorkspace = mimeType.startsWith("application/vnd.google-apps.");
  const isFolder = mimeType === "application/vnd.google-apps.folder";

  if (isFolder) throw new Error("Folders cannot be streamed directly.");

  let response;
  if (isWorkspace) {
    // Determine export format
    let exportMime = "application/pdf";
    if (mimeType.includes("spreadsheet")) exportMime = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
    
    console.log(`[Drive] Exporting Workspace file (${mimeType}) as ${exportMime}`);
    response = await retryOnRateLimit(() =>
      drive.files.export({ fileId: driveFileId, mimeType: exportMime }, { responseType: "stream" })
    );
  } else {
    response = await retryOnRateLimit(() =>
      drive.files.get({ fileId: driveFileId, alt: "media" }, { responseType: "stream" })
    );
  }

  for await (const chunk of response.data) {
    yield chunk;
  }
}

// ── Rename ────────────────────────────────────────────────────────────────────

export async function renameFile(account, driveFileId, newName, credentials = null) {
  const drive = buildService(account, credentials);
  const result = await retryOnRateLimit(() =>
    drive.files.update({
      fileId: driveFileId,
      requestBody: { name: newName },
      fields: "id,name,thumbnailLink",
    })
  );
  return result.data;
}

// ── Move ──────────────────────────────────────────────────────────────────────

export async function moveFile(account, driveFileId, newParentId, oldParentId = null, credentials = null) {
  const drive = buildService(account, credentials);

  let currentParents = [];
  try {
    const meta = await drive.files.get({ fileId: driveFileId, fields: "id,parents" });
    currentParents = meta.data.parents || [];
  } catch (_) {}

  let removeParents;
  if (currentParents.length) {
    removeParents = currentParents.join(",");
  } else if (oldParentId) {
    removeParents = oldParentId;
  } else {
    try {
      const rootMeta = await drive.files.get({ fileId: "root", fields: "id" });
      removeParents = rootMeta.data.id;
    } catch (_) {
      removeParents = null;
    }
  }

  if (!removeParents) {
    throw new Error(
      "Cannot determine current parent folder — file may be shared from another account and cannot be moved"
    );
  }

  await retryOnRateLimit(() =>
    drive.files.update({
      fileId: driveFileId,
      addParents: newParentId,
      removeParents,
      fields: "id",
    })
  );
}

// ── Delete / Trash / Restore ──────────────────────────────────────────────────

export async function deleteDriveFile(account, driveFileId, credentials = null) {
  const drive = buildService(account, credentials);
  await retryOnRateLimit(() => drive.files.delete({ fileId: driveFileId }));
  invalidateQuotaCache(account.ownerId, account.accountIndex);
}

export async function trashDriveFile(account, driveFileId, credentials = null) {
  const drive = buildService(account, credentials);
  await retryOnRateLimit(() =>
    drive.files.update({ fileId: driveFileId, requestBody: { trashed: true } })
  );
  invalidateQuotaCache(account.ownerId, account.accountIndex);
}

export async function restoreFile(account, driveFileId, credentials = null) {
  const drive = buildService(account, credentials);
  // 1. Tell Google Drive to restore the file
  await retryOnRateLimit(() =>
    drive.files.update({ fileId: driveFileId, requestBody: { trashed: false } })
  );

  // 2. Fetch the metadata to sync to our DB immediately (so it shows up in "Files" list)
  try {
    const result = await drive.files.get({
      fileId: driveFileId,
      fields: "id,name,size,mimeType,thumbnailLink,parents,createdTime",
    });
    const df = result.data;
    await File.findOneAndUpdate(
      { driveFileId, accountIndex: account.accountIndex, ownerId: account.ownerId },
      {
        $set: {
          fileName: df.name || "",
          size: parseInt(df.size || "0", 10),
          mimeType: df.mimeType || null,
          thumbnailLink: df.thumbnailLink || null,
          parentDriveFileId: df.parents?.[0] || null,
          createdAt: new Date(df.createdTime),
        },
      },
      { upsert: true }
    );
  } catch (err) {
    console.warn(`[Restore] Metadata sync failed for ${driveFileId}:`, err.message);
  }
}

// ── Trash listing ─────────────────────────────────────────────────────────────

export async function listTrashFiles(account, credentials = null) {
  const drive = buildService(account, credentials);
  const items = [];
  let pageToken = null;
  do {
    const params = {
      // Fetching all trashed files to ensure completeness, filter by me as primary
      q: "trashed = true", 
      pageSize: 100, // Reduced from 1000 to save RAM on free tier
      fields: "nextPageToken, files(id, name, size, mimeType, trashedTime)",
    };
    if (pageToken) params.pageToken = pageToken;
    const result = await retryOnRateLimit(() => drive.files.list(params));
    for (const f of result.data.files || []) {
      items.push({
        driveFileId: f.id,
        fileName: f.name || "",
        accountIndex: account.accountIndex,
        size: parseInt(f.size || "0", 10),
        mimeType: f.mimeType || null,
        trashedAt: f.trashedTime || "",
      });
    }
    pageToken = result.data.nextPageToken || null;
  } while (pageToken);
  return items;
}

// ── Share / Unshare ───────────────────────────────────────────────────────────

export async function shareFile(account, driveFileId, credentials = null) {
  const drive = buildService(account, credentials);
  await retryOnRateLimit(() =>
    drive.permissions.create({
      fileId: driveFileId,
      requestBody: { type: "anyone", role: "reader" },
      fields: "id",
    })
  );
  const meta = await retryOnRateLimit(() =>
    drive.files.get({ fileId: driveFileId, fields: "webViewLink" })
  );
  return (
    meta.data.webViewLink ||
    `https://drive.google.com/file/d/${driveFileId}/view?usp=sharing`
  );
}

export async function unshareFile(account, driveFileId, credentials = null) {
  const drive = buildService(account, credentials);
  const perms = await retryOnRateLimit(() =>
    drive.permissions.list({ fileId: driveFileId, fields: "permissions(id,type)" })
  );
  const anyoneId = (perms.data.permissions || []).find((p) => p.type === "anyone")?.id;
  if (anyoneId) {
    await retryOnRateLimit(() =>
      drive.permissions.delete({ fileId: driveFileId, permissionId: anyoneId })
    );
  }
}

// ── Shared-with-me ────────────────────────────────────────────────────────────

export async function listSharedFiles(account, credentials = null) {
  const drive = buildService(account, credentials);
  const items = [];
  let pageToken = null;
  do {
    const params = {
      q: "not 'me' in owners and trashed = false",
      pageSize: 1000,
      fields: "nextPageToken, files(id, name, size, mimeType, createdTime, owners)",
    };
    if (pageToken) params.pageToken = pageToken;
    const result = await retryOnRateLimit(() => drive.files.list(params));
    for (const f of result.data.files || []) {
      const owner = f.owners?.[0]?.emailAddress || null;
      items.push({
        driveFileId: f.id,
        fileName: f.name || "",
        accountIndex: account.accountIndex,
        size: parseInt(f.size || "0", 10),
        mimeType: f.mimeType || null,
        createdAt: f.createdTime || "",
        sharedBy: owner,
      });
    }
    pageToken = result.data.nextPageToken || null;
  } while (pageToken);
  return items;
}

export async function listSharedFolderChildren(account, folderId, credentials = null) {
  const drive = buildService(account, credentials);
  const items = [];
  let pageToken = null;
  const safeId = sanitizeId(folderId);
  do {
    const params = {
      q: `'${safeId}' in parents and trashed = false`,
      pageSize: 1000,
      fields: "nextPageToken, files(id, name, size, mimeType, createdTime, owners)",
    };
    if (pageToken) params.pageToken = pageToken;
    const result = await retryOnRateLimit(() => drive.files.list(params));
    for (const f of result.data.files || []) {
      const owner = f.owners?.[0]?.emailAddress || null;
      items.push({
        driveFileId: f.id,
        fileName: f.name || "",
        accountIndex: account.accountIndex,
        size: parseInt(f.size || "0", 10),
        mimeType: f.mimeType || null,
        createdAt: f.createdTime || "",
        sharedBy: owner,
      });
    }
    pageToken = result.data.nextPageToken || null;
  } while (pageToken);
  return items.sort((a, b) => {
    const aIsFolder = a.mimeType === "application/vnd.google-apps.folder" ? 0 : 1;
    const bIsFolder = b.mimeType === "application/vnd.google-apps.folder" ? 0 : 1;
    if (aIsFolder !== bIsFolder) return aIsFolder - bIsFolder;
    return a.fileName.toLowerCase().localeCompare(b.fileName.toLowerCase());
  });
}

export async function removeSharedFile(account, driveFileId, credentials = null) {
  const drive = buildService(account, credentials);

  try {
    await retryOnRateLimit(() => drive.files.delete({ fileId: driveFileId }));
    return;
  } catch (err) {
    const status = err?.code || err?.status || err?.response?.status;
    if (status !== 403 && status !== 404) throw err;
  }

  try {
    await retryOnRateLimit(() =>
      drive.files.update({ fileId: driveFileId, requestBody: { trashed: true } })
    );
    return;
  } catch (err) {
    const status = err?.code || err?.status || err?.response?.status;
    if (status !== 403) throw err;
  }

  try {
    const about = await retryOnRateLimit(() =>
      drive.about.get({ fields: "user(permissionId)" })
    );
    const userPermId = about.data.user?.permissionId;
    await retryOnRateLimit(() =>
      drive.permissions.delete({ fileId: driveFileId, permissionId: userPermId })
    );
    return;
  } catch (err) {
    const status = err?.code || err?.status || err?.response?.status;
    if (status === 404) {
      const e = new Error(
        "This file is shared via link — Google Drive's API does not allow removing " +
          "link-shared files from 'Shared with me'. Use the Google Drive web app to remove it."
      );
      e.isValidation = true;
      throw e;
    }
    throw err;
  }
}

// ── Profile folder ────────────────────────────────────────────────────────────

export async function getOrCreateProfileFolder(account, credentials = null) {
  const drive = buildService(account, credentials);
  const safeName = PROFILE_FOLDER_NAME.replace(/'/g, "");
  const query = `name='${safeName}' and mimeType='application/vnd.google-apps.folder' and trashed=false`;
  const result = await retryOnRateLimit(() =>
    drive.files.list({ q: query, fields: "files(id)" })
  );
  const existing = result.data.files || [];
  if (existing.length) return existing[0].id;

  const folder = await retryOnRateLimit(() =>
    drive.files.create({
      requestBody: {
        name: PROFILE_FOLDER_NAME,
        mimeType: "application/vnd.google-apps.folder",
      },
      fields: "id",
    })
  );
  return folder.data.id;
}

// ── List all owned files (for sync) ──────────────────────────────────────────

export async function listAllFiles(account, credentials = null) {
  const drive = buildService(account, credentials);
  const items = [];
  let pageToken = null;
  do {
    const params = {
      q: "'me' in owners and trashed = false",
      pageSize: 1000,
      fields: "nextPageToken, files(id, name, size, mimeType, thumbnailLink, createdTime, parents)",
    };
    if (pageToken) params.pageToken = pageToken;
    const result = await retryOnRateLimit(() => drive.files.list(params));
    items.push(...(result.data.files || []));
    pageToken = result.data.nextPageToken || null;
  } while (pageToken);
  return items;
}

// ── Sync ──────────────────────────────────────────────────────────────────────

function parseDriveTime(s) {
  if (!s) return new Date();
  return new Date(s);
}

function isOwnedDriveFile(file) {
  return Array.isArray(file?.owners) && file.owners.some((owner) => owner?.me);
}

async function getStartPageToken(account, credentials = null) {
  const drive = buildService(account, credentials);
  const result = await retryOnRateLimit(() => drive.changes.getStartPageToken());
  return result.data.startPageToken || null;
}

async function upsertAccountFiles(ownerId, accountIndex, driveFiles) {
  if (!driveFiles || driveFiles.length === 0) return;

  const ops = driveFiles.map((df) => ({
    updateOne: {
      filter: { ownerId, driveFileId: df.id, accountIndex },
      update: {
        $set: {
          fileName: df.name || "",
          size: parseInt(df.size || "0", 10),
          mimeType: df.mimeType || null,
          thumbnailLink: df.thumbnailLink || null,
          parentDriveFileId: df.parents?.[0] || null,
        },
        $setOnInsert: {
          driveFileId: df.id,
          accountIndex,
          ownerId,
          createdAt: parseDriveTime(df.createdTime),
        },
      },
      upsert: true,
    },
  }));

  await File.bulkWrite(ops, { ordered: false });
}

async function fullSyncAccount(account, credentials = null) {
  const driveFiles = await listAllFiles(account, credentials);
  const driveIds = new Set(driveFiles.map((f) => f.id));

  await File.deleteMany({
    ownerId: account.ownerId,
    accountIndex: account.accountIndex,
    driveFileId: { $nin: Array.from(driveIds) },
  });

  await upsertAccountFiles(account.ownerId, account.accountIndex, driveFiles);

  account.changesPageToken = await getStartPageToken(account, credentials);
  await account.save();
}

async function incrementalSyncAccount(account, credentials = null) {
  const drive = buildService(account, credentials);
  const changedFiles = [];
  const deletedIds = new Set();
  let pageToken = account.changesPageToken;
  let nextStartPageToken = null;

  do {
    const result = await retryOnRateLimit(() =>
      drive.changes.list({
        pageToken,
        pageSize: 1000,
        fields: "nextPageToken,newStartPageToken,changes(fileId,removed,file(id,name,size,mimeType,thumbnailLink,createdTime,parents,trashed,owners(me)))",
      })
    );

    for (const change of result.data.changes || []) {
      const driveFileId = change.fileId;
      if (!driveFileId) continue;

      if (change.removed || change.file?.trashed || !change.file || !isOwnedDriveFile(change.file)) {
        deletedIds.add(driveFileId);
        continue;
      }

      changedFiles.push(change.file);
    }

    pageToken = result.data.nextPageToken || null;
    nextStartPageToken = result.data.newStartPageToken || nextStartPageToken;
  } while (pageToken);

  if (deletedIds.size > 0) {
    await File.deleteMany({
      ownerId: account.ownerId,
      accountIndex: account.accountIndex,
      driveFileId: { $in: Array.from(deletedIds) },
    });
  }

  await upsertAccountFiles(account.ownerId, account.accountIndex, changedFiles);

  if (nextStartPageToken) {
    account.changesPageToken = nextStartPageToken;
    await account.save();
  }
}

async function runWithConcurrency(items, concurrency, worker) {
  const queue = [...items];
  const runners = Array.from({ length: Math.min(concurrency, queue.length) }, async () => {
    while (queue.length > 0) {
      const item = queue.shift();
      if (item) {
        await worker(item);
      }
    }
  });
  await Promise.allSettled(runners);
}

export async function syncFilesFromDrives(ownerId, credentials = null) {
  const inFlight = _ownerSyncs.get(ownerId);
  if (inFlight) return inFlight;

  const syncPromise = (async () => {
    const accounts = await DriveAccount.find({ ownerId, isConnected: true });
    await runWithConcurrency(accounts, ACCOUNT_SYNC_CONCURRENCY, async (account) => {
      try {
        if (!account.changesPageToken) {
          await fullSyncAccount(account, credentials);
        } else {
          try {
            await incrementalSyncAccount(account, credentials);
          } catch (err) {
            const status = err?.code || err?.status || err?.response?.status;
            if (status === 410) {
              account.changesPageToken = null;
              await account.save();
              await fullSyncAccount(account, credentials);
            } else {
              throw err;
            }
          }
        }

        invalidateQuotaCache(account.ownerId, account.accountIndex);
      } catch (err) {
        console.error(`[Sync] Error syncing account ${account.accountIndex}:`, err.message);
      }
    });
  })();

  _ownerSyncs.set(ownerId, syncPromise);
  try {
    await syncPromise;
  } finally {
    _ownerSyncs.delete(ownerId);
  }
}
export async function cleanupDeletedFiles(ownerId, accountIndex, currentDriveIds) {
  await File.deleteMany({
    ownerId,
    accountIndex,
    driveFileId: { $nin: currentDriveIds },
  });
}

export async function reconcileAccountFiles(ownerId, accountIndex, driveFiles) {
  await upsertAccountFiles(ownerId, accountIndex, driveFiles);
}
