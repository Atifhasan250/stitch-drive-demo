/**
 * Performs an authenticated fetch to the backend, including Clerk token and client-side credentials.
 */
export async function authenticatedFetch(
  url: string,
  token: string | null,
  options: RequestInit = {}
) {
  const creds = localStorage.getItem("credentials");
  
  // 1. Create a fresh headers object to avoid mutation
  const headers = new Headers(options.headers || {});
  if (token) headers.set("Authorization", `Bearer ${token}`);
  if (creds) headers.set("X-Credentials", creds);

  // 2. Pre-check for required credentials
  // Some routes like health, accounts list, and user profile don't need Google credentials to function.
  const isPublicOrMeta = url.includes("/health") || 
                         url.includes("/api/accounts") || 
                         url.includes("/api/profile");

  if (!creds && !isPublicOrMeta) {
    const err = new Error("Please upload your Google Cloud credentials.json first to perform this action.");
    (err as any).isMissingCredentials = true;
    throw err;
  }

  // 3. Prepare body and final URL
  let body = options.body;
  let finalUrl = url;

  // For POST/PATCH/PUT, try to inject credentials into body for reliability
  const method = (options.method || "GET").toUpperCase();
  if (creds && ["POST", "PATCH", "PUT"].includes(method)) {
    try {
      let currentBody = {};
      if (typeof body === "string" && body.trim().startsWith("{")) {
        currentBody = JSON.parse(body);
      }
      
      // Only inject if it's not a FormData object or other special type
      if (!body || typeof body === "string") {
        const newBody = { ...currentBody, xCredentials: JSON.parse(creds) };
        body = JSON.stringify(newBody);
        headers.set("Content-Type", "application/json");
      }
    } catch (e) {
      console.warn("[API] Could not inject credentials into request body, falling back to headers", e);
      // 'body' remains as it was
    }
  }

  // 4. Query string fallback for media/downloads
  if (creds && (url.includes("/download") || url.includes("/view") || url.includes("/thumbnail"))) {
    try {
      const b64 = btoa(creds);
      const separator = url.includes("?") ? "&" : "?";
      finalUrl = `${url}${separator}xCreds=${encodeURIComponent(b64)}`;
    } catch (e) {
      console.warn("[API] Could not encode credentials for query string", e);
    }
  }

  // 5. Perform the fetch
  try {
    return await fetch(finalUrl, {
      ...options,
      method, // Ensure method is normalized
      headers,
      body,
      credentials: "include"
    });
  } catch (err: any) {
    console.error(`[API] Fetch Error (${url}):`, err.message);
    throw err; // Re-throw to be caught by the UI
  }
}

/**
 * Downloads a file. Opts to download directly from Google Drive to save server bandwidth.
 */
export async function downloadFileAuthenticated(
  fileId: string,
  fileName: string,
  token: string | null,
  opts?: { 
    accountIndex?: number; 
    driveFileId?: string; 
    customPath?: string 
  }
) {
  // If we have direct drive info, try to bypass the server to save its bandwidth
  if (opts?.accountIndex !== undefined && opts?.driveFileId) {
    try {
      console.log(`[Download] Attempting direct-from-Google download for: ${fileName}`);
      // 1. Get a fresh access token for this specific account
      const tokenRes = await authenticatedFetch(`/api/accounts/${opts.accountIndex}/token`, token);
      if (!tokenRes.ok) throw new Error("Could not fetch fresh Google token");
      const { accessToken } = await tokenRes.json();

      // 2. Fetch directly from Google
      const driveRes = await fetch(`https://www.googleapis.com/drive/v3/files/${opts.driveFileId}?alt=media`, {
        headers: { Authorization: `Bearer ${accessToken}` }
      });
      
      if (driveRes.ok) {
        const blob = await driveRes.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = fileName;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
        console.log(`[Download] Direct download complete for: ${fileName}`);
        return;
      } else {
        console.warn("[Download] Google direct fetch failed, falling back to server proxy");
      }
    } catch (err) {
      console.error("[Download] Direct download error, falling back:", err);
    }
  }

  // Fallback to server-side proxy download (uses server bandwidth)
  const path = opts?.customPath || `/api/files/${fileId}/download`;
  const res = await authenticatedFetch(path, token, { method: "POST" });
  if (!res.ok) throw new Error("Failed to download file via proxy");

  const blob = await res.blob();
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
 * Fetches media (thumbnail or image) and returns a local Object URL.
 * Remember to call URL.revokeObjectURL(url) to prevent memory leaks if reused many times.
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
