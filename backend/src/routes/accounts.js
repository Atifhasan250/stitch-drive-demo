import { Router } from "express";
import { requireAuth } from "../middlewares/auth.js";
import { loginLimiter } from "../middlewares/loginLimiter.js";
import { 
  listAccounts, 
  disconnectAccount, 
  getAccessToken, 
  getNewOAuthUrl, 
  getOAuthUrl, 
  oauthCallback,
  verifyCredentials as verifyCredentialsService
} from "../controllers/accountsController.js";

const router = Router();

// OAuth flow
router.get("/oauth/new", requireAuth, loginLimiter, getNewOAuthUrl);
router.get("/oauth/callback", loginLimiter, oauthCallback);
router.get("/oauth/:accountIndex", requireAuth, loginLimiter, getOAuthUrl);

// Base account management
router.get("/", requireAuth, listAccounts);
router.get("/:accountIndex/token", requireAuth, getAccessToken);
router.post("/verify-credentials", requireAuth, verifyCredentialsService);
router.delete("/:accountIndex", requireAuth, disconnectAccount);

export default router;
