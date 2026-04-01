# StitchDrive — Full Security & Code Quality Audit
**Prepared by:** Senior Software & Security Engineer Review  
**Codebase:** StitchDrive (Next.js 15 Frontend + Express.js Backend + MongoDB)  
**Date:** April 2026

---

## Table of Contents

1. [🔴 Critical Security Issues](#-critical-security-issues)
2. [🟠 High Severity Bugs & Issues](#-high-severity-bugs--issues)
3. [🟡 Medium Severity Issues](#-medium-severity-issues)
4. [🔵 Low Severity / Code Quality Issues](#-low-severity--code-quality-issues)
5. [🟢 Performance Improvements](#-performance-improvements)
6. [🏗️ Architecture & Design Improvements](#-architecture--design-improvements)
7. [✅ Quick Win Checklist](#-quick-win-checklist)

---

## 🔴 Critical Security Issues

---

### CRIT-01 — Google Access Tokens Exposed to Browser (MAJOR)

**File:** `frontend/lib/api.ts`, `frontend/hooks/useSync.ts`

**Problem:**  
The app fetches raw Google OAuth access tokens from the backend (`/api/accounts/:accountIndex/token`) and then uses them **directly in the browser** to call Google's APIs. This exposes live OAuth tokens in browser memory, XHR/Fetch logs, DevTools, and any browser extension that can intercept network traffic.

```typescript
// frontend/lib/api.ts — token used directly in browser
const tokenRes = await authenticatedFetch(`/api/accounts/${accountIndex}/token`, token);
const { accessToken } = await tokenRes.json();
const driveRes = await fetch(`https://www.googleapis.com/drive/v3/files/${driveFileId}?alt=media`, {
  headers: { Authorization: `Bearer ${accessToken}` }
});
```

**Risk:** Any XSS attack, malicious browser extension, or compromised CDN could steal these tokens. An attacker with a Google access token can access the victim's entire Google Drive.

**Fix:**  
All Google API calls that require authenticated access should be **proxied through your backend**, not made directly from the browser. The backend already supports `/api/files/:fileId/download` for downloads. Remove the `getAccessToken` endpoint entirely or restrict it to server-to-server use only.

```javascript
// REMOVE this endpoint from production or gate it to server-only contexts
router.get("/:accountIndex/token", getAccessToken); // <- REMOVE
```

For the sync hook (`useSync.ts`), move the entire Drive listing logic to the backend.

---

### CRIT-02 — Encryption Silently Downgrades to AES-128 Instead of AES-256

**File:** `backend/src/services/authService.js`

**Problem:**  
The `_fernetKeys` function reads a base64-encoded 32-byte key but only uses the last 16 bytes for encryption (AES-128-CBC). This is weaker than industry-standard AES-256. The code also uses CBC mode, which is vulnerable to padding oracle attacks if error messages are not carefully controlled.

```javascript
// authService.js
const cipher = crypto.createCipheriv("aes-128-cbc", encryptionKey, iv); // Only 128-bit!
```

**Fix:**  
Switch to AES-256-GCM (authenticated encryption that prevents padding oracle attacks):

```javascript
export function encryptToken(plaintext) {
  const key = Buffer.from(config.ENCRYPTION_KEY, "base64"); // 32 bytes
  const iv = crypto.randomBytes(12); // 96-bit IV for GCM
  const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);
  const ciphertext = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag(); // Authentication tag prevents tampering
  return Buffer.concat([iv, tag, ciphertext]).toString("base64url");
}
```

---

### CRIT-03 — OAuth Callback Does Not Verify Session Ownership

**File:** `backend/src/controllers/accountsController.js`

**Problem:**  
The OAuth callback route has no `requireAuth` middleware:

```javascript
router.get("/oauth/callback", loginLimiter, oauthCallback); // No requireAuth!
```

The signed state parameter does embed `ownerId`, but this `ownerId` is self-reported from when the flow was initiated. A CSRF or session fixation attack could potentially complete an OAuth flow for a different user's account slot if the state HMAC is somehow reused or forged.

**Fix:**  
While the HMAC-signed state is good protection, also set a short-lived `httpOnly` cookie at the start of the OAuth flow containing the `ownerId`, and verify it matches the state's `ownerId` in the callback. This creates a second layer of CSRF protection.

---

### CRIT-04 — Google `client_secret` Sent in Every HTTP Request Header

**File:** `backend/src/middlewares/auth.js`

**Problem:**  
The auth middleware reads full Google OAuth credentials from an `X-Credentials` HTTP header:

```javascript
const headerCreds = req.headers["x-credentials"];
if (headerCreds) {
  req.clientCredentials = JSON.parse(headerCreds);
}
```

This means the `client_secret` is being sent in **every HTTP request header** from the frontend. HTTP headers appear in browser DevTools for any user who opens them, server access logs, proxy/CDN logs, and any network monitoring tool on the same network.

**Risk:** The `client_secret` is the key to impersonating your entire Google Cloud app and generating OAuth tokens for anyone.

**Fix:**  
Remove the `X-Credentials` header mechanism entirely. The backend already stores credentials server-side via `/api/credentials/store`. Always load credentials from the database (which is the fallback and works fine).

```javascript
// REMOVE this entire block from auth.js:
const headerCreds = req.headers["x-credentials"];
if (headerCreds) {
  try {
    req.clientCredentials = typeof headerCreds === "string"
      ? JSON.parse(headerCreds)
      : headerCreds;
  } catch { ... }
}
```

---

### CRIT-05 — Insufficient Drive File ID Validation (Injection Risk)

**File:** `backend/src/services/driveService.js`

**Problem:**  
The `sanitizeId` function is only used in one place and only removes single quotes:

```javascript
function sanitizeId(id) {
  return id?.replace(/'/g, ""); // Incomplete!
}
// Only used in listSharedFolderChildren — other functions pass IDs directly
```

Drive file IDs are used directly in Google Drive API query strings (`q` parameters) in multiple functions without validation. While Google's API client library provides some protection, user-supplied IDs should always be validated.

**Fix:**  
Add a strict allowlist validator and apply it everywhere:

```javascript
function validateDriveId(id, fieldName = "driveFileId") {
  if (!id || typeof id !== "string" || !/^[a-zA-Z0-9_\-]{10,200}$/.test(id)) {
    const err = new Error(`Invalid ${fieldName}`);
    err.statusCode = 400;
    throw err;
  }
  return id;
}
// Apply at the top of every controller function that receives a driveFileId
```

---

## 🟠 High Severity Bugs & Issues

---

### HIGH-01 — Token Endpoint Exposed to All Authenticated Users

**File:** `backend/src/routes/accounts.js`

**Problem:**  
Any authenticated user can call `GET /api/accounts/:accountIndex/token` for their own accounts, which returns a live Google OAuth access token. Even with ownership checking, this endpoint is the mechanism by which CRIT-01 works — removing this endpoint removes the attack surface.

**Fix:**  
Remove this endpoint entirely. Redesign sync and download to be backend-proxied. If the endpoint must exist (e.g., for resumable uploads), add strict rate limiting per user and log every token issuance.

---

### HIGH-02 — Race Condition in "Move to Account" — Data Loss Risk

**File:** `frontend/contexts/UploadContext.tsx`

**Problem:**  
The `moveFile` function follows: download from source → upload to target → delete from source. If the browser tab closes, network drops, or any step fails between upload success and source deletion, the file either exists on both accounts (duplication) or the rollback fails silently and the file is lost.

```typescript
// Step 6: Can fail AFTER upload succeeded — leaving orphaned file on target
const deleteRes = await authenticatedFetch(`/api/files/${file.id}`, token, { method: "DELETE" });
if (!deleteRes.ok) {
  throw new Error("Source delete failed after upload");
}
```

The rollback code in the catch block also references `targetAccountIndex` which is a function parameter not always defined by that point.

**Fix:**  
Implement this as a single backend endpoint (`POST /api/files/:fileId/transfer`) that:
1. Records a "transfer in progress" state in MongoDB
2. Performs the operation server-side
3. Cleans up the in-progress flag on completion or failure
4. Is idempotent so it can be safely retried

---

### HIGH-03 — No File Size Check Before Browser-Side Move

**File:** `frontend/contexts/UploadContext.tsx`, `frontend/lib/api.ts`

**Problem:**  
When moving files between accounts, the entire file downloads into browser memory:

```typescript
const blob = await downloadRes.blob(); // Loads entire file into RAM
```

A 4GB video file would crash the browser tab. There is no size check before attempting this.

**Fix:**  
```typescript
const contentLength = downloadRes.headers.get("content-length");
const MAX_BROWSER_MOVE_SIZE = 500 * 1024 * 1024; // 500MB
if (contentLength && parseInt(contentLength) > MAX_BROWSER_MOVE_SIZE) {
  throw new Error(
    "File too large for browser-side transfer (max 500MB). This feature requires a server-side implementation."
  );
}
```

---

### HIGH-04 — Sensitive Data Logged in OAuth Error Handler

**File:** `backend/src/controllers/accountsController.js`

**Problem:**  
The OAuth callback logs the full Google API error response which can contain token data:

```javascript
console.error("[OAuth] Callback Processing Error:", {
  message: err.message,
  stack: err.stack,
  code: err.code,
  response: err.response?.data  // May contain OAuth tokens or sensitive data!
});
```

**Fix:**  
```javascript
console.error("[OAuth] Callback Processing Error:", {
  message: err.message,
  code: err.code,
  httpStatus: err.response?.status, // Only log the status code, not the body
});
```

---

### HIGH-05 — Expired Thumbnail URLs Stored in MongoDB

**File:** `backend/src/services/driveService.js`, `backend/src/models/File.js`

**Problem:**  
Google Drive `thumbnailLink` URLs expire within hours. These are stored in MongoDB and served to the client later. The thumbnail proxy (`GET /api/files/:fileId/thumbnail`) fetches from the stored URL, which may return 401/403 by the time it is requested.

**Fix:**  
Do not store `thumbnailLink` long-term. Instead, fetch it fresh from the Drive API on every thumbnail request:

```javascript
// In filesController.js getThumbnail:
// Instead of using file.thumbnailLink from DB, fetch fresh:
const drive = buildService(account, req.clientCredentials);
const meta = await drive.files.get({ fileId: file.driveFileId, fields: "thumbnailLink" });
const freshUrl = meta.data.thumbnailLink;
if (!freshUrl) return res.status(404).json({ detail: "No thumbnail" });
```

---

### HIGH-06 — localStorage Sync Lock is Not Atomic (Race Condition)

**File:** `frontend/hooks/useSync.ts`

**Problem:**  
The sync lock uses `localStorage` as a cross-tab mutex, but `localStorage.getItem` + `localStorage.setItem` is not atomic. Two tabs can simultaneously read "no lock" and both acquire it, causing duplicate sync operations.

```typescript
const rawLock = window.localStorage.getItem(SYNC_LOCK_KEY);
// <<< Another tab can read here before this tab writes >>>
window.localStorage.setItem(SYNC_LOCK_KEY, JSON.stringify({ tabId: ..., timestamp: now }));
```

**Fix:**  
Use the `BroadcastChannel` API for proper tab coordination. Alternatively, since the sync operation is idempotent (uses `bulkWrite` with `upsert`), simply remove the lock mechanism and accept that duplicate syncs may occasionally occur — the data consistency is maintained by MongoDB.

---

### HIGH-07 — No Frontend Validation on Rename Input

**File:** `frontend/components/files/FileCards.tsx`

**Problem:**  
The rename input commits on `blur` with no client-side validation. If the user accidentally clicks away, any text in the box (including empty string after selecting all and typing nothing) triggers a rename API call.

```typescript
// Commits on blur — no validation
async function commitRename() {
  const trimmed = editName.trim();
  if (trimmed && trimmed !== file.file_name) await onRename(file.id, trimmed);
  // Empty string check only — no length or character validation
}
```

**Fix:**  
```typescript
async function commitRename() {
  const trimmed = editName.trim();
  setEditing(false);
  if (!trimmed || trimmed === file.file_name) {
    setEditName(file.file_name);
    return;
  }
  if (trimmed.length > 255 || /[\/\\\0\u0000-\u001f]/.test(trimmed)) {
    setEditName(file.file_name);
    toast("Invalid file name — contains illegal characters", "error");
    return;
  }
  await onRename(file.id, trimmed);
}
```

---

## 🟡 Medium Severity Issues

---

### MED-01 — Rate Limiter IP Can Be Spoofed

**File:** `backend/src/middlewares/rateLimiters.js`, `backend/src/index.js`

**Problem:**  
`app.set("trust proxy", 1)` blindly trusts the first proxy hop. If the app is deployed without a proper reverse proxy in front of it (or if `X-Forwarded-For` is not stripped by the proxy), clients can spoof their IP to bypass rate limits on the login endpoint.

**Fix:**  
Configure trusted proxy IPs explicitly if known. For `loginLimiter`, add user-agent fingerprinting as a secondary key. Consider using `express-slow-down` as a softer rate limiter in addition to hard limits.

---

### MED-02 — Missing Content-Security-Policy Header

**File:** `backend/src/index.js`

**Problem:**  
`helmet()` is used with default settings. Without a strict CSP, any XSS vulnerability would allow full script execution with no browser-level containment. The app loads external resources (Google Fonts, Clerk, Google APIs) that should be explicitly whitelisted.

**Fix:**  
```javascript
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "https://clerk.com", "https://*.clerk.accounts.dev"],
      connectSrc: ["'self'", "https://www.googleapis.com", "https://api.clerk.com"],
      imgSrc: ["'self'", "data:", "https://lh3.googleusercontent.com", "https://lh4.googleusercontent.com"],
      fontSrc: ["'self'", "https://fonts.googleapis.com", "https://fonts.gstatic.com"],
      styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
    }
  }
}));
```

---

### MED-03 — All Files Loaded into Memory on Every Page Load

**File:** `frontend/hooks/useFiles.ts`

**Problem:**  
The files hook fetches all files with `limit=1000` (the default cap) on every mount:

```typescript
const res = await authenticatedFetch("/api/files", token); // 1000 files max, no pagination
```

For a user with 10 Drive accounts each containing 1,000 files, this would attempt to load 10,000 files into the browser state on every dashboard visit.

**Fix:**  
Implement pagination or infinite scroll in the Files page. The backend supports `page` and `limit` parameters — wire them up in the frontend. Start with 100 files per page.

---

### MED-04 — Blob URL Memory Leaks in Async Components

**File:** `frontend/components/AuthenticatedThumbnail.tsx`, `frontend/components/files/PreviewModal.tsx`

**Problem:**  
`URL.createObjectURL()` blobs are not reliably revoked when components unmount mid-fetch. If a user navigates away while 50 thumbnails are loading, none of the in-flight blob URLs get revoked.

**Fix:**  
Use `AbortController` to cancel in-flight requests on unmount, and ensure cleanup runs regardless of the `active` flag:

```typescript
useEffect(() => {
  const controller = new AbortController();
  let blobUrl = "";

  const load = async () => {
    try {
      const res = await fetch(url, { signal: controller.signal });
      blobUrl = URL.createObjectURL(await res.blob());
      setUrl(blobUrl);
    } catch (e) {
      if (!controller.signal.aborted) setError(true);
    }
  };

  load();
  return () => {
    controller.abort();
    if (blobUrl) URL.revokeObjectURL(blobUrl);
  };
}, [fileId]);
```

---

### MED-05 — OAuth `ownerId` Exposed in Browser History via URL State

**File:** `backend/src/controllers/accountsController.js`

**Problem:**  
The OAuth state parameter (which appears in the browser URL during the OAuth flow) contains the user's Clerk `ownerId` base64-encoded. This ends up in browser history, server access logs, and any analytics tools that capture full URLs.

```javascript
const payload = Buffer.from(
  JSON.stringify({ ownerId, accountIndex, issuedAt: Date.now() })
).toString("base64url"); // ownerId visible in URL
```

**Fix:**  
Store the OAuth state in a short-lived MongoDB document and use a random opaque token as the URL parameter:

```javascript
const stateToken = crypto.randomBytes(32).toString("hex");
await OAuthState.create({ token: stateToken, ownerId, accountIndex, expiresAt: new Date(Date.now() + 10 * 60000) });
// Use stateToken in the URL, look up ownerId from DB in callback
```

---

### MED-06 — `@ts-ignore` Suppresses Real Type Errors

**File:** `frontend/app/sign-up/page.tsx`

**Problem:**  
```typescript
// @ts-ignore
const { signUp, fetchStatus, setActive } = useSignUp();
```

This suppresses a real TypeScript error related to Clerk's API types. `skipLibCheck: true` in `tsconfig.json` compounds this. These suppressions can hide breaking changes when dependencies update.

**Fix:**  
Use the proper Clerk types:
```typescript
const { signUp, isLoaded, setActive } = useSignUp();
if (!isLoaded) return null;
```

---

### MED-07 — No Graceful Shutdown on SIGTERM

**File:** `backend/src/index.js`

**Problem:**  
When Docker stops the container (`docker stop`), it sends SIGTERM. Without a handler, the process exits immediately, potentially:
- Abandoning in-progress MongoDB writes
- Cutting off active file streaming connections mid-download
- Losing upload state for ongoing Google Drive operations

**Fix:**  
```javascript
const server = app.listen(PORT, "0.0.0.0", () => { ... });

