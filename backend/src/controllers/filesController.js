import mongoose from "mongoose";
import DriveAccount from "../models/DriveAccount.js";
import File from "../models/File.js";
import { fetchWithTimeout } from "../utils/fetchWithTimeout.js";
import {
  getOAuth2Client,
  listSharedFiles,
  listSharedFolderChildren,
  listTrashFiles,
  moveFile,
  pickBestAccount,
  removeSharedFile,
  renameFile,
  restoreFile,
  shareFile,
  streamFile,
  syncFilesFromDrives,
  trashDriveFile,
  unshareFile,
  uploadFile,
  buildService,
  deleteDriveFile,
  cleanupDeletedFiles,
  reconcileAccountFiles,
} from "../services/driveService.js";

const SAFE_THUMBNAIL_HOSTS = [
  "lh3.googleusercontent.com",
  "lh4.googleusercontent.com",
  "lh5.googleusercontent.com",
  "lh6.googleusercontent.com",
  "drive.google.com",
  "docs.google.com",
];
const DRIVE_ID_REGEX = /^[a-zA-Z0-9_-]{10,200}$/;
const FOLDER_MIME_TYPE = "application/vnd.google-apps.folder";
const MAX_INLINE_VIEW_SIZE = 100 * 1024 * 1024;

// ── Helpers ───────────────────────────────────────────────────────────────────

function isValidObjectId(id) {
  return mongoose.Types.ObjectId.isValid(id);
}

function fileToDict(f) {
  return {
    id: f._id.toString(),
    file_name: f.fileName,
    drive_file_id: f.driveFileId,
    account_index: f.accountIndex,
    size: f.size,
    mime_type: f.mimeType,
    has_thumbnail: f.thumbnailLink != null,
    parent_drive_file_id: f.parentDriveFileId,
    created_at: f.createdAt instanceof Date ? f.createdAt.toISOString() : f.createdAt,
  };
}

function isSafeThumbnailUrl(urlString) {
  try {
    const parsed = new URL(urlString);
    if (parsed.protocol !== "https:") return false;
    return SAFE_THUMBNAIL_HOSTS.some((host) =>
      parsed.hostname === host || parsed.hostname.endsWith(`.${host}`)
    );
  } catch {
    return false;
  }
}

function isValidFileName(name) {
  if (!name) return false;
  if (name.length > 255) return false;
  if (name === "." || name === "..") return false;
  if (/[\/\\\0]/.test(name)) return false;
  if (/[\u0000-\u001f]/.test(name)) return false;
  return true;
}

function isValidDriveId(id) {
  return typeof id === "string" && DRIVE_ID_REGEX.test(id);
}

function requireDriveId(id, fieldName = "driveFileId", options = {}) {
  if (options.allowRoot && id === "root") {
    return id;
  }

  if (!isValidDriveId(id)) {
    const err = new Error(`Invalid ${fieldName}`);
    err.statusCode = 400;
    throw err;
  }

  return id;
}

