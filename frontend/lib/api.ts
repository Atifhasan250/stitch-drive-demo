const API_BASE = (process.env.NEXT_PUBLIC_API_URL || "").replace(/\/$/, "");

export async function authenticatedFetch(
  url: string,
  token: string | null,
  options: RequestInit = {}
) {
  const headers = new Headers(options.headers || {});
  if (token) headers.set("Authorization", `Bearer ${token}`);
  const method = (options.method || "GET").toUpperCase();
  if (options.body && typeof options.body === "string" && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }

  try {
    const isAbsoluteUrl = url.startsWith("http://") || url.startsWith("https://");
    const isAppApiPath = url.startsWith("/api/");
    const finalUrl = isAbsoluteUrl
      ? url
      : isAppApiPath
        ? url
        : `${API_BASE}${url}`;

    return await fetch(finalUrl, {
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
  token: string | null,
  _opts?: {
    accountIndex?: number;
    driveFileId?: string;
  }
): Promise<string> {
  const res = await authenticatedFetch(path, token, { method: "POST" });
  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.detail || "Failed to fetch media");
  }
  const blob = await res.blob();
  return window.URL.createObjectURL(blob);
}

export async function fetchThumbnailBlobUrl(
  fileId: string,
  token: string | null,
): Promise<string> {
  const res = await authenticatedFetch(`/api/files/${fileId}/thumbnail`, token);
  if (!res.ok) throw new Error("Failed to fetch thumbnail");
  const blob = await res.blob();
  return window.URL.createObjectURL(blob);
}
