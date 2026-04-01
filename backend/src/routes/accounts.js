import { Router } from "express";
import { requireAuth } from "../middlewares/auth.js";
import { loginLimiter } from "../middlewares/loginLimiter.js";
import { apiLimiter } from "../middlewares/rateLimiters.js";
import { 
  listAccounts, 
  disconnectAccount, 
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
router.use(requireAuth, apiLimiter);
router.get("/", listAccounts);
router.post("/verify-credentials", verifyCredentialsService);
router.delete("/:accountIndex", disconnectAccount);

export default router;