function buildTypeQuery(type) {
  switch (type) {
    case "folder":
      return { mimeType: FOLDER_MIME_TYPE };
    case "image":
      return { mimeType: /^image\// };
    case "video":
      return { mimeType: /^video\// };
    case "audio":
      return { mimeType: /^audio\// };
    case "pdf":
      return { mimeType: /pdf/i };
    case "doc":
      return {
        $or: [
          { mimeType: /document/i },
          { mimeType: /^text\// },
        ],
      };
    case "sheet":
      return { mimeType: /(spreadsheet|sheet)/i };
    case "archive":
      return { mimeType: /(zip|compressed|archive)/i };
    default:
      return null;
  }
}

function buildSort(sortBy) {
  switch (sortBy) {
    case "name-asc":
      return { fileName: 1, _id: 1 };
    case "name-desc":
      return { fileName: -1, _id: -1 };
    case "size-asc":
      return { size: 1, _id: 1 };
    case "size-desc":
      return { size: -1, _id: -1 };
    case "date-asc":
      return { createdAt: 1, _id: 1 };
    default:
      return { createdAt: -1, _id: -1 };
  }
}

async function sendThumbnailResponse(urlString, res) {
  const response = await fetchWithTimeout(urlString, {}, 5000);
  if (!response.ok) {
    const err = new Error("Failed to fetch thumbnail from Google");
    err.httpStatus = response.status;
    throw err;
  }

  const contentType = response.headers.get("content-type") || "image/jpeg";
  res.setHeader("Content-Type", contentType);
  res.setHeader("Cache-Control", "public, max-age=604800, stale-while-revalidate=86400");

  const buffer = await response.arrayBuffer();
  return res.send(Buffer.from(buffer));
}

// ── POST /api/files/sync ──────────────────────────────────────────────────────
export async function syncFiles(req, res) {
  const ownerId = req.ownerId;
  try {
    await syncFilesFromDrives(ownerId, req.clientCredentials);
    return res.json({ ok: true });
  } catch (err) {
    console.error(`[Sync] Error for ${ownerId}:`, err.message);
    return res.status(500).json({ detail: "Synchronization failed" });
  }
}

// ── GET /api/files ────────────────────────────────────────────────────────────
export async function listFiles(req, res) {
  const ownerId = req.ownerId;
  const page = Math.max(1, parseInt(req.query.page, 10) || 1);
  const limit = Math.min(Math.max(1, parseInt(req.query.limit, 10) || 1000), 5000);
  const skip = (page - 1) * limit;
  const requestedParent = typeof req.query.parent === "string" ? req.query.parent : null;
  const foldersOnly = req.query.foldersOnly === "true";
  const search = typeof req.query.search === "string" ? req.query.search.trim() : "";
  const type = typeof req.query.type === "string" ? req.query.type : "all";
  const sortBy = typeof req.query.sort === "string" ? req.query.sort : "date-desc";
  const requestedAccountIndex =
    typeof req.query.accountIndex === "string" && req.query.accountIndex !== "all"
      ? parseInt(req.query.accountIndex, 10)
      : null;
  const connected = await DriveAccount.find({ ownerId, isConnected: true }).select("accountIndex").lean();
  const connectedIndices = connected.map((a) => a.accountIndex);
  const scopedIndices =
    requestedAccountIndex != null && connectedIndices.includes(requestedAccountIndex)
      ? [requestedAccountIndex]
      : connectedIndices;

  const query = { ownerId, accountIndex: { $in: scopedIndices } };
  const andConditions = [];

  if (foldersOnly) {
    query.mimeType = FOLDER_MIME_TYPE;
  }

  const typeQuery = buildTypeQuery(type);
  if (typeQuery) {
    andConditions.push(typeQuery);
  }

  if (search) {
    query.fileName = { $regex: search.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), $options: "i" };
  }

  if (requestedParent === "root") {
    const folderDocs = await File.find({
      ownerId,
      accountIndex: { $in: scopedIndices },
      mimeType: FOLDER_MIME_TYPE,
    })
      .select("driveFileId -_id")
      .lean();
    const folderIds = folderDocs.map((doc) => doc.driveFileId);
    andConditions.push({
      $or: [
        { parentDriveFileId: null },
        { parentDriveFileId: { $nin: folderIds } },
      ],
    });
  } else if (requestedParent) {
    requireDriveId(requestedParent, "parent");
    query.parentDriveFileId = requestedParent;
  }

  if (andConditions.length > 0) {
    query.$and = andConditions;
  }

  const [files, total] = await Promise.all([
    File.find(query)
      .sort(buildSort(sortBy))
      .skip(skip)
      .limit(limit)
      .lean(),
    File.countDocuments(query),
  ]);

  res.setHeader("X-Total-Count", total);
  res.setHeader("X-Page", page);
  res.setHeader("X-Limit", limit);
  return res.json(files.map(fileToDict));
}

// ── POST /api/files/upload/initiate ───────────────────────────────────────────
export async function initiateUpload(req, res) {
  const ownerId = req.ownerId;
  const { fileName, mimeType, parentFolderId } = req.body;
  let { accountIndex } = req.body;

  if (parentFolderId) {
    try {
      requireDriveId(parentFolderId, "parentFolderId");
    } catch (err) {
      return res.status(err.statusCode || 400).json({ detail: err.message });
    }
  }

  if (accountIndex === undefined || accountIndex === null) {
    accountIndex = await pickBestAccount(ownerId, req.clientCredentials);
  }

  if (accountIndex === null) {
    return res.status(503).json({ detail: "No connected Drive accounts available" });
  }

  const account = await DriveAccount.findOne({ ownerId, accountIndex });
  if (!account) return res.status(404).json({ detail: "Account not found" });

  try {
    const oauth2Client = getOAuth2Client(account, req.clientCredentials);
    const { token } = await oauth2Client.getAccessToken();

    const metadata = { name: fileName };
    if (parentFolderId) metadata.parents = [parentFolderId];

    const response = await fetchWithTimeout(
      "https://www.googleapis.com/upload/drive/v3/files?uploadType=resumable",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json; charset=UTF-8",
          "Origin": req.get("origin"),
          "X-Upload-Content-Type": mimeType || "application/octet-stream",
        },
        body: JSON.stringify(metadata),
      },
      10_000
    );

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`Google Drive API error: ${errText}`);
    }

    const sessionUrl = response.headers.get("location");
    return res.json({ sessionUrl, accountIndex });
  } catch (err) {
    console.error("[Upload] Error initiating session:", err.message);
    return res.status(500).json({ detail: err.message });
  }
}

