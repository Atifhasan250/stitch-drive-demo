import { Router } from "express";
import { requireAuth } from "../middlewares/auth.js";
import { apiLimiter, downloadLimiter, uploadLimiter } from "../middlewares/rateLimiters.js";
import {
  syncFiles,
  listFiles,
  getDownload,
  getView,
  rename,
  moveFileRoute,
  shareFileRoute,
  unshareFileRoute,
  deleteFile,
  getThumbnail,
  initiateUpload,
  finalizeUpload,
  abortUpload,
  downloadSharedFile,
  listSharedChildren,
  deleteSharedFile,
  listShared,
  listTrash,
  restoreTrashFile,
  deleteTrashFile,
  cleanupFiles,
  reconcileFiles,
} from "../controllers/filesController.js";

const router = Router();

router.use(requireAuth, apiLimiter);

// ── Static paths first (must come before /:fileId routes) ────────────────────
router.post("/sync", syncFiles);
router.post("/cleanup", cleanupFiles);
router.post("/reconcile", reconcileFiles);
router.get("/shared", listShared);
router.get("/trash", listTrash);

// ── Shared-file sub-routes ────────────────────────────────────────────────────
router.get("/shared/:accountIndex/:folderId/children", listSharedChildren);
router.get("/shared/:accountIndex/:driveFileId/download", downloadLimiter, downloadSharedFile);
router.delete("/shared/:accountIndex/:driveFileId", deleteSharedFile);

// ── Trash sub-routes ──────────────────────────────────────────────────────────
router.post("/trash/:accountIndex/:driveFileId/restore", restoreTrashFile);
router.delete("/trash/:accountIndex/:driveFileId", deleteTrashFile);

// ── Core file routes ──────────────────────────────────────────────────────────
router.get("/", listFiles);
router.post("/upload/initiate", uploadLimiter, initiateUpload);
router.post("/upload/finalize", uploadLimiter, finalizeUpload);
router.post("/upload/abort", uploadLimiter, abortUpload);
router.get("/:fileId/download", downloadLimiter, getDownload);
router.post("/:fileId/download", downloadLimiter, getDownload);
router.get("/:fileId/view", downloadLimiter, getView);
router.post("/:fileId/view", downloadLimiter, getView);
router.get("/:fileId/thumbnail", getThumbnail);
router.post("/:fileId/thumbnail", getThumbnail);
router.patch("/:fileId/rename", rename);
router.patch("/:fileId/move", moveFileRoute);
router.post("/:fileId/share", shareFileRoute);
router.delete("/:fileId/share", unshareFileRoute);
router.delete("/:fileId", deleteFile);

export default router;