const shutdown = async (signal) => {
  console.log(`[Server] ${signal} received. Shutting down gracefully...`);
  server.close(async () => {
    await mongoose.connection.close();
    console.log("[Server] MongoDB disconnected. Exiting.");
    process.exit(0);
  });
  // Force exit after 30s
  setTimeout(() => process.exit(1), 30000);
};

process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));
```

---

### MED-08 — Multi-Tab Auto-Sync Causes API Flood

**File:** `frontend/hooks/useSync.ts`

**Problem:**  
Every open browser tab runs its own 30-minute sync timer. A user with 5 tabs open generates 5× the Google API calls and backend load. The localStorage lock is not atomic (HIGH-06) so all 5 may run concurrently.

**Fix:**  
Use the `BroadcastChannel` API to elect one leader tab:

```typescript
const channel = new BroadcastChannel("stitchdrive-sync");
// Only the tab that wins the leader election runs sync
// Others listen for "sync-complete" events and refresh their file list
```

---

### MED-09 — Fake OpenGraph URL and Missing SEO Configuration

**File:** `frontend/app/layout.tsx`

**Problem:**  
```typescript
url: "https://stitchdrive.example.com", // This is a placeholder!
```

Social sharing links will reference a non-existent domain. Also, `robots.txt` is missing, meaning search engines have no guidance on what to index.

**Fix:**  
```typescript
// layout.tsx
url: process.env.NEXT_PUBLIC_APP_URL ?? "https://your-actual-domain.com",
```
Add a `robots.txt` and `sitemap.xml` in the `public/` directory.

---

## 🔵 Low Severity / Code Quality Issues

---

### LOW-01 — Dead Code: Multiple Unused Components

**Files:**
- `frontend/components/UploadZone.tsx` — uses old unauthenticated upload API
- `frontend/components/StorageBar.tsx` — replaced by sidebar storage widget
- `frontend/components/FileList.tsx` — replaced by `files/FileCards.tsx`
- `frontend/components/AccountCard.tsx` — appears unused in current routes
- `frontend/test_clerk.js` — debugging file committed to repo

**Fix:**  
Delete all of the above. Run a dead code analysis with a tool like `ts-prune` or `knip` to catch any others.

---

### LOW-02 — `console.log`/`console.error` Scattered Throughout Production Code

**Files:** `frontend/contexts/UploadContext.tsx`, `frontend/components/Navbar.tsx`, `frontend/hooks/useSync.ts`, multiple others

**Problem:**  
```typescript
console.error("[Upload] Critical Error:", err.message);
console.error("[Move] Progress Error:", err.message);
console.error("[Navbar] Fetch profile error:", err);
```

These leak internal details to any user with DevTools open and add noise to log aggregators.

**Fix:**  
Create a logger utility:
```typescript
// lib/logger.ts
const isDev = process.env.NODE_ENV === "development";
export const logger = {
  error: (...args: unknown[]) => isDev && console.error(...args),
  warn: (...args: unknown[]) => isDev && console.warn(...args),
  info: (...args: unknown[]) => isDev && console.log(...args),
};
```

---

### LOW-03 — `BoundedTTLCache` Expired Entries Waste Memory Until Evicted

**File:** `backend/src/utils/BoundedTTLCache.js`

**Problem:**  
Expired entries are only removed when accessed via `get()`. Entries that are set but never read again sit in the cache indefinitely until the `maxEntries` limit forces LRU eviction. In a server running for days, this can accumulate stale OAuth client caches.

**Fix:**  
Add periodic cleanup:
```javascript
constructor(maxEntries = 500, ttlMs = 300_000) {
  // ... existing code ...
  setInterval(() => this._cleanup(), Math.min(ttlMs, 60_000)).unref();
}