// ── POST /api/files/upload/finalize ───────────────────────────────────────────
export async function finalizeUpload(req, res) {
  const ownerId = req.ownerId;
  const { driveFileId, accountIndex } = req.body;
  try {
    requireDriveId(driveFileId, "driveFileId");
  } catch (err) {
    return res.status(err.statusCode || 400).json({ detail: err.message });
  }
  const account = await DriveAccount.findOne({ ownerId, accountIndex });
  if (!account) return res.status(404).json({ detail: "Account not found" });

  try {
    const drive = buildService(account, req.clientCredentials);
    let result = await drive.files.get({
      fileId: driveFileId,
      fields: "id,name,size,mimeType,thumbnailLink,parents,createdTime",
    });

    if (!result.data.thumbnailLink && result.data.mimeType?.startsWith("image/")) {
       await new Promise(resolve => setTimeout(resolve, 2000));
       result = await drive.files.get({
         fileId: driveFileId,
         fields: "id,name,size,mimeType,thumbnailLink,parents,createdTime",
       });
    }

    const data = result.data;
    const dbFile = await File.findOneAndUpdate(
      { ownerId, driveFileId: data.id, accountIndex },
      {
        $set: {
          fileName: data.name,
          size: parseInt(data.size || "0", 10),
          mimeType: data.mimeType,
          thumbnailLink: data.thumbnailLink || null,
          parentDriveFileId: data.parents?.[0] || null,
          createdAt: new Date(data.createdTime),
        },
      },
      { upsert: true, new: true }
    );

    return res.json(fileToDict(dbFile));
  } catch (err) {
    console.error("[Upload] Error finalizing:", err.message);
    return res.status(500).json({ detail: err.message });
  }
}

