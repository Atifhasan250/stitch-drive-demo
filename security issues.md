# STITCHDRIVE CODEBASE — SECURITY AUDIT & REFACTOR INSTRUCTIONS
# Generated: 2026-04-01
# Purpose: Fix all identified bugs, security issues, and performance problems
# Instructions: Read EVERY file referenced before making ANY change.Do not hallucinate file paths or function signatures. Verify each file exists and read its current content before editing.

================================================================================
PRE-FLIGHT CHECKLIST FOR AI AGENT
================================================================================

Before starting ANY fix:
1. Read the entire file you are about to modify
2. Understand all imports and dependencies
3. Do not rename existing variables unless instructed
4. Do not change unrelated code in the same file
5. After each fix, verify the change compiles/parses correctly
6. Work through fixes in ORDER — some fixes depend on earlier ones

================================================================================
FIX #1 — CRITICAL SECURITY: Google credentials must NOT be stored in localStorage
================================================================================

PROBLEM:
- File: frontend/components/CredentialsUpload.tsx
- File: frontend/lib/api.ts
- File: frontend/contexts/UploadContext.tsx
- File: frontend/hooks/useSync.ts
- Currently: localStorage.setItem("credentials", credString) stores the full
  Google OAuth client_secret in the browser. Any XSS attack can steal it.
  The credentials are also injected into every API request body and header.

SOLUTION OVERVIEW:
- User uploads credentials.json once via the UI
- Frontend sends it to a new backend endpoint POST /api/credentials/store
- Backend encrypts it using the existing encryptToken() function and stores
  it in a new MongoDB collection tied to the user's Clerk ownerId
- Frontend never stores the raw credentials again
- All backend services that need credentials fetch them from DB directly
- Frontend only needs to tell the backend "use my stored credentials"
- A new boolean flag in the frontend state tracks whether credentials are uploaded

STEP 1 — Create new MongoDB model: backend/src/models/UserCredentials.js
Create this file with the following content:
```javascript
import mongoose from "mongoose";

const userCredentialsSchema = new mongoose.Schema(
  {
    ownerId: { type: String, required: true, unique: true, index: true },
    encryptedCredentials: { type: String, required: true },
    clientId: { type: String, required: true },
    uploadedAt: { type: Date, default: () => new Date() },
  },
  { collection: "user_credentials", timestamps: false }
);

const UserCredentials = mongoose.model("UserCredentials", userCredentialsSchema);
export default UserCredentials;
```

STEP 2 — Create new controller: backend/src/controllers/credentialsController.js
Create this file with the following content:
```javascript
import UserCredentials from "../models/UserCredentials.js";
import { encryptToken, decryptToken } from "../services/authService.js";

// POST /api/credentials/store
export async function storeCredentials(req, res) {
  const ownerId = req.ownerId;
  const { credentials } = req.body;

  if (!credentials || typeof credentials !== "object") {
    return res.status(400).json({ detail: "credentials object is required" });
  }

  const config = credentials.web || credentials.installed || credentials;
  if (!config.client_id || !config.client_secret) {
    return res.status(400).json({ detail: "Missing client_id or client_secret in credentials" });
  }

  const encrypted = encryptToken(JSON.stringify(credentials));

  await UserCredentials.findOneAndUpdate(
    { ownerId },
    {
      encryptedCredentials: encrypted,
      clientId: config.client_id,
      uploadedAt: new Date(),
    },
    { upsert: true, new: true }
  );

  return res.json({ ok: true, clientId: config.client_id });
}

// GET /api/credentials/status
export async function getCredentialsStatus(req, res) {
  const ownerId = req.ownerId;
  const record = await UserCredentials.findOne({ ownerId }).lean();
  return res.json({
    hasCredentials: !!record,
    clientId: record?.clientId || null,
    uploadedAt: record?.uploadedAt || null,
  });
}

// DELETE /api/credentials
export async function deleteCredentials(req, res) {
  const ownerId = req.ownerId;
  await UserCredentials.deleteOne({ ownerId });
  return res.json({ ok: true });
}

// Internal helper used by other backend services
export async function getDecryptedCredentials(ownerId) {
  const record = await UserCredentials.findOne({ ownerId }).lean();
  if (!record) return null;
  try {
    return JSON.parse(decryptToken(record.encryptedCredentials));
  } catch {
    return null;
  }
}
```

STEP 3 — Create new route: backend/src/routes/credentials.js
Create this file with the following content:
```javascript
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
```

STEP 4 — Register new route in: backend/src/index.js
Find the routes section (the block that has app.use("/api/accounts"...)) and add:
```javascript
import credentialsRoutes from "./routes/credentials.js";
// Add this line alongside the other app.use() route registrations:
app.use("/api/credentials", credentialsRoutes);
```

STEP 5 — Update backend/src/middlewares/auth.js
Replace the entire file content with the following. This version loads credentials
from DB instead of from the request header when header is absent:
```javascript
import { getAuth } from "@clerk/express";
import { getDecryptedCredentials } from "../controllers/credentialsController.js";

export async function requireAuth(req, res, next) {
  const clerkAuth = getAuth(req);
  if (!clerkAuth?.userId) {
    return res.status(401).json({ detail: "Not authenticated via Clerk" });
  }

  req.user = { sub: clerkAuth.userId };
  req.ownerId = clerkAuth.userId;

  // Allow explicit override from header (used for OAuth flow initiation only)
  const headerCreds = req.headers["x-credentials"];
  if (headerCreds) {
    try {
      req.clientCredentials = typeof headerCreds === "string"
        ? JSON.parse(headerCreds)
        : headerCreds;
    } catch {
      console.warn("[Auth] Failed to parse X-Credentials header, will load from DB");
    }
  }

  // If no header creds, load from DB (the new default behavior)
  if (!req.clientCredentials) {
    try {
      req.clientCredentials = await getDecryptedCredentials(clerkAuth.userId);
    } catch (err) {
      console.error("[Auth] Failed to load credentials from DB:", err.message);
    }
  }

  return next();
}
```

