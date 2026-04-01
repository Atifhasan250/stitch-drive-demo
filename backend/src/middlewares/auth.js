import { getAuth } from "@clerk/express";
import { getDecryptedCredentials } from "../controllers/credentialsController.js";

/**
 * Clerk-first auth middleware.
 * Checks for Clerk userId (from JWT Bearer token set by frontend).
 */
export async function requireAuth(req, res, next) {
  const clerkAuth = getAuth(req);
  if (!clerkAuth?.userId) {
    return res.status(401).json({ detail: "Not authenticated via Clerk" });
  }

  req.user = { sub: clerkAuth.userId };
  req.ownerId = clerkAuth.userId;

  const headerCreds = req.headers["x-credentials"];
  if (headerCreds) {
    try {
      req.clientCredentials = typeof headerCreds === "string"
        ? JSON.parse(headerCreds)
        : headerCreds;
    } catch {
      console.warn("[Auth] Failed to parse X-Credentials header, falling back to stored credentials");
    }
  }

  if (!req.clientCredentials) {
    try {
      req.clientCredentials = await getDecryptedCredentials(clerkAuth.userId);
    } catch (err) {
      console.error("[Auth] Failed to load stored credentials:", err.message);
    }
  }

  return next();
}
