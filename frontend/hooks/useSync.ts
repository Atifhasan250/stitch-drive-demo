import { useAuth } from "@clerk/nextjs";
import { useCallback, useState, useEffect, useRef } from "react";
import { authenticatedFetch } from "@/lib/api";

const AUTO_SYNC_INTERVAL_MS = 30 * 60_000;
const SYNC_COOLDOWN_MS = 30 * 60_000;
const SYNC_LOCK_TTL_MS = 5 * 60_000;
const SYNC_LAST_RUN_KEY = "stitchdrive:last-sync-at";
const SYNC_LOCK_KEY = "stitchdrive:sync-lock";

export function useSync() {
  const { getToken } = useAuth();
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncError, setSyncError] = useState<string | null>(null);
  const [lastSyncTime, setLastSyncTime] = useState<number | null>(null);
  const tabIdRef = useRef(`tab_${Math.random().toString(36).slice(2)}`);

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

  const syncAll = useCallback(async (mode: "manual" | "auto" = "manual") => {
    if (isSyncing) return;
    if (typeof window !== "undefined") {
      if (!navigator.onLine) return;
      if (mode === "auto" && document.visibilityState !== "visible") return;
    }

    const clerkToken = await getToken();
    if (!clerkToken) return;

    let lockAcquired = false;
    if (typeof window !== "undefined") {
      if (mode === "auto") {
        const lastRun = Number(window.localStorage.getItem(SYNC_LAST_RUN_KEY) || "0");
        if (Date.now() - lastRun < SYNC_COOLDOWN_MS) return;
      }

      try {
        const rawLock = window.localStorage.getItem(SYNC_LOCK_KEY);
        const currentLock = rawLock ? JSON.parse(rawLock) : null;
        const now = Date.now();
        const lockExpired = !currentLock || now - currentLock.timestamp > SYNC_LOCK_TTL_MS;

        if (lockExpired || currentLock.tabId === tabIdRef.current) {
          window.localStorage.setItem(
            SYNC_LOCK_KEY,
            JSON.stringify({ tabId: tabIdRef.current, timestamp: now })
          );
          lockAcquired = true;
        } else if (mode === "auto") {
          return;
        }
      } catch {
        lockAcquired = true;
      }
    }

    setIsSyncing(true);
    setSyncError(null);

    try {
      const accountsRes = await authenticatedFetch("/api/accounts", clerkToken);
      if (!accountsRes.ok) throw new Error("Failed to fetch accounts list");
      const accounts = await accountsRes.json();
      const connectedAccounts = accounts.filter((a: any) => a.is_connected);

      for (const account of connectedAccounts) {
        await syncAccount(account.account_index);
      }
      
      const completedAt = Date.now();
      setLastSyncTime(completedAt);
      if (typeof window !== "undefined") {
        window.localStorage.setItem(SYNC_LAST_RUN_KEY, String(completedAt));
      }
    } catch (err: any) {
      console.error("[Sync] Error:", err);
      let msg = err.message || "Synchronization failed";
      if (msg.toLowerCase().includes("credentials")) {
        msg = "You have to upload credentials before doing this action.";
      }
      setSyncError(msg);
    } finally {
      if (typeof window !== "undefined" && lockAcquired) {
        try {
          const rawLock = window.localStorage.getItem(SYNC_LOCK_KEY);
          const currentLock = rawLock ? JSON.parse(rawLock) : null;
          if (!currentLock || currentLock.tabId === tabIdRef.current) {
            window.localStorage.removeItem(SYNC_LOCK_KEY);
          }
        } catch {
          window.localStorage.removeItem(SYNC_LOCK_KEY);
        }
      }
      setIsSyncing(false);
    }
  }, [getToken, isSyncing]);

  const syncAllRef = useRef(syncAll);

  useEffect(() => {
    syncAllRef.current = syncAll;
  }, [syncAll]);

  useEffect(() => {
    const interval = setInterval(() => {
      syncAllRef.current("auto");
    }, AUTO_SYNC_INTERVAL_MS);

    return () => clearInterval(interval);
  }, []);

  return { syncAll, isSyncing, syncError, lastSyncTime };
}
