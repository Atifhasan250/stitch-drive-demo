import { getAuth } from "@clerk/express";

/**
 * Clerk-first auth middleware.
 * Checks for Clerk userId (from JWT Bearer token set by frontend).
 */
export function requireAuth(req, res, next) {
  const clerkAuth = getAuth(req);
  if (clerkAuth?.userId) {
    req.user = { sub: clerkAuth.userId };
    req.ownerId = clerkAuth.userId;

    // Extract optional client-side credentials from header, body, or query (ultimate fallback)
    // Note: Node/Express normalizes headers to lowercase.
    let creds = req.headers["x-credentials"] || req.headers["X-Credentials"] || req.body?.xCredentials;
    
    // Check for query parameter (Base64 encoded for URL safety)
    if (!creds && req.query.xCreds) {
      try {
        creds = Buffer.from(req.query.xCreds, "base64").toString("utf-8");
      } catch (err) {
        console.error("[Auth] FAILED to decode xCreds from query:", err.message);
      }
    }
    
    if (creds) {
      try {
        req.clientCredentials = typeof creds === "string" ? JSON.parse(creds) : creds;
        console.log(`[Auth] Credentials extracted for path: ${req.path}`);
      } catch (err) {
        console.error(`[Auth] FAILED to parse credentials: ${err.message}. Raw prefix: ${typeof creds === 'string' ? creds.substring(0, 50) : '[Object]'}...`);
      }
    } else if (req.path.includes("/download") || req.path.includes("/view") || req.path.includes("/thumbnail")) {
       console.warn(`[Auth] WARNING: Missing credentials for media request: ${req.path}`);
    }

    return next();
  }

  // Not authenticated via Clerk
  return res.status(401).json({ detail: "Not authenticated via Clerk" });
}