STEP 6 — Update frontend/components/CredentialsUpload.tsx
Replace the entire file content with the following:
```typescript
"use client";

import { useState, useEffect, useRef } from "react";
import { useAuth } from "@clerk/nextjs";

type CredentialStatus = "none" | "valid" | "invalid" | "checking";

export function CredentialsUpload() {
  const { getToken } = useAuth();
  const [status, setStatus] = useState<CredentialStatus>("none");
  const [isHovered, setIsHovered] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    checkStatus();
  }, []);

  const checkStatus = async () => {
    setStatus("checking");
    try {
      const token = await getToken();
      const res = await fetch("/api/credentials/status", {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setStatus(data.hasCredentials ? "valid" : "none");
      } else {
        setStatus("none");
      }
    } catch {
      setStatus("none");
    }
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (event) => {
      const content = event.target?.result as string;
      try {
        const json = JSON.parse(content);
        const config = json.web || json.installed || json;
        if (!config.client_id || !config.client_secret) {
          throw new Error("Missing client_id or client_secret");
        }

        const token = await getToken();
        const res = await fetch("/api/credentials/store", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ credentials: json }),
        });

        if (res.ok) {
          setStatus("valid");
        } else {
          setStatus("invalid");
        }
      } catch {
        setStatus("invalid");
      }
    };
    reader.readAsText(file);
    e.target.value = "";
  };

  return (
    <div className="flex items-center gap-3">
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleFileChange}
        className="hidden"
        accept=".json"
      />
      <button
        onClick={() => fileInputRef.current?.click()}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
        className={`relative flex items-center gap-2 rounded-xl border px-4 py-2 text-sm font-medium transition-all duration-300 shadow-sm
          ${status === "valid"
            ? "border-emerald-500/30 bg-emerald-500/5 text-emerald-400 hover:bg-emerald-500/10"
            : status === "invalid"
            ? "border-rose-500/30 bg-rose-500/5 text-rose-400 hover:bg-rose-500/10"
            : "border-sd-border bg-sd-s1 text-sd-text2 hover:border-sd-accent/40 hover:text-sd-text"
          }`}
      >
        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5m-13.5-9L12 3m0 0 4.5 4.5M12 3v13.5" />
        </svg>
        <span>{status === "valid" ? "Credentials Linked" : "Upload Credentials"}</span>
        <div className="ml-1 flex h-5 w-5 items-center justify-center">
          {status === "checking" ? (
            <svg className="h-4 w-4 animate-spin text-sd-accent" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
          ) : status === "valid" ? (
            <div className="flex h-5 w-5 items-center justify-center rounded-full bg-emerald-500 text-white">
              <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
              </svg>
            </div>
          ) : status === "invalid" ? (
            <div className="flex h-5 w-5 items-center justify-center rounded-full bg-rose-500 text-white">
              <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
              </svg>
            </div>
          ) : null}
        </div>
        {isHovered && status === "invalid" && (
          <div className="absolute top-full right-0 mt-2 w-64 rounded-xl border border-rose-500/20 bg-sd-s2 p-3 text-xs text-rose-400 shadow-xl z-50">
            <p className="font-semibold mb-1">Invalid Credentials</p>
            <p className="text-sd-text3 leading-relaxed">The JSON file is malformed or missing required fields.</p>
          </div>
        )}
      </button>
    </div>
  );
}
```

STEP 7 — Update frontend/lib/api.ts
Replace the entire file with the following. Credentials are NO LONGER read from
localStorage. The backend now handles them internally:
```typescript
const API_BASE = "";

/**
 * Performs an authenticated fetch to the backend using only the Clerk JWT.
 * Google credentials are now stored server-side and loaded automatically.
 */
export async function authenticatedFetch(
  url: string,
  token: string | null,
  options: RequestInit = {}
): Promise<Response> {
  const headers = new Headers(options.headers || {});
  if (token) headers.set("Authorization", `Bearer ${token}`);

  // Always set Content-Type for JSON bodies
  const method = (options.method || "GET").toUpperCase();
  if (options.body && typeof options.body === "string" && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }

  try {
    return await fetch(url, {
      ...options,
      method,
      headers,
      credentials: "include",
    });
  } catch (err: any) {
    console.error(`[API] Fetch Error (${url}):`, err.message);
    throw err;
  }
}

/**
 * Downloads a file directly from Google Drive using a server-issued access token.
 * Falls back to server proxy if direct download fails.
 */
export async function downloadFileAuthenticated(
  fileId: string,
  fileName: string,
  token: string | null,
  opts?: {
    accountIndex?: number;
    driveFileId?: string;
    customPath?: string;
  }
): Promise<void> {
  if (opts?.accountIndex !== undefined && opts?.driveFileId) {
    try {
      const tokenRes = await authenticatedFetch(
        `/api/accounts/${opts.accountIndex}/token`,
        token
      );
      if (tokenRes.ok) {
        const { accessToken } = await tokenRes.json();
        const driveRes = await fetch(
          `https://www.googleapis.com/drive/v3/files/${opts.driveFileId}?alt=media`,
          { headers: { Authorization: `Bearer ${accessToken}` } }
        );
        if (driveRes.ok) {
          const blob = await driveRes.blob();
          triggerDownload(blob, fileName);
          return;
        }
      }
    } catch {
      // Fall through to proxy
    }
  }

  const path = opts?.customPath || `/api/files/${fileId}/download`;
  const res = await authenticatedFetch(path, token, { method: "POST" });
  if (!res.ok) throw new Error("Failed to download file");
  const blob = await res.blob();
  triggerDownload(blob, fileName);
}

function triggerDownload(blob: Blob, fileName: string): void {
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  window.URL.revokeObjectURL(url);
  document.body.removeChild(a);
}