// ── GET /api/files/:fileId/thumbnail ─────────────────────────────────────────
export async function abortUpload(req, res) {
  const ownerId = req.ownerId;
  const { driveFileId, accountIndex } = req.body;

  if (!driveFileId || accountIndex === undefined) {
    return res.status(400).json({ detail: "driveFileId and accountIndex are required" });
  }

  try {
    requireDriveId(driveFileId, "driveFileId");
  } catch (err) {
    return res.status(err.statusCode || 400).json({ detail: err.message });
  }

  const account = await DriveAccount.findOne({ ownerId, accountIndex });
  if (!account || !account.isConnected) {
    return res.status(404).json({ detail: "Account not found" });
  }

  try {
    await deleteDriveFile(account, driveFileId, req.clientCredentials);
    return res.status(204).send();
  } catch (err) {
    console.error("[Upload] Abort error:", err.message);
    return res.status(500).json({ detail: "Failed to abort upload" });
  }
}

export async function getThumbnail(req, res) {
  const ownerId = req.ownerId;
  if (!isValidObjectId(req.params.fileId)) {
    return res.status(404).json({ detail: "File not found" });
  }
  const file = await File.findOne({ _id: req.params.fileId, ownerId });
  if (!file) return res.status(404).json({ detail: "File not found" });

  if (!file.thumbnailLink) {
    return res.status(404).json({ detail: "Thumbnail not available" });
  }

  if (!isSafeThumbnailUrl(file.thumbnailLink)) {
    return res.status(400).json({ detail: "Unsafe thumbnail URL" });
  }

  try {
    return await sendThumbnailResponse(file.thumbnailLink, res);
  } catch (err) {
    const status = err.httpStatus;
    if (status !== 401 && status !== 403) {
      console.error(`[Thumbnail] Error for file ${file.driveFileId}:`, err.message);
      return res.status(502).json({ detail: "Error fetching thumbnail proxy" });
    }
  }

  const account = await DriveAccount.findOne({ ownerId, accountIndex: file.accountIndex });
  if (!account || !account.isConnected) {
    return res.status(503).json({ detail: "Account not connected" });
  }

  try {
    const drive = buildService(account, req.clientCredentials);
    const meta = await drive.files.get({
      fileId: file.driveFileId,
      fields: "thumbnailLink",
    });
    const freshUrl = meta.data.thumbnailLink;
    if (!freshUrl || !isSafeThumbnailUrl(freshUrl)) {
      return res.status(404).json({ detail: "Thumbnail not available" });
    }

    if (freshUrl !== file.thumbnailLink) {
      file.thumbnailLink = freshUrl;
      await file.save();
    }

    return await sendThumbnailResponse(freshUrl, res);
  } catch (err) {
    console.error(`[Thumbnail] Refresh error for file ${file.driveFileId}:`, err.message);
    return res.status(502).json({ detail: "Error fetching thumbnail proxy" });
  }
}

