import { Router } from "express";
import multer from "multer";
import { requireAuth } from "../middlewares/auth.js";
import {
  getProfile,
  updateProfile,
  uploadAvatar,
  getAvatar,
} from "../controllers/profileController.js";

const router = Router();
const memUpload = multer({ 
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 } // 5MB limit
});

router.get("/", requireAuth, getProfile);
router.put("/", requireAuth, updateProfile);
router.post("/avatar", requireAuth, memUpload.single("file"), uploadAvatar);
router.get("/avatar", requireAuth, getAvatar);

export default router;