/**
 * Fetches media and returns a local Object URL.
 * Caller must revoke the URL when done: URL.revokeObjectURL(url)
 */
export async function fetchMediaBlobUrl(
  path: string,
  token: string | null
): Promise<string> {
  const res = await authenticatedFetch(path, token, { method: "POST" });
  if (!res.ok) throw new Error("Failed to fetch media");
  const blob = await res.blob();
  return window.URL.createObjectURL(blob);
}
```

STEP 8 — Update frontend/contexts/UploadContext.tsx
Find ALL occurrences of:
  const creds = localStorage.getItem("credentials");
And all places where creds is used to set X-Credentials header or inject into body.
Remove ALL of them. The upload function should use authenticatedFetch() which no
longer handles credentials at all — the backend does it automatically.

Specifically in the upload() function, replace:
```typescript
// OLD — remove this entire credentials block:
const creds = localStorage.getItem("credentials");
const initRes = await fetch("/api/files/upload/initiate", {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    Authorization: `Bearer ${token}`,
    ...(creds ? { "X-Credentials": creds } : {})
  },
  body: JSON.stringify({ ... }),
});
```
With:
```typescript
// NEW — use authenticatedFetch, no credentials needed
const initRes = await authenticatedFetch("/api/files/upload/initiate", token, {
  method: "POST",
  body: JSON.stringify({
    fileName,
    mimeType: fileType,
    parentFolderId: parentId,
    accountIndex: targetAccountIndex,
  }),
});
```

Do the same for the finalize fetch and all other fetch() calls in UploadContext.tsx
that currently manually add X-Credentials or read from localStorage.

Also in the moveFile() function, remove all:
  const creds = localStorage.getItem("credentials");
  ...(creds ? { "X-Credentials": creds } : {})
And replace raw fetch() calls with authenticatedFetch().

STEP 9 — Update frontend/hooks/useSync.ts
Remove all references to localStorage credentials. The sync hook should only
use Clerk tokens. Replace the syncAccount function's token fetch with just
authenticatedFetch since the backend now handles Google credentials internally.

STEP 10 — Update frontend/app/dashboard/settings/page.tsx
Find the handleRemoveCredentials function and update it to call the backend:
```typescript
async function handleRemoveCredentials() {
  confirm("Remove stored credentials?", async () => {
    const token = await getToken();
    await authenticatedFetch("/api/credentials", token, { method: "DELETE" });
    toast("Credentials removed successfully.", "success");
    setTimeout(() => window.location.reload(), 1500);
  }, {
    description: "This will permanently delete your Google Cloud credentials from the server. You will need to re-upload them to use StitchDrive features.",
    confirmLabel: "Remove Credentials",
    danger: true,
  });
}
```

Also update the hasCredentials check in frontend/app/dashboard/page.tsx:
Remove the localStorage check and replace with an API call:
```typescript
useEffect(() => {
  const checkCreds = async () => {
    const token = await getToken();
    const res = await authenticatedFetch("/api/credentials/status", token);
    if (res.ok) {
      const data = await res.json();
      setHasCredentials(data.hasCredentials);
    }
  };
  checkCreds();
}, [getToken]);
```

================================================================================
FIX #2 — CRITICAL SECURITY: Validate and restrict thumbnail proxy URLs (SSRF)
================================================================================

PROBLEM:
- File: backend/src/controllers/filesController.js — getThumbnail() function
- The thumbnailLink stored in MongoDB is fetched directly without URL validation
- An attacker who can write to the DB could make the server fetch internal URLs

SOLUTION:
In backend/src/controllers/filesController.js, find the getThumbnail function.
Add URL validation BEFORE the fetch call. Insert this helper at the top of the
file (after imports):
```javascript
const SAFE_THUMBNAIL_HOSTS = [
  'lh3.googleusercontent.com',
  'lh4.googleusercontent.com',
  'lh5.googleusercontent.com',
  'lh6.googleusercontent.com',
  'drive.google.com',
  'docs.google.com',
];