// ── GET /api/files/:fileId/download ──────────────────────────────────────────
export async function getDownload(req, res) {
  const ownerId = req.ownerId;
  if (!isValidObjectId(req.params.fileId)) {
    return res.status(404).json({ detail: "File not found" });
  }
  const file = await File.findOne({ _id: req.params.fileId, ownerId });
  if (!file) return res.status(404).json({ detail: "File not found" });

  const account = await DriveAccount.findOne({ ownerId, accountIndex: file.accountIndex });
  if (!account || !account.isConnected) {
    return res.status(503).json({ detail: "Account not connected" });
  }

  const safeName = encodeURIComponent(file.fileName).replace(/'/g, "%27").replace(/\(/g, "%28").replace(/\)/g, "%29");
  res.setHeader("Content-Disposition", `attachment; filename="${file.fileName.replace(/"/g, '\\"')}"; filename*=UTF-8''${safeName}`);
  res.setHeader("Content-Type", file.mimeType || "application/octet-stream");

  try {
    for await (const chunk of streamFile(account, file.driveFileId, req.clientCredentials)) {
      res.write(chunk);
    }
    res.end();
  } catch (err) {
    console.error(`[DownloadStream] Error streaming file ${file.driveFileId}:`, err.message);
    if (!res.headersSent) {
      res.status(500).json({ detail: "Error streaming file" });
    } else {
      res.destroy();
    }
  }
}

// ── GET /api/files/:fileId/view ───────────────────────────────────────────────
export async function getView(req, res) {
  const ownerId = req.ownerId;
  if (!isValidObjectId(req.params.fileId)) {
    return res.status(404).json({ detail: "File not found" });
  }
  const file = await File.findOne({ _id: req.params.fileId, ownerId });
  if (!file) return res.status(404).json({ detail: "File not found" });

  if ((file.size || 0) > MAX_INLINE_VIEW_SIZE) {
    return res.status(413).json({
      detail: "This file is too large to preview through the server. Open it in Google Drive instead.",
    });
  }

  const account = await DriveAccount.findOne({ ownerId, accountIndex: file.accountIndex });
  if (!account || !account.isConnected) {
    return res.status(503).json({ detail: "Account not connected" });
  }

  const safeName = encodeURIComponent(file.fileName).replace(/'/g, "%27").replace(/\(/g, "%28").replace(/\)/g, "%29");
  res.setHeader("Content-Disposition", `inline; filename="${file.fileName.replace(/"/g, '\\"')}"; filename*=UTF-8''${safeName}`);
  res.setHeader("Content-Type", file.mimeType || "application/octet-stream");

  try {
    for await (const chunk of streamFile(account, file.driveFileId, req.clientCredentials)) {
      res.write(chunk);
    }
    res.end();
  } catch (err) {
    console.error(`[ViewStream] Error streaming file ${file.driveFileId}:`, err.message);
    if (!res.headersSent) {
      res.status(500).json({ detail: "Error streaming file" });
    } else {
      res.destroy();
    }
  }
}

// ── PATCH /api/files/:fileId/rename ──────────────────────────────────────────
export async function rename(req, res) {
  const ownerId = req.ownerId;
  if (!isValidObjectId(req.params.fileId)) {
    return res.status(404).json({ detail: "File not found" });
  }

  const newName = req.body.new_name?.trim();
  if (!newName) {
    return res.status(400).json({ detail: "new_name is required and cannot be empty" });
  }
  if (!isValidFileName(newName)) {
    return res.status(400).json({ detail: "Invalid file name" });
  }

  const file = await File.findOne({ _id: req.params.fileId, ownerId });
  if (!file) return res.status(404).json({ detail: "File not found" });

  const account = await DriveAccount.findOne({ ownerId, accountIndex: file.accountIndex });
  if (!account) return res.status(404).json({ detail: "Account not found" });

  await renameFile(account, file.driveFileId, newName, req.clientCredentials);
  file.fileName = newName;
  await file.save();

  return res.json(fileToDict(file));
}

// ── PATCH /api/files/:fileId/move ─────────────────────────────────────────────
export async function moveFileRoute(req, res) {
  const ownerId = req.ownerId;
  if (!isValidObjectId(req.params.fileId)) {
    return res.status(404).json({ detail: "File not found" });
  }

  const { new_parent_drive_file_id } = req.body;
  if (!new_parent_drive_file_id) {
    return res.status(400).json({ detail: "new_parent_drive_file_id is required" });
  }
  try {
    requireDriveId(new_parent_drive_file_id, "new_parent_drive_file_id", { allowRoot: true });
  } catch (err) {
    return res.status(err.statusCode || 400).json({ detail: err.message });
  }

  const file = await File.findOne({ _id: req.params.fileId, ownerId });
  if (!file) return res.status(404).json({ detail: "File not found" });

  const account = await DriveAccount.findOne({ ownerId, accountIndex: file.accountIndex });
  if (!account) return res.status(404).json({ detail: "Account not found" });

  try {
    await moveFile(account, file.driveFileId, new_parent_drive_file_id, file.parentDriveFileId, req.clientCredentials);
  } catch (err) {
    console.error("[moveFile] Error:", err.message);
    return res.status(503).json({ detail: err.message });
  }

  file.parentDriveFileId =
    new_parent_drive_file_id === "root" ? null : new_parent_drive_file_id;
  await file.save();
  return res.json(fileToDict(file));
}

// ── POST /api/files/:fileId/share ─────────────────────────────────────────────
export async function shareFileRoute(req, res) {
  const ownerId = req.ownerId;
  if (!isValidObjectId(req.params.fileId)) {
    return res.status(404).json({ detail: "File not found" });
  }
  const file = await File.findOne({ _id: req.params.fileId, ownerId });
  if (!file) return res.status(404).json({ detail: "File not found" });

  const account = await DriveAccount.findOne({ ownerId, accountIndex: file.accountIndex });
  if (!account || !account.isConnected) {
    return res.status(503).json({ detail: "Account not connected" });
  }

  try {
    const link = await shareFile(account, file.driveFileId, req.clientCredentials);
    return res.json({ link });
  } catch (err) {
    console.error("[shareFile] Error:", err.message);
    return res.status(500).json({ detail: err.message });
  }
}

// ── DELETE /api/files/:fileId/share ──────────────────────────────────────────
export async function unshareFileRoute(req, res) {
  const ownerId = req.ownerId;
  if (!isValidObjectId(req.params.fileId)) {
    return res.status(404).json({ detail: "File not found" });
  }
  const file = await File.findOne({ _id: req.params.fileId, ownerId });
  if (!file) return res.status(404).json({ detail: "File not found" });

  const account = await DriveAccount.findOne({ ownerId, accountIndex: file.accountIndex });
  if (!account || !account.isConnected) {
    return res.status(503).json({ detail: "Account not connected" });
  }

  try {
    await unshareFile(account, file.driveFileId, req.clientCredentials);
    return res.status(204).send();
  } catch (err) {
    console.error("[unshareFile] Error:", err.message);
    return res.status(500).json({ detail: err.message });
  }
}

// ── DELETE /api/files/:fileId ─────────────────────────────────────────────────
export async function deleteFile(req, res) {
  const ownerId = req.ownerId;
  if (!isValidObjectId(req.params.fileId)) {
    return res.status(404).json({ detail: "File not found" });
  }
  const file = await File.findOne({ _id: req.params.fileId, ownerId });
  if (!file) return res.status(404).json({ detail: "File not found" });

  const account = await DriveAccount.findOne({ ownerId, accountIndex: file.accountIndex });
  let trashSuccess = false;

  if (account && account.isConnected) {
    try {
      await trashDriveFile(account, file.driveFileId, req.clientCredentials);
      trashSuccess = true;
    } catch (err) {
      const status = err?.code || err?.status || err?.response?.status;
      // If already gone (404), we consider it a success for our sync
      if (status === 404) trashSuccess = true;
      else {
        console.error(`[Delete] Trash failed for ${file.driveFileId}:`, err.message);
        return res.status(500).json({ detail: "Could not move file to trash in Google Drive" });
      }
    }
  } else {
    // If account is disconnected, we can't trash it on Drive. 
    // Usually we should error out to prevent desync.
    return res.status(400).json({ detail: "Account disconnected. Reconnect to delete." });
  }

  if (trashSuccess) {
    await file.deleteOne();
    return res.status(204).send();
  }
}

// ── GET /api/files/shared/:accountIndex/:driveFileId/download ─────────────────
export async function downloadSharedFile(req, res) {
  const ownerId = req.ownerId;
  const accountIndex = parseInt(req.params.accountIndex, 10);
  if (isNaN(accountIndex)) return res.status(400).json({ detail: "Invalid account index" });
  const { driveFileId } = req.params;
  try {
    requireDriveId(driveFileId, "driveFileId");
  } catch (err) {
    return res.status(err.statusCode || 400).json({ detail: err.message });
  }

  const account = await DriveAccount.findOne({ ownerId, accountIndex });
  if (!account || !account.isConnected) {
    return res.status(503).json({ detail: "Account not connected" });
  }

  const safeName = encodeURIComponent(driveFileId).replace(/'/g, "%27").replace(/\(/g, "%28").replace(/\)/g, "%29");
  res.setHeader("Content-Disposition", `attachment; filename="${driveFileId.replace(/"/g, '\\"')}"; filename*=UTF-8''${safeName}`);
  res.setHeader("Content-Type", "application/octet-stream");

  try {
    for await (const chunk of streamFile(account, driveFileId, req.clientCredentials)) {
      res.write(chunk);
    }
    res.end();
  } catch (err) {
    console.error(`[SharedStream] Error streaming file ${driveFileId}:`, err.message);
    if (!res.headersSent) {
      res.status(500).json({ detail: "Error streaming file" });
    } else {
      res.destroy();
    }
  }
}

// ── GET /api/files/shared/:accountIndex/:folderId/children ────────────────────
export async function listSharedChildren(req, res) {
  const ownerId = req.ownerId;
  const accountIndex = parseInt(req.params.accountIndex, 10);
  if (isNaN(accountIndex)) return res.status(400).json({ detail: "Invalid account index" });
  const { folderId } = req.params;
  try {
    requireDriveId(folderId, "folderId");
  } catch (err) {
    return res.status(err.statusCode || 400).json({ detail: err.message });
  }

  const account = await DriveAccount.findOne({ ownerId, accountIndex });
  if (!account || !account.isConnected) {
    return res.status(503).json({ detail: "Account not connected" });
  }

  try {
    const items = await listSharedFolderChildren(account, folderId, req.clientCredentials);
    return res.json(
      items.map((i) => ({
        drive_file_id: i.driveFileId,
        file_name: i.fileName,
        account_index: i.accountIndex,
        size: i.size,
        mime_type: i.mimeType,
        created_at: i.createdAt,
        shared_by: i.sharedBy,
      }))
    );
  } catch (err) {
    return res.status(500).json({ detail: err.message });
  }
}

// ── DELETE /api/files/shared/:accountIndex/:driveFileId ──────────────────────
export async function deleteSharedFile(req, res) {
  const ownerId = req.ownerId;
  const accountIndex = parseInt(req.params.accountIndex, 10);
  if (isNaN(accountIndex)) return res.status(400).json({ detail: "Invalid account index" });
  const { driveFileId } = req.params;
  try {
    requireDriveId(driveFileId, "driveFileId");
  } catch (err) {
    return res.status(err.statusCode || 400).json({ detail: err.message });
  }

  const account = await DriveAccount.findOne({ ownerId, accountIndex });
  if (!account || !account.isConnected) {
    return res.status(503).json({ detail: "Account not connected" });
  }

  try {
    await removeSharedFile(account, driveFileId, req.clientCredentials);
    return res.status(204).send();
  } catch (err) {
    if (err.isValidation) {
      return res.status(422).json({ detail: err.message });
    }
    return res.status(500).json({ detail: err.message });
  }
}

// ── GET /api/files/shared ─────────────────────────────────────────────────────
export async function listShared(req, res) {
  const ownerId = req.ownerId;
  const accounts = await DriveAccount.find({ ownerId, isConnected: true }).lean();
  const settled = await Promise.allSettled(accounts.map((acc) => listSharedFiles(acc, req.clientCredentials)));
  const results = settled
    .filter((r) => r.status === "fulfilled")
    .flatMap((r) => r.value);

  results.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  return res.json(
    results.map((i) => ({
      drive_file_id: i.driveFileId,
      file_name: i.fileName,
      account_index: i.accountIndex,
      size: i.size,
      mime_type: i.mimeType,
      created_at: i.createdAt,
      shared_by: i.sharedBy,
    }))
  );
}

// ── GET /api/files/trash ──────────────────────────────────────────────────────
export async function listTrash(req, res) {
  const ownerId = req.ownerId;
  const accounts = await DriveAccount.find({ ownerId, isConnected: true }).lean();
  const settled = await Promise.allSettled(accounts.map((acc) => listTrashFiles(acc, req.clientCredentials)));
  const results = settled
    .filter((r) => r.status === "fulfilled")
    .flatMap((r) => r.value);

  results.sort((a, b) => b.trashedAt.localeCompare(a.trashedAt));
  return res.json(
    results.map((i) => ({
      drive_file_id: i.driveFileId,
      file_name: i.fileName,
      account_index: i.accountIndex,
      size: i.size,
      mime_type: i.mimeType,
      trashed_at: i.trashedAt,
    }))
  );
}

// ── POST /api/files/trash/:accountIndex/:driveFileId/restore ─────────────────
export async function restoreTrashFile(req, res) {
  const ownerId = req.ownerId;
  const accountIndex = parseInt(req.params.accountIndex, 10);
  if (isNaN(accountIndex)) return res.status(400).json({ detail: "Invalid account index" });
  const { driveFileId } = req.params;
  try {
    requireDriveId(driveFileId, "driveFileId");
  } catch (err) {
    return res.status(err.statusCode || 400).json({ detail: err.message });
  }

  const account = await DriveAccount.findOne({ ownerId, accountIndex });
  if (!account || !account.isConnected) {
    return res.status(503).json({ detail: "Account not connected" });
  }

  try {
    await restoreFile(account, driveFileId, req.clientCredentials);
    return res.status(204).send();
  } catch (err) {
    return res.status(500).json({ detail: err.message });
  }
}

// ── DELETE /api/files/trash/:accountIndex/:driveFileId ───────────────────────
export async function deleteTrashFile(req, res) {
  const ownerId = req.ownerId;
  const accountIndex = parseInt(req.params.accountIndex, 10);
  if (isNaN(accountIndex)) return res.status(400).json({ detail: "Invalid account index" });
  const { driveFileId } = req.params;
  try {
    requireDriveId(driveFileId, "driveFileId");
  } catch (err) {
    return res.status(err.statusCode || 400).json({ detail: err.message });
  }

  const account = await DriveAccount.findOne({ ownerId, accountIndex });
  if (!account || !account.isConnected) {
    return res.status(503).json({ detail: "Account not connected" });
  }

  try {
    await deleteDriveFile(account, driveFileId, req.clientCredentials);
    return res.status(204).send();
  } catch (err) {
    return res.status(500).json({ detail: err.message });
  }
}
// ── POST /api/files/cleanup ──────────────────────────────────────────────────
export async function cleanupFiles(req, res) {
  const ownerId = req.ownerId;
  const { accountIndex, currentDriveIds } = req.body;

  if (accountIndex === undefined || !Array.isArray(currentDriveIds)) {
    return res.status(400).json({ detail: "accountIndex and currentDriveIds (array) are required" });
  }

  try {
    await cleanupDeletedFiles(ownerId, accountIndex, currentDriveIds);
    return res.json({ ok: true });
  } catch (err) {
    console.error("[Cleanup] Error:", err.message);
    return res.status(500).json({ detail: err.message });
  }
}

// ── POST /api/files/reconcile ────────────────────────────────────────────────
export async function reconcileFiles(req, res) {
  const ownerId = req.ownerId;
  const { accountIndex, driveFiles } = req.body;

  if (accountIndex === undefined || !Array.isArray(driveFiles)) {
    return res.status(400).json({ detail: "accountIndex and driveFiles (array) are required" });
  }

  try {
    await reconcileAccountFiles(ownerId, accountIndex, driveFiles);
    return res.json({ ok: true });
  } catch (err) {
    console.error("[Reconcile] Error:", err.message);
    return res.status(500).json({ detail: err.message });
  }
}