_cleanup() {
  const now = Date.now();
  for (const [key, entry] of this.cache) {
    if (entry.expiresAt <= now) this.cache.delete(key);
  }
}
```

---

### LOW-04 — `rel="noopener noreferrer"` Missing on External Links

**Files:** `frontend/components/files/PreviewModal.tsx`, `frontend/app/docs/page.tsx`

**Problem:**  
```tsx
// PreviewModal.tsx — missing rel attribute
<a href={`https://drive.google.com/file/d/${file.drive_file_id}/view`} target="_blank">
```

Without `rel="noopener noreferrer"`, the opened page can access `window.opener` and potentially redirect the original tab.

**Fix:**  
Add to every `target="_blank"` link:
```tsx
<a href="..." target="_blank" rel="noopener noreferrer">Open in Drive</a>
```

---

### LOW-05 — `docker-compose.yml` Context Path Mismatch

**File:** `backend/docker-compose.yml`

**Problem:**  
The file is located at `backend/docker-compose.yml` but references `./backend` as the build context for the backend service. This only works if `docker-compose up` is run from the **parent** directory, which is non-standard placement.

**Fix:**  
Move `docker-compose.yml` to the project root:
```
/project-root/
  docker-compose.yml      <- here
  backend/
  frontend/
```

Update contexts to `./backend` and `./frontend` respectively.

---

### LOW-06 — Incrementing Counter for Toast IDs Can Collide on Long Sessions

**File:** `frontend/contexts/UploadContext.tsx`

**Problem:**  
```typescript
const idRef = useRef(0);
// ...
const id = ++idRef.current; // Resets to 0 on component remount
```

If the `UploadProvider` remounts (e.g., during a hot reload or full-page navigation), the counter resets and ID collisions can cause toasts to not be properly removed.

**Fix:**  
Use `crypto.randomUUID()` or a module-level counter that doesn't reset:
```typescript
let _globalId = 0;
const nextId = () => ++_globalId;
```

---

### LOW-07 — Hardcoded External URLs in Multiple Components

**Files:** `frontend/app/dashboard/settings/page.tsx`, `frontend/app/page.tsx`

**Problem:**  
```typescript
href="https://github.com/Atifhasan250/Stitch-Drive"
href="https://x.com/_atifhasan_"
href="https://www.linkedin.com/in/atifhasan250/"
```

These are hardcoded in multiple places. If any URL changes, it requires finding and updating every occurrence.

**Fix:**  
Create a `lib/constants.ts` file:
```typescript
export const EXTERNAL_LINKS = {
  github: "https://github.com/Atifhasan250/Stitch-Drive",
  twitter: "https://x.com/_atifhasan_",
  linkedin: "https://www.linkedin.com/in/atifhasan250/",
} as const;
```

---

### LOW-08 — No `robots.txt` or `sitemap.xml`

**File:** `frontend/public/`

**Problem:**  
Without `robots.txt`, search engine crawlers will index all pages including auth pages and dashboard routes. This can cause user-facing dashboard URLs to appear in Google Search results.

**Fix:**  
Add `frontend/public/robots.txt`:
```
User-agent: *
Disallow: /dashboard/
Disallow: /api/
Allow: /
Allow: /docs
Allow: /user-guide
```

---

### LOW-09 — `useCallback` Missing on Several Event Handlers in Hot Paths

**File:** `frontend/app/dashboard/files/page.tsx`

**Problem:**  
Functions like `handleRename`, `handleDelete`, `handleMove`, `handleShare` are recreated on every render of `FilesPage`, causing all child `GridCard` and `ListRow` components to re-render needlessly even when the file data hasn't changed.

**Fix:**  
Wrap these handlers in `useCallback`. The file-specific handlers should be moved into the child components themselves (already partially done in `FileCards.tsx`). Memoize `GridCard` and `ListRow` with `React.memo`.

---

### LOW-10 — Error Boundary Doesn't Report Errors

**File:** `frontend/components/DashboardErrorBoundary.tsx`

**Problem:**  
The error boundary catches errors and shows a UI, which is good. But `componentDidCatch` only logs to the console — there's no error reporting to a monitoring service.

**Fix:**  
Integrate an error monitoring service (Sentry, LogRocket, etc.) in `componentDidCatch`:
```typescript
componentDidCatch(error: Error, info: React.ErrorInfo) {
  // Replace with your error monitoring service
  if (process.env.NODE_ENV === "production") {
    // Sentry.captureException(error, { extra: info });
  }
  console.error("[ErrorBoundary]", error, info);
}
```

---

## 🟢 Performance Improvements

---

### PERF-01 — Full File List Fetched from Google on Every Sync

**File:** `backend/src/services/driveService.js`

**Problem:**  
Every sync fetches all files from Google Drive regardless of what has changed:
```javascript
q: "'me' in owners and trashed = false",
pageSize: 1000, // Iterates through all pages
```

For 10 accounts × 5,000 files each, this is 50,000+ records transferred per sync cycle. The sync also runs client-side every 30 minutes per tab.

**Fix:**  
Use the Google Drive **Changes API** with a saved `nextPageToken` (called a "start page token"). This returns only changed files since the last sync:
```javascript
// Store startPageToken in DB per account
// Use drive.changes.list({ pageToken: savedToken, fields: "newStartPageToken, changes" })
// Update the token after each successful sync
```

This can reduce sync data transfer by 99% for users who rarely modify files.

---

### PERF-02 — `computeStats` Runs in `useEffect` Instead of `useMemo`

**File:** `frontend/app/dashboard/page.tsx`, `frontend/app/dashboard/stats/page.tsx`

**Problem:**  
```typescript
useEffect(() => {
  const fresh = computeStats(files, accounts); // Called after every render
  setCachedStats(fresh);
  setStats(fresh);
}, [files, accounts]);
```

Using `useEffect` + `setState` for derived data causes an extra render cycle: first render with stale stats, then re-render with fresh stats. This creates a flash of stale content.

**Fix:**  
```typescript
const stats = useMemo(
  () => (files.length || accounts.length) ? computeStats(files, accounts) : null,
  [files, accounts]
);
```

---

### PERF-03 — 100 Individual `IntersectionObserver` Instances for Thumbnails

**File:** `frontend/components/AuthenticatedThumbnail.tsx`

**Problem:**  
Each thumbnail component creates its own `IntersectionObserver` via an inline `ref` callback. With 100 files in grid view, 100 separate observers are created — each consuming memory and CPU.

**Fix:**  
Create a shared observer using a module-level singleton:
```typescript
// hooks/useIntersectionObserver.ts
const callbacks = new WeakMap<Element, () => void>();
const observer = new IntersectionObserver((entries) => {
  entries.forEach(entry => {
    if (entry.isIntersecting) {
      callbacks.get(entry.target)?.();
    }
  });
}, { rootMargin: "100px" });

