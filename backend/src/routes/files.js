import { Router } from "express";
import { requireAuth } from "../middlewares/auth.js";
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

// ── Static paths first (must come before /:fileId routes) ────────────────────
router.post("/sync", requireAuth, syncFiles);
router.post("/cleanup", requireAuth, cleanupFiles);
router.post("/reconcile", requireAuth, reconcileFiles);
router.get("/shared", requireAuth, listShared);
router.get("/trash", requireAuth, listTrash);

// ── Shared-file sub-routes ────────────────────────────────────────────────────
router.get("/shared/:accountIndex/:folderId/children", requireAuth, listSharedChildren);
router.get("/shared/:accountIndex/:driveFileId/download", requireAuth, downloadSharedFile);
router.delete("/shared/:accountIndex/:driveFileId", requireAuth, deleteSharedFile);

// ── Trash sub-routes ──────────────────────────────────────────────────────────
router.post("/trash/:accountIndex/:driveFileId/restore", requireAuth, restoreTrashFile);
router.delete("/trash/:accountIndex/:driveFileId", requireAuth, deleteTrashFile);

// ── Core file routes ──────────────────────────────────────────────────────────
router.get("/", requireAuth, listFiles);
router.post("/upload/initiate", requireAuth, initiateUpload);
router.post("/upload/finalize", requireAuth, finalizeUpload);
router.get("/:fileId/download", requireAuth, getDownload);
router.post("/:fileId/download", requireAuth, getDownload);
router.get("/:fileId/view", requireAuth, getView);
router.post("/:fileId/view", requireAuth, getView);
router.get("/:fileId/thumbnail", requireAuth, getThumbnail);
router.post("/:fileId/thumbnail", requireAuth, getThumbnail);
router.patch("/:fileId/rename", requireAuth, rename);
router.patch("/:fileId/move", requireAuth, moveFileRoute);
router.post("/:fileId/share", requireAuth, shareFileRoute);
router.delete("/:fileId/share", requireAuth, unshareFileRoute);
router.delete("/:fileId", requireAuth, deleteFile);

export default router;