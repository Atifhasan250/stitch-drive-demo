import { Router } from "express";
import { requireAuth } from "../middlewares/auth.js";
import {
  storeCredentials,
  getCredentialsStatus,
  deleteCredentials,
} from "../controllers/credentialsController.js";

const router = Router();

router.post("/store", requireAuth, storeCredentials);
router.get("/status", requireAuth, getCredentialsStatus);
router.delete("/", requireAuth, deleteCredentials);

export default router;
