import DriveAccount from "../models/DriveAccount.js";
import Profile from "../models/Profile.js";
import {
  downloadFile,
  getOrCreateProfileFolder,
  uploadFile,
} from "../services/driveService.js";

async function getOrCreateProfile(ownerId) {
  let profile = await Profile.findOne({ ownerId });
  if (!profile) {
    profile = await Profile.create({ ownerId });
  }
  return profile;
}

// ── GET /api/profile ──────────────────────────────────────────────────────────
export async function getProfile(req, res) {
  const profile = await getOrCreateProfile(req.ownerId);
  return res.json({
    display_name: profile.displayName,
    bio: profile.bio,
    has_avatar: profile.avatarDriveFileId != null,
  });
}

// ── PUT /api/profile ──────────────────────────────────────────────────────────
export async function updateProfile(req, res) {
  const profile = await getOrCreateProfile(req.ownerId);
  const { display_name, bio } = req.body;
  if (display_name !== undefined) profile.displayName = display_name;
  if (bio !== undefined) profile.bio = bio;
  await profile.save();
  return res.json({ ok: true });
}

// ── POST /api/profile/avatar ──────────────────────────────────────────────────
export async function uploadAvatar(req, res) {
  if (!req.file) return res.status(400).json({ detail: "No file provided" });

  const account = await DriveAccount.findOne({ ownerId: req.ownerId, isConnected: true });
  if (!account) return res.status(503).json({ detail: "No connected accounts" });

  const mimeType = req.file.mimetype || "image/jpeg";
  const folderId = await getOrCreateProfileFolder(account);

  const result = await uploadFile(
    account,
    req.file.buffer,
    "_stitchdrive_avatar_",
    mimeType,
    folderId
  );

  const profile = await getOrCreateProfile(req.ownerId);
  profile.avatarDriveFileId = result.driveFileId;
  profile.avatarAccountIndex = account.accountIndex;
  profile.avatarMimeType = mimeType;
  await profile.save();

  return res.json({ ok: true });
}

// ── GET /api/profile/avatar ───────────────────────────────────────────────────
export async function getAvatar(req, res) {
  const profile = await Profile.findOne({ ownerId: req.ownerId });
  if (!profile || !profile.avatarDriveFileId) {
    return res.status(404).json({ detail: "No avatar set" });
  }

  const account = await DriveAccount.findOne({
    ownerId: req.ownerId,
    accountIndex: profile.avatarAccountIndex,
  });
  if (!account || !account.isConnected) {
    return res.status(503).json({ detail: "Account not available" });
  }

  const content = await downloadFile(account, profile.avatarDriveFileId);
  res.setHeader("Content-Type", profile.avatarMimeType || "image/jpeg");
  return res.send(content);
}