export function observeElement(el: Element, callback: () => void) {
  callbacks.set(el, callback);
  observer.observe(el);
  return () => { callbacks.delete(el); observer.unobserve(el); };
}
```

---

### PERF-04 — No HTTP Caching on File Listing API

**File:** `backend/src/controllers/filesController.js`

**Problem:**  
The `GET /api/files` endpoint returns fresh data on every call with no caching headers. Every tab switch, navigation, and component mount triggers a full database query.

**Fix:**  
Add `ETag` headers based on a hash of the result set, or use short-term `Cache-Control`:
```javascript
// In listFiles controller:
res.setHeader("Cache-Control", "private, max-age=30, stale-while-revalidate=60");
res.setHeader("ETag", `"${hash(files)}"`);
```

---

### PERF-05 — MongoDB `bulkWrite` Without `ownerId` in Filter May Miss Index

**File:** `backend/src/services/driveService.js`

**Problem:**  
The `reconcileAccountFiles` function filters without `ownerId`:
```javascript
filter: { driveFileId: df.id, accountIndex: accountIndex }
// Missing: ownerId!
```

The compound index is `{ ownerId: 1, driveFileId: 1, accountIndex: 1 }`. A filter without the leading `ownerId` field forces a collection scan instead of an index scan for large collections.

**Fix:**  
```javascript
filter: { ownerId: ownerId, driveFileId: df.id, accountIndex: accountIndex }
```

---

## 🏗️ Architecture & Design Improvements

---

### ARCH-01 — Frontend Directly Calls Google APIs (Wrong Architecture)

**Problem:**  
Three separate code paths call Google APIs directly from the browser:
1. `useSync.ts` — lists all Drive files
2. `lib/api.ts` (`fetchGoogleDriveBlob`) — downloads files
3. `UploadContext.tsx` (`moveFile`) — uploads chunks to resumable upload sessions

This makes it impossible to add server-side caching, centralized rate limiting, audit logging, or error recovery without complete rewrites.

**Recommended Architecture:**  
```
Browser → Your Backend → Google Drive API
```
All Google API interactions should go through your backend. The backend handles token management, rate limiting, and error recovery transparently.

---

### ARCH-02 — Sync Should Be Server-Side, Not Browser-Driven

**Problem:**  
Sync only runs when a user has a browser tab open. If a user adds files to Drive via another app (Google Drive web, Android app, etc.) and never opens StitchDrive, their data never syncs. The sync also stops when all tabs are closed.

**Fix:**  
Implement a server-side cron job:
```javascript
// backend/src/jobs/syncJob.js
import cron from "node-cron";
import { syncFilesFromDrives } from "../services/driveService.js";
import DriveAccount from "../models/DriveAccount.js";