function isSafeThumbnailUrl(urlString) {
  try {
    const parsed = new URL(urlString);
    if (parsed.protocol !== 'https:') return false;
    return SAFE_THUMBNAIL_HOSTS.some(host =>
      parsed.hostname === host || parsed.hostname.endsWith('.' + host)
    );
  } catch {
    return false;
  }
}
```

Then in getThumbnail(), replace:
```javascript
// OLD:
try {
  const response = await fetch(file.thumbnailLink);
```
With:
```javascript
// NEW:
if (!isSafeThumbnailUrl(file.thumbnailLink)) {
  return res.status(400).json({ detail: "Invalid thumbnail URL" });
}

const controller = new AbortController();
const timeoutId = setTimeout(() => controller.abort(), 5000);

try {
  const response = await fetch(file.thumbnailLink, { signal: controller.signal });
  clearTimeout(timeoutId);
```

Also add clearTimeout in the catch block:
```javascript
} catch (err) {
  clearTimeout(timeoutId);
  console.error(`[Thumbnail] Error for file ${file.driveFileId}:`, err.message);
  return res.status(502).json({ detail: "Error fetching thumbnail proxy" });
}
```

================================================================================
FIX #3 — CRITICAL SECURITY: Sign the OAuth state parameter
================================================================================

PROBLEM:
- File: backend/src/controllers/accountsController.js
- The state parameter is plain base64 JSON containing ownerId and accountIndex
- An attacker can craft a state that links their OAuth code to a different user

SOLUTION:
Add STATE_SECRET to your .env files:
  backend/.env: STATE_SECRET=<generate with: node -e "console.log(require('crypto').randomBytes(32).toString('hex'))">

In backend/src/controllers/accountsController.js, add these two helpers
at the TOP of the file, after imports:
```javascript
import crypto from "crypto";

function createSignedState(payload) {
  const data = JSON.stringify(payload);
  const sig = crypto
    .createHmac("sha256", process.env.STATE_SECRET || "fallback-change-me")
    .update(data)
    .digest("hex");
  return Buffer.from(JSON.stringify({ data, sig })).toString("base64url");
}

function verifySignedState(stateB64) {
  const decoded = JSON.parse(Buffer.from(stateB64, "base64url").toString("utf-8"));
  const { data, sig } = decoded;
  const expectedSig = crypto
    .createHmac("sha256", process.env.STATE_SECRET || "fallback-change-me")
    .update(data)
    .digest("hex");
  if (!crypto.timingSafeEqual(Buffer.from(sig, "hex"), Buffer.from(expectedSig, "hex"))) {
    throw new Error("Invalid state signature");
  }
  return JSON.parse(data);
}
```

In getNewOAuthUrl(), replace:
```javascript
// OLD:
const state = Buffer.from(JSON.stringify({ ownerId, accountIndex: newIndex })).toString("base64");
```
With:
```javascript
// NEW:
const state = createSignedState({ ownerId, accountIndex: newIndex });
```

In getOAuthUrl(), replace the same pattern.

In oauthCallback(), replace:
```javascript
// OLD:
try {
  stateObj = JSON.parse(Buffer.from(state, "base64").toString("utf-8"));
} catch (err) {
  return res.redirect(`${config.FRONTEND_URL}/dashboard/settings?error=oauth_invalid`);
}
```
With:
```javascript
// NEW:
try {
  stateObj = verifySignedState(state);
} catch (err) {
  console.warn("[OAuth] State verification failed:", err.message);
  return res.redirect(`${config.FRONTEND_URL}/dashboard/settings?error=oauth_invalid`);
}
```

================================================================================
FIX #4 — CRITICAL SECURITY: Move encryption key out of database
================================================================================

PROBLEM:
- File: backend/src/utils/configLoader.js
- File: backend/src/config/index.js
- The ENCRYPTION_KEY is stored in MongoDB. If DB is breached, all tokens exposed.

SOLUTION:
Add ENCRYPTION_KEY to your environment variables instead of DB:
  backend/.env: ENCRYPTION_KEY=<generate with: node -e "console.log(require('crypto').randomBytes(32).toString('base64'))">

Replace backend/src/utils/configLoader.js entirely with:
```javascript
import { setSecrets } from "../config/index.js";

export async function loadSecretsFromDB() {
  const encryptionKey = process.env.ENCRYPTION_KEY;
  if (!encryptionKey) {
    console.error("[Config] ENCRYPTION_KEY environment variable is not set.");
    process.exit(1);
  }

  // Validate key length (must decode to 32 bytes for Fernet AES-128)
  try {
    const raw = Buffer.from(encryptionKey, "base64");
    if (raw.length !== 32) {
      console.error("[Config] ENCRYPTION_KEY must be exactly 32 bytes (base64 encoded).");
      process.exit(1);
    }
  } catch {
    console.error("[Config] ENCRYPTION_KEY is not valid base64.");
    process.exit(1);
  }

  setSecrets({ encryption_key: encryptionKey });
  console.log("[Config] Encryption key loaded from environment.");
}
```

Note: The function name loadSecretsFromDB is kept for compatibility since it is
called in backend/src/index.js. No other files need to change.

================================================================================
FIX #5 — HIGH: Fix memory leak in AuthenticatedThumbnail component
================================================================================

PROBLEM:
- File: frontend/components/AuthenticatedThumbnail.tsx
- The cleanup function captures blobUrl at closure creation time
- If component unmounts before async resolution, revokeObjectURL may not fire

SOLUTION:
Replace the entire useEffect in AuthenticatedThumbnail.tsx with:
```typescript
useEffect(() => {
  if (!inView) return;

  let active = true;
  let allocatedUrl = "";

  const loadThumb = async () => {
    try {
      const token = await getToken();
      const url = await fetchMediaBlobUrl(`/api/files/${fileId}/thumbnail`, token);
      if (active) {
        allocatedUrl = url;
        setUrl(url);
      } else {
        // Component unmounted before we could use it — revoke immediately
        URL.revokeObjectURL(url);
      }
    } catch {
      if (active) setError(true);
    }
  };

  loadThumb();

  return () => {
    active = false;
    if (allocatedUrl) {
      URL.revokeObjectURL(allocatedUrl);
      allocatedUrl = "";
    }
  };
}, [fileId, getToken, inView]);
```

================================================================================
FIX #6 — HIGH: Fix infinite interval reset in useSync hook
================================================================================

PROBLEM:
- File: frontend/hooks/useSync.ts
- The auto-sync interval depends on [syncAll] which changes reference frequently
- This causes the 5-minute interval to reset repeatedly

SOLUTION:
In frontend/hooks/useSync.ts, find the useEffect with setInterval and replace it:
```typescript
// Add this import at top if not present:
import { useCallback, useState, useEffect, useRef } from "react";

// Add this ref inside the useSync function, before the useEffect:
const syncAllRef = useRef(syncAll);
useEffect(() => {
  syncAllRef.current = syncAll;
}, [syncAll]);

// Replace the existing interval useEffect with:
useEffect(() => {
  const interval = setInterval(() => {
    syncAllRef.current();
  }, 5 * 60_000);
  return () => clearInterval(interval);
}, []); // Empty array — interval is created once and never reset
```

================================================================================
FIX #7 — HIGH: Add rollback to file move operation
================================================================================

PROBLEM:
- File: frontend/contexts/UploadContext.tsx — moveFile() function
- If delete from source fails after successful upload to target, file is duplicated

SOLUTION:
In the moveFile() function inside UploadContext.tsx, find Step 6 (the delete step)
and replace that section with:
```typescript
// Step 6: Delete from source account — with rollback on failure
setSnacks((s) => s.map((sn) => (sn.id === id ? { ...sn, name: `[3/3] Deleting Source: ${fileName}`, progress: 95 } : sn)));

let deleteSuccess = false;
try {
  const deleteRes = await authenticatedFetch(`/api/files/${file.id}`, token, {
    method: "DELETE",
  });
  if (deleteRes.ok || deleteRes.status === 204 || deleteRes.status === 404) {
    deleteSuccess = true;
  } else {
    throw new Error(`Delete returned status ${deleteRes.status}`);
  }
} catch (deleteErr: any) {
  console.error("[Move] Source delete failed, attempting rollback:", deleteErr.message);
  // Rollback: delete the file we just uploaded to the target account
  try {
    await authenticatedFetch(`/api/files/upload/finalize`, token, {
      method: "DELETE", // This won't exist but we can trash the drive file directly
    });
    // Best-effort: trash the newly uploaded file on target
    const trashRes = await fetch(
      `https://www.googleapis.com/drive/v3/files/${driveFileId}`,
      {
        method: "DELETE",
        headers: { Authorization: `Bearer ${(await authenticatedFetch(`/api/accounts/${targetAccountIndex}/token`, token).then(r => r.json())).accessToken}` },
      }
    );
    console.log("[Move] Rollback trash status:", trashRes.status);
  } catch (rollbackErr: any) {
    console.error("[Move] Rollback also failed:", rollbackErr.message);
  }
  throw new Error(`Move failed: could not delete source file. Your file may be duplicated. Please check both accounts.`);
}
```

================================================================================
FIX #8 — MEDIUM: Add filename validation in rename endpoint
================================================================================

PROBLEM:
- File: backend/src/controllers/filesController.js — rename() function
- No validation on the new_name field — allows path traversal chars, null bytes

SOLUTION:
In backend/src/controllers/filesController.js, find the rename() function.
Replace the existing newName validation block:
```javascript
// OLD:
const newName = req.body.new_name?.trim();
if (!newName) {
  return res.status(400).json({ detail: "new_name is required and cannot be empty" });
}
```

With:
```javascript
// NEW:
const newName = req.body.new_name?.trim();
if (!newName) {
  return res.status(400).json({ detail: "new_name is required and cannot be empty" });
}

// Reject names that are too long
if (newName.length > 255) {
  return res.status(400).json({ detail: "File name cannot exceed 255 characters" });
}

// Reject path traversal and shell-injection characters
const INVALID_NAME_REGEX = /[<>:"/\\|?*\x00-\x1f]/;
if (INVALID_NAME_REGEX.test(newName)) {
  return res.status(400).json({ detail: "File name contains invalid characters" });
}

// Reject reserved names (Windows compatibility)
const RESERVED_NAMES = /^(CON|PRN|AUX|NUL|COM[1-9]|LPT[1-9])(\.|$)/i;
if (RESERVED_NAMES.test(newName)) {
  return res.status(400).json({ detail: "File name is reserved" });
}
```

================================================================================
FIX #9 — MEDIUM: Add rate limiting to file operation routes
================================================================================

PROBLEM:
- File: backend/src/routes/files.js
- File: backend/src/routes/accounts.js
- Only OAuth routes are rate limited; all file endpoints are unprotected

SOLUTION:
Create a new file: backend/src/middlewares/rateLimiters.js
```javascript
import { rateLimit } from "express-rate-limit";

// General API limiter: 200 requests per minute per user
export const apiLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 200,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => req.ownerId || req.ip,
  message: { detail: "Too many requests. Please slow down." },
  skip: (req) => req.method === "GET" && req.path.includes("/thumbnail"), // thumbnails excluded
});

