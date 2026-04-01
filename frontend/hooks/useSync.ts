import { useAuth } from "@clerk/nextjs";
import { useCallback, useEffect, useRef, useState } from "react";
import { authenticatedFetch } from "@/lib/api";

const AUTO_SYNC_INTERVAL_MS = 30 * 60_000;
const SYNC_COOLDOWN_MS = 30 * 60_000;
const SYNC_LAST_RUN_KEY = "stitchdrive:last-sync-at";
const SYNC_CHANNEL_NAME = "stitchdrive-sync";

type SyncMode = "manual" | "auto";
type SyncMessage =
  | { type: "sync-complete"; completedAt: number }
  | { type: "sync-error"; message: string };

export function useSync() {
  const { getToken } = useAuth();
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncError, setSyncError] = useState<string | null>(null);
  const [lastSyncTime, setLastSyncTime] = useState<number | null>(null);
  const channelRef = useRef<BroadcastChannel | null>(null);

  const broadcast = useCallback((message: SyncMessage) => {
    channelRef.current?.postMessage(message);
  }, []);

  const executeSync = useCallback(async (token: string) => {
    setIsSyncing(true);
    setSyncError(null);

    try {
      const res = await authenticatedFetch("/api/files/sync", token, { method: "POST" });
      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.detail || "Synchronization failed");
      }

      const completedAt = Date.now();
      setLastSyncTime(completedAt);
      if (typeof window !== "undefined") {
        window.localStorage.setItem(SYNC_LAST_RUN_KEY, String(completedAt));
      }
      broadcast({ type: "sync-complete", completedAt });
    } catch (err: any) {
      let msg = err.message || "Synchronization failed";
      if (msg.toLowerCase().includes("credentials")) {
        msg = "You have to upload credentials before doing this action.";
      }
      setSyncError(msg);
      broadcast({ type: "sync-error", message: msg });
    } finally {
      setIsSyncing(false);
    }
  }, [broadcast]);

  const syncAll = useCallback(async (mode: SyncMode = "manual") => {
    if (isSyncing) return;

    if (typeof window !== "undefined") {
      if (!navigator.onLine) return;
      if (mode === "auto" && document.visibilityState !== "visible") return;
      if (mode === "auto") {
        const lastRun = Number(window.localStorage.getItem(SYNC_LAST_RUN_KEY) || "0");
        if (Date.now() - lastRun < SYNC_COOLDOWN_MS) return;
      }
    }

    const clerkToken = await getToken();
    if (!clerkToken) return;

    if (mode === "manual") {
      await executeSync(clerkToken);
      return;
    }

    const locks = typeof navigator !== "undefined" ? navigator.locks : undefined;
    if (!locks?.request) {
      return;
    }

    await locks.request("stitchdrive-auto-sync", { ifAvailable: true }, async (lock) => {
      if (!lock) return;
      await executeSync(clerkToken);
    });
  }, [executeSync, getToken, isSyncing]);

  const syncAllRef = useRef(syncAll);

  useEffect(() => {
    syncAllRef.current = syncAll;
  }, [syncAll]);

  useEffect(() => {
    if (typeof window === "undefined" || typeof BroadcastChannel === "undefined") {
      return;
    }

    const channel = new BroadcastChannel(SYNC_CHANNEL_NAME);
    channelRef.current = channel;

    channel.onmessage = (event: MessageEvent<SyncMessage>) => {
      if (event.data.type === "sync-complete") {
        setLastSyncTime(event.data.completedAt);
        setSyncError(null);
        window.localStorage.setItem(SYNC_LAST_RUN_KEY, String(event.data.completedAt));
      }

      if (event.data.type === "sync-error") {
        setSyncError(event.data.message);
      }
    };

    return () => {
      channel.close();
      channelRef.current = null;
    };
  }, []);

  useEffect(() => {
    const interval = setInterval(() => {
      syncAllRef.current("auto");
    }, AUTO_SYNC_INTERVAL_MS);

    return () => clearInterval(interval);
  }, []);

  return { syncAll, isSyncing, syncError, lastSyncTime };
}
