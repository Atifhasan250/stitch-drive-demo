import { useAuth } from "@clerk/nextjs";
import { useCallback, useState, useEffect } from "react";
import { authenticatedFetch } from "@/lib/api";

export function useSync() {
  const { getToken } = useAuth();
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncError, setSyncError] = useState<string | null>(null);
  const [lastSyncTime, setLastSyncTime] = useState<number | null>(null);

  const fetchWithRetry = async (
    url: string, 
    options: RequestInit, 
    token: string | null = null,
    retries = 3
  ): Promise<Response> => {
    let lastErr: any;
    for (let i = 0; i < retries; i++) {
      try {
        const res = url.startsWith("/api") 
          ? await authenticatedFetch(url, token, options)
          : await fetch(url, options);

        if (res.ok) return res;
        if (res.status === 429 || res.status >= 500) {
           await new Promise(r => setTimeout(r, 1000 * (i + 1)));
           continue;
        }
        return res;
      } catch (err) {
        lastErr = err;
        await new Promise(r => setTimeout(r, 1000 * (i + 1)));
      }
    }
    throw lastErr || new Error("Fetch failed after retries");
  };

  const syncAccount = async (accountIndex: number) => {
    const clerkToken = await getToken();

    // 1. Get Google Access Token
    const tokenRes = await fetchWithRetry(`/api/accounts/${accountIndex}/token`, {}, clerkToken);
    if (!tokenRes.ok) throw new Error(`Failed to get access token for account ${accountIndex}`);
    const { accessToken } = await tokenRes.json();

    // 2. Fetch all files from Google Drive (Direct to Google)
    const driveFiles: any[] = [];
    let pageToken: string | undefined = undefined;
    
    do {
      const driveUrl = new URL("https://www.googleapis.com/drive/v3/files");
      driveUrl.searchParams.set("q", "'me' in owners and trashed = false");
      driveUrl.searchParams.set("pageSize", "1000");
      driveUrl.searchParams.set("fields", "nextPageToken, files(id, name, size, mimeType, thumbnailLink, createdTime, parents)");
      if (pageToken) driveUrl.searchParams.set("pageToken", pageToken);

      const res = await fetchWithRetry(driveUrl.toString(), {
        headers: { Authorization: `Bearer ${accessToken}` }
      });
      if (!res.ok) throw new Error(`Google Drive API error for account ${accountIndex}`);
      
      const data = await res.json();
      driveFiles.push(...(data.files || []));
      pageToken = data.nextPageToken;
    } while (pageToken);

    // 3. Cleanup deleted files in backend
    const currentDriveIds = driveFiles.map(f => f.id);
    const cleanupRes = await fetchWithRetry("/api/files/cleanup", {
      method: "POST",
      body: JSON.stringify({ accountIndex, currentDriveIds }),
    }, clerkToken);
    if (!cleanupRes.ok) throw new Error(`Cleanup failed for account ${accountIndex}`);

    // 4. Reconcile metadata in batches of 500
    const BATCH_SIZE = 500;
    for (let i = 0; i < driveFiles.length; i += BATCH_SIZE) {
      const batch = driveFiles.slice(i, i + BATCH_SIZE);
      const reconcileRes = await fetchWithRetry("/api/files/reconcile", {
        method: "POST",
        body: JSON.stringify({ accountIndex, driveFiles: batch }),
      }, clerkToken);
      if (!reconcileRes.ok) throw new Error(`Reconciliation failed for batch ${i / BATCH_SIZE} in account ${accountIndex}`);
    }
  };

  const syncAll = useCallback(async () => {
    if (isSyncing) return;
    setIsSyncing(true);
    setSyncError(null);

    try {
      const clerkToken = await getToken();
      const accountsRes = await authenticatedFetch("/api/accounts", clerkToken);
      if (!accountsRes.ok) throw new Error("Failed to fetch accounts list");
      const accounts = await accountsRes.json();
      const connectedAccounts = accounts.filter((a: any) => a.is_connected);

      for (const account of connectedAccounts) {
        await syncAccount(account.account_index);
      }
      
      setLastSyncTime(Date.now());
    } catch (err: any) {
      console.error("[Sync] Error:", err);
      let msg = err.message || "Synchronization failed";
      if (msg.toLowerCase().includes("credentials")) {
        msg = "You have to upload credentials before doing this action.";
      }
      setSyncError(msg);
    } finally {
      setIsSyncing(false);
    }
  }, [getToken]);

  useEffect(() => {
    const interval = setInterval(() => {
      syncAll();
    }, 5 * 60_000); // Every 5 minutes

    return () => clearInterval(interval);
  }, [syncAll]);

  return { syncAll, isSyncing, syncError, lastSyncTime };
}