// Download limiter: 60 downloads per minute per user
export const downloadLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 60,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => req.ownerId || req.ip,
  message: { detail: "Download rate limit exceeded. Please wait." },
});

// Upload limiter: 30 uploads per minute per user
export const uploadLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => req.ownerId || req.ip,
  message: { detail: "Upload rate limit exceeded. Please wait." },
});
```

In backend/src/routes/files.js, add at the top:
```javascript
import { apiLimiter, downloadLimiter, uploadLimiter } from "../middlewares/rateLimiters.js";
```

Then add limiters to specific routes. Find the route definitions and add:
```javascript
// Add apiLimiter to the main router:
router.use(requireAuth, apiLimiter); // applies to all routes in this file

// Add specific limiters:
router.get("/:fileId/download", downloadLimiter, getDownload);
router.post("/:fileId/download", downloadLimiter, getDownload);
router.get("/:fileId/view", downloadLimiter, getView);
router.post("/:fileId/view", downloadLimiter, getView);
router.post("/upload/initiate", uploadLimiter, initiateUpload);
router.post("/upload/finalize", uploadLimiter, finalizeUpload);
```

Note: requireAuth must come before these limiters in the middleware chain since
keyGenerator uses req.ownerId which is set by requireAuth.

================================================================================
FIX #10 — MEDIUM: Fix OAuth2 client cache — add size limit and TTL
================================================================================

PROBLEM:
- File: backend/src/services/driveService.js
- _oauth2Cache and _quotaCache are plain Maps that grow without bound

SOLUTION:
In backend/src/services/driveService.js, find the cache declarations at the top
and replace the entire cache setup section with:
```javascript
// ── Simple TTL + LRU Cache ─────────────────────────────────────────────────
class BoundedTTLCache {
  constructor(maxSize = 500, ttlMs = 30 * 60_000) {
    this._map = new Map();
    this._maxSize = maxSize;
    this._ttlMs = ttlMs;
  }

  get(key) {
    const entry = this._map.get(key);
    if (!entry) return undefined;
    if (Date.now() > entry.expiresAt) {
      this._map.delete(key);
      return undefined;
    }
    // Move to end (most recently used)
    this._map.delete(key);
    this._map.set(key, entry);
    return entry.value;
  }