// Run sync for all users every hour
cron.schedule("0 * * * *", async () => {
  const owners = await DriveAccount.distinct("ownerId", { isConnected: true });
  for (const ownerId of owners) {
    await syncFilesFromDrives(ownerId).catch(console.error);
  }
});
```

---

### ARCH-03 — No Audit Logging for Security-Critical Operations

**Problem:**  
Operations like connecting/disconnecting Google accounts, uploading credentials, and deleting credentials leave no audit trail. If an account is compromised, there's no forensic record.

**Fix:**  
Add an `AuditLog` model:
```javascript
const auditLogSchema = new mongoose.Schema({
  ownerId: { type: String, required: true, index: true },
  action: { type: String, required: true }, // "connect_account", "delete_credentials", etc.
  metadata: { type: mongoose.Schema.Types.Mixed },
  ip: String,
  userAgent: String,
  timestamp: { type: Date, default: Date.now, index: true },
});
```
Log every sensitive operation. Retain for 90 days minimum.

---

### ARCH-04 — No Retry Logic for Failed Sync Operations

**File:** `backend/src/services/driveService.js`

**Problem:**  
```javascript
await Promise.allSettled(accounts.map(async (account) => { ... }));
```

Errors during individual account syncs are silently swallowed. The user has no visibility into whether their Drive data is actually synced.

**Fix:**  
Track sync status per account in the database. Add a `lastSyncAt`, `lastSyncError`, and `syncStatus` field to `DriveAccount`. Implement retry with exponential backoff for transient errors (429, 503).

---

### ARCH-05 — Move Operation Has No Server-Side Representation

**Problem:**  
The "move file to another account" operation is entirely client-side JavaScript with no server record. If it fails partway through, neither the user nor the server knows the operation was attempted. Files can silently end up in inconsistent states.

**Fix:**  
Create a `Transfers` collection:
```javascript
const transferSchema = new mongoose.Schema({
  ownerId: String,
  sourceFileId: String, // MongoDB _id
  sourceDriveFileId: String,
  sourceAccountIndex: Number,
  targetAccountIndex: Number,
  targetDriveFileId: String,
  status: { type: String, enum: ["pending", "downloading", "uploading", "deleting", "complete", "failed"] },
  error: String,
  createdAt: { type: Date, default: Date.now },
  completedAt: Date,
});
```
Expose a `POST /api/transfers` endpoint and handle the operation server-side.

---

### ARCH-06 — MongoDB Connection Has No Error Recovery Beyond Reconnect Logging

**File:** `backend/src/db/index.js`

**Problem:**  
The DB connection emits `disconnected` and `reconnected` events, but there's no handling of the interim state where requests arrive while MongoDB is reconnecting. These requests will fail with unhandled errors rather than returning a graceful 503.

**Fix:**  
Add middleware to check DB state before processing API requests:
```javascript
app.use((req, res, next) => {
  if (mongoose.connection.readyState !== 1) {
    return res.status(503).json({ detail: "Database temporarily unavailable. Please retry." });
  }
  next();
});
```

---

## ✅ Quick Win Checklist

These fixes are each under 30 minutes and make an immediate impact:

| # | Fix | File | Priority |
|---|-----|------|----------|
| 1 | Delete `frontend/test_clerk.js` | `test_clerk.js` | 🔴 Do Now |
| 2 | Remove `X-Credentials` header support | `auth.js` | 🔴 Do Now |
| 3 | Add `validateDriveId()` and apply everywhere | `driveService.js` | 🔴 Do Now |
| 4 | Strip `err.response?.data` from OAuth error logs | `accountsController.js` | 🟠 This Week |
| 5 | Add file size check before browser-side move | `UploadContext.tsx` | 🟠 This Week |
| 6 | Add `rel="noopener noreferrer"` to all `target="_blank"` links | `PreviewModal.tsx`, others | 🟠 This Week |
| 7 | Delete dead components (`UploadZone.tsx`, `StorageBar.tsx`, `FileList.tsx`, `AccountCard.tsx`) | Multiple | 🟡 Soon |
| 8 | Replace fake OG URL with env variable | `layout.tsx` | 🟡 Soon |
| 9 | Add graceful SIGTERM/SIGINT shutdown handler | `index.js` | 🟡 Soon |
| 10 | Fix `docker-compose.yml` to project root | `backend/docker-compose.yml` | 🟡 Soon |
| 11 | Add `robots.txt` to `public/` | `frontend/public/` | 🟡 Soon |
| 12 | Replace incrementing counter with `crypto.randomUUID()` for IDs | `UploadContext.tsx` | 🔵 Later |
| 13 | Add `ownerId` to `reconcileAccountFiles` filter | `driveService.js` | 🟠 This Week |
| 14 | Add MongoDB readyState middleware guard | `index.js` | 🟡 Soon |
| 15 | Move hardcoded external URLs to `lib/constants.ts` | Multiple | 🔵 Later |

---

## Summary Table

| Category | Count | Recommended Timeline |
|----------|-------|---------------------|
| 🔴 Critical Security | 5 | Fix **before** any public deployment |
| 🟠 High Severity | 7 | Fix **before** next release |
| 🟡 Medium Severity | 9 | Fix within **2 sprints** |
| 🔵 Low / Code Quality | 10 | Address in **regular maintenance** |
| 🟢 Performance | 5 | Address after **stability is confirmed** |
| 🏗️ Architecture | 6 | Plan for **future milestones** |
| **Total** | **42** | |

---

*This report was generated through manual static code analysis of the full frontend and backend codebase. Dynamic testing (penetration testing, fuzzing, load testing) would surface additional runtime issues not covered here.*