  set(key, value) {
    if (this._map.has(key)) this._map.delete(key);
    else if (this._map.size >= this._maxSize) {
      // Evict oldest (first) entry
      this._map.delete(this._map.keys().next().value);
    }
    this._map.set(key, { value, expiresAt: Date.now() + this._ttlMs });
  }

  delete(key) {
    this._map.delete(key);
  }

  clear() {
    this._map.clear();
  }
}

// OAuth2 clients cached for 60 minutes, max 500 entries
const _oauth2Cache = new BoundedTTLCache(500, 60 * 60_000);

// Quota data cached for 5 minutes, max 500 entries
const _quotaCache = new BoundedTTLCache(500, QUOTA_CACHE_TTL_MS);
```

Then update the cache usage. The existing getOAuth2Client() uses:
  _oauth2Cache.get(cacheKey) — this now returns undefined instead of null when missing
  _oauth2Cache.set(cacheKey, { client, hash })

Change the check in getOAuth2Client():
```javascript
// OLD:
const cached = _oauth2Cache.get(cacheKey);
if (cached && cached.hash === credsHash) return cached.client;
```
Keep as-is — undefined is falsy so the if check still works correctly.

Also update invalidateOAuth2Cache and invalidateQuotaCache — they call
.delete() and .clear() which the new class supports the same way.
Also update getCachedQuota and setCachedQuota to use the new cache:
```javascript
function getCachedQuota(ownerId, accountIndex) {
  return _quotaCache.get(`${ownerId}_${accountIndex}`) ?? null;
}

function setCachedQuota(ownerId, accountIndex, data) {
  _quotaCache.set(`${ownerId}_${accountIndex}`, data);
}
```
Remove the old manual expiresAt logic since TTL is now handled by the cache class.

================================================================================
FIX #11 — MEDIUM: Add React Error Boundary to dashboard
================================================================================

PROBLEM:
- File: frontend/app/dashboard/layout.tsx
- No error boundary — any unhandled error crashes the entire dashboard

SOLUTION:
Create new file: frontend/components/DashboardErrorBoundary.tsx
```typescript
"use client";

import React from "react";

interface State {
  hasError: boolean;
  errorMessage: string;
}

export class DashboardErrorBoundary extends React.Component
  { children: React.ReactNode },
  State
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false, errorMessage: "" };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, errorMessage: error.message };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error("[ErrorBoundary] Caught error:", error, info);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex h-full flex-col items-center justify-center gap-4 p-8 text-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-rose-500/10 border border-rose-500/20">
            <svg className="h-8 w-8 text-rose-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z" />
            </svg>
          </div>
          <div>
            <h2 className="text-lg font-bold text-sd-text">Something went wrong</h2>
            <p className="mt-1 text-sm text-sd-text3 max-w-sm">
              An unexpected error occurred. Please refresh the page.
            </p>
            {this.state.errorMessage && (
              <p className="mt-2 text-xs font-mono text-rose-400 bg-rose-500/5 rounded-lg px-3 py-2 max-w-sm">
                {this.state.errorMessage}
              </p>
            )}
          </div>
          <button
            onClick={() => window.location.reload()}
            className="btn-primary rounded-xl px-6 py-2.5 text-sm font-semibold"
          >
            Reload Page
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
```

In frontend/app/dashboard/layout.tsx, import and wrap children:
```typescript
import { DashboardErrorBoundary } from "@/components/DashboardErrorBoundary";

// In the JSX, wrap the main content area:
<main id="dp-scroll" className="flex-1 overflow-y-auto p-4 lg:p-8">
  <DashboardErrorBoundary>
    <Suspense fallback={<Loading />}>
      {children}
    </Suspense>
  </DashboardErrorBoundary>
</main>
```

================================================================================
FIX #12 — MEDIUM: Fix stale re-render dependency in files page
================================================================================

PROBLEM:
- File: frontend/app/dashboard/files/page.tsx
- The useEffect that calls setCurrentFolder uses object reference as dependency

SOLUTION:
In frontend/app/dashboard/files/page.tsx, find:
```typescript
// OLD:
useEffect(() => {
  setCurrentFolder(currentFolder.id, currentFolder.id ? currentFolder.name : null);
}, [currentFolder, setCurrentFolder]);
```

Replace with:
```typescript
// NEW — use primitive values as dependencies, not the object:
const currentFolderId = currentFolder.id;
const currentFolderName = currentFolder.name;

useEffect(() => {
  setCurrentFolder(currentFolderId, currentFolderId ? currentFolderName : null);
}, [currentFolderId, currentFolderName, setCurrentFolder]);
```

================================================================================
FIX #13 — MEDIUM: Fix drag counter going negative
================================================================================

PROBLEM:
- File: frontend/contexts/UploadContext.tsx
- dragCounter can go negative, breaking subsequent drag-and-drop interactions

SOLUTION:
In frontend/contexts/UploadContext.tsx, find the drag event handlers inside
the useEffect and replace onDragLeave:
```javascript
// OLD:
function onDragLeave(e: DragEvent) {
  const types = Array.from(e.dataTransfer?.types || []);
  if (!types.includes("Files")) return;
  dragCounter.current--;
  if (dragCounter.current <= 0) {
    dragCounter.current = 0;
    setDragging(false);
  }
}
```

With:
```javascript
// NEW — same but guaranteed non-negative:
function onDragLeave(e: DragEvent) {
  const types = Array.from(e.dataTransfer?.types || []);
  if (!types.includes("Files")) return;
  dragCounter.current = Math.max(0, dragCounter.current - 1);
  if (dragCounter.current === 0) setDragging(false);
}
```

Also add a window blur handler to reset state if user drags file out of window:
```javascript
// Add inside the same useEffect, before the return statement:
function onWindowBlur() {
  dragCounter.current = 0;
  setDragging(false);
}
window.addEventListener("blur", onWindowBlur);

// Add to the cleanup return:
return () => {
  window.removeEventListener("dragenter", onDragEnter);
  window.removeEventListener("dragleave", onDragLeave);
  window.removeEventListener("dragover", onDragOver);
  window.removeEventListener("drop", onDrop);
  window.removeEventListener("blur", onWindowBlur); // ADD THIS LINE
};
```

================================================================================
FIX #14 — PERFORMANCE: Add pagination to file listing endpoint
================================================================================

PROBLEM:
- File: backend/src/controllers/filesController.js — listFiles()
- All files are fetched at once with no limit; bad for users with 1000+ files

SOLUTION:
In backend/src/controllers/filesController.js, replace the listFiles function:
```javascript
export async function listFiles(req, res) {
  const ownerId = req.ownerId;
  const page = Math.max(1, parseInt(req.query.page) || 1);
  const limit = Math.min(Math.max(1, parseInt(req.query.limit) || 200), 1000);
  const skip = (page - 1) * limit;

  const connected = await DriveAccount.find({ ownerId, isConnected: true })
    .select("accountIndex")
    .lean();
  const connectedIndices = connected.map((a) => a.accountIndex);

  const query = { ownerId, accountIndex: { $in: connectedIndices } };

  const [files, total] = await Promise.all([
    File.find(query)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean(),
    File.countDocuments(query),
  ]);

  res.setHeader("X-Total-Count", total);
  res.setHeader("X-Page", page);
  res.setHeader("X-Limit", limit);

  return res.json(files.map(fileToDict));
}
```

Note: The frontend currently fetches all files at once in useFiles.ts.
For now, set the default limit to 1000 to maintain current behavior while
enabling pagination capability. Future work: implement virtual scrolling
on the frontend and fetch pages as the user scrolls.

================================================================================
FIX #15 — PERFORMANCE: Add timeout to all external HTTP fetches
================================================================================

PROBLEM:
- File: backend/src/controllers/filesController.js — multiple fetch() calls
- File: backend/src/services/driveService.js — downloadFile()
- No timeouts means a slow Google CDN can hang the Node.js process

SOLUTION:
Create a utility: backend/src/utils/fetchWithTimeout.js
```javascript
/**
 * Wraps fetch() with an AbortController-based timeout.
 * @param {string} url
 * @param {RequestInit} options
 * @param {number} timeoutMs - default 10 seconds
 */
export async function fetchWithTimeout(url, options = {}, timeoutMs = 10_000) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal,
    });
    return response;
  } finally {
    clearTimeout(timeoutId);
  }
}
```

In backend/src/controllers/filesController.js:
- Import fetchWithTimeout at the top: import { fetchWithTimeout } from "../utils/fetchWithTimeout.js";
- In getThumbnail(), replace: const response = await fetch(file.thumbnailLink);
  With: const response = await fetchWithTimeout(file.thumbnailLink, {}, 5000);
  (Remove the AbortController you added in FIX #2 since fetchWithTimeout handles it)

================================================================================
FIX #16 — QUALITY: Remove hardcoded values from CORS config
================================================================================

PROBLEM:
- File: backend/src/index.js
- Hardcoded local IP and production URL in CORS origins list

SOLUTION:
In backend/src/index.js, replace the allowedOrigins array with:
```javascript
const allowedOrigins = [
  ...new Set(
    [
      "http://localhost:3000",
      process.env.FRONTEND_URL,
      ...(process.env.EXTRA_ALLOWED_ORIGINS
        ? process.env.EXTRA_ALLOWED_ORIGINS.split(",").map((o) => o.trim())
        : []),
    ].filter(Boolean)
  ),
];
```

Then in backend/.env add:
  EXTRA_ALLOWED_ORIGINS=http://192.168.137.1:3000

And in production deployment, set FRONTEND_URL to your production domain.
Remove the hardcoded "https://atifs-drive.vercel.app" from the code entirely.

================================================================================
FIX #17 — QUALITY: Sanitize error messages in production
================================================================================

PROBLEM:
- File: backend/src/middlewares/errorHandler.js
- Raw error messages (DB errors, stack traces) reach the client in production

SOLUTION:
Replace backend/src/middlewares/errorHandler.js entirely with:
```javascript
import multer from "multer";

const IS_PROD = process.env.NODE_ENV === "production";

export function errorHandler(err, req, res, next) {
  // Multer file size limit exceeded
  if (err instanceof multer.MulterError) {
    if (err.code === "LIMIT_FILE_SIZE") {
      return res.status(413).json({ detail: "File too large. Maximum upload size is 500 MB." });
    }
    return res.status(400).json({ detail: `Upload error: ${err.message}` });
  }

  // CORS errors
  if (err.message?.startsWith("CORS:")) {
    return res.status(403).json({ detail: err.message });
  }

  // JWT / auth errors
  if (err.name === "UnauthorizedError" || err.status === 401) {
    return res.status(401).json({ detail: "Not authenticated" });
  }

  // Mongoose bad ObjectId cast
  if (err.name === "CastError") {
    return res.status(404).json({ detail: "Resource not found" });
  }

  // Mongoose validation errors — safe to expose
  if (err.name === "ValidationError") {
    return res.status(400).json({ detail: err.message });
  }

  const status = err.status || err.statusCode || 500;

  // In production: hide internal 500 error details
  // In development: expose full message for debugging
  const detail = IS_PROD && status >= 500
    ? "An internal error occurred. Please try again."
    : (err.message || "Internal server error");

  if (status >= 500) {
    console.error("[Error]", {
      method: req.method,
      path: req.path,
      status,
      message: err.message,
      stack: IS_PROD ? undefined : err.stack,
    });
  }

  return res.status(status).json({ detail });
}
```

================================================================================
FIX #18 — QUALITY: Add real health check endpoint
================================================================================

PROBLEM:
- File: backend/src/index.js
- The /active endpoint doesn't check DB connectivity

SOLUTION:
In backend/src/index.js, replace:
```javascript
app.get("/active", (req, res) => res.json({ status: "active" }));
```

With:
```javascript
app.get("/health", async (req, res) => {
  const dbState = mongoose.connection.readyState;
  // readyState: 0=disconnected, 1=connected, 2=connecting, 3=disconnecting
  const dbHealthy = dbState === 1;
  const status = dbHealthy ? 200 : 503;
  return res.status(status).json({
    status: dbHealthy ? "healthy" : "degraded",
    db: ["disconnected", "connected", "connecting", "disconnecting"][dbState] || "unknown",
    uptime: Math.floor(process.uptime()),
    timestamp: new Date().toISOString(),
  });
});

// Keep /active for backward compatibility
app.get("/active", (req, res) => res.json({ status: "active" }));
```

Also add this import at the top of index.js if not already present:
```javascript
import mongoose from "mongoose";
```

================================================================================
FIX #19 — QUALITY: Upgrade multer to v2
================================================================================

PROBLEM:
- File: backend/package.json
- multer@1.4.5-lts.1 has known vulnerabilities (the package itself warns about this)

SOLUTION:
Run in backend/:
  npm uninstall multer
  npm install multer@2

Then in backend/src/routes/profile.js, verify the multer v2 API.
The main API change in multer v2:
- memoryStorage() works the same way
- limits option works the same way
- No API changes needed for your usage

Double-check by reading the multer v2 changelog before running.
If there are breaking changes, update accordingly.

================================================================================
ENVIRONMENT VARIABLE ADDITIONS SUMMARY
================================================================================

Add these to backend/.env and backend/.env.example:
Security — generate with: node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
STATE_SECRET=<your-generated-secret>
Security — generate with: node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
ENCRYPTION_KEY=<your-generated-32-byte-base64-key>
CORS — comma-separated list of additional allowed origins
EXTRA_ALLOWED_ORIGINS=http://192.168.137.1:3000

Remove from .env (no longer needed after FIX #4):
  Any existing encryption_key stored in MongoDB (can be deleted from DB after deployment)

================================================================================
TESTING CHECKLIST — Verify each fix works before deploying
================================================================================

FIX #1 (Credentials):
  [ ] Upload credentials.json via UI — verify it calls POST /api/credentials/store
  [ ] Verify no localStorage.getItem("credentials") calls remain in frontend
  [ ] Verify file operations work without X-Credentials header from frontend
  [ ] Verify OAuth flow still works (connect a Google account)
  [ ] Verify credentials status shows correctly on dashboard

FIX #2 (SSRF):
  [ ] Upload a file with a thumbnail — verify thumbnail loads
  [ ] Manually test that a non-googleusercontent.com thumbnailLink returns 400

FIX #3 (OAuth State):
  [ ] Set STATE_SECRET in .env
  [ ] Connect a new Google Drive account — verify OAuth flow completes
  [ ] Verify tampered state parameter returns oauth_invalid error

FIX #4 (Encryption Key):
  [ ] Set ENCRYPTION_KEY in .env with a valid 32-byte base64 key
  [ ] Restart backend — verify no startup errors
  [ ] Verify existing connected accounts still work (re-auth if needed since
      tokens were encrypted with the old key — existing tokens must be re-issued)

FIX #5 (Memory Leak):
  [ ] Open files page with many thumbnails
  [ ] Navigate away and back — verify no memory growth in browser dev tools

FIX #6 (Sync Interval):
  [ ] Verify auto-sync fires every 5 minutes without resetting

FIX #7 (Move Rollback):
  [ ] Test moving a file between accounts with good network
  [ ] Verify file appears on target and is removed from source

FIX #8 (Filename Validation):
  [ ] Try renaming a file to "../../etc/passwd" — should get 400
  [ ] Try renaming to a name > 255 chars — should get 400
  [ ] Try renaming to "normal file.txt" — should succeed

FIX #14 (Pagination):
  [ ] Verify files still load on the files page
  [ ] Check response headers include X-Total-Count

FIX #15 (Timeouts):
  [ ] Verify thumbnails still load
  [ ] Verify downloads still work

FIX #16 (CORS):
  [ ] Verify EXTRA_ALLOWED_ORIGINS works in .env
  [ ] Remove the hardcoded IP from code

FIX #17 (Error Sanitization):
  [ ] In production mode, trigger a 500 error — verify generic message shown
  [ ] In development mode — verify full error message shown

FIX #18 (Health Check):
  [ ] GET /health with DB connected — verify 200 and "healthy"

FIX #19 (Multer):
  [ ] Test avatar upload still works after upgrade

================================================================================
IMPORTANT NOTES FOR AI AGENT
================================================================================

1. FIX #4 (ENCRYPTION_KEY) is a BREAKING CHANGE for existing deployments.
   All refresh tokens stored in the DB were encrypted with the OLD key from MongoDB.
   After deploying FIX #4, users will need to reconnect their Google accounts
   because their stored refresh tokens cannot be decrypted with the new key.
   Plan a migration window or re-encrypt existing tokens before switching.

2. FIX #1 (Credentials) changes how EVERY request works in the frontend.
   After implementing, test the complete user flow end-to-end before deploying.

3. The order of fixes matters for FIX #1:
   - Do backend steps (1-5) before frontend steps (6-10)
   - The frontend must not call any credential endpoints that don't exist yet

4. Do NOT modify the following files unless explicitly instructed in a fix:
   - backend/src/models/DriveAccount.js
   - backend/src/models/File.js
   - backend/src/db/index.js
   - frontend/app/layout.tsx
   - frontend/middleware.ts
   - Any test files

5. After all fixes are applied, run:
   - cd backend && npm install (for potential new dependencies)
   - cd frontend && npm install (for potential new dependencies)
   - Verify TypeScript compiles: cd frontend && npx tsc --noEmit

END OF INSTRUCTIONS