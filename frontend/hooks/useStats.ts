"use client";

// Cached stats hook — only re-fetches when files change (upload/delete/sync)
// Uses localStorage to persist stats between page loads

const CACHE_KEY = "sd_stats_v1";
const DIRTY_KEY = "sd_stats_dirty";
const STALE_MS = 10 * 60 * 1000; // 10 minutes

export type CachedStats = {
  totalFiles: number;
  totalFolders: number;
  totalSize: number;
  filesByType: Record<string, number>;
  sizeByType: Record<string, number>;
  filesByAccount: Record<string, number>;
  storageByAccount: { account_index: number; email: string | null; used: number; limit: number; free: number }[];
  weeklyUploads: { date: string; count: number }[];
  cachedAt: number;
};

export function markStatsDirty() {
  if (typeof window !== "undefined") {
    localStorage.setItem(DIRTY_KEY, "1");
  }
}

export function getCachedStats(): CachedStats | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as CachedStats;
  } catch {
    return null;
  }
}

export function setCachedStats(stats: CachedStats) {
  if (typeof window === "undefined") return;
  localStorage.setItem(CACHE_KEY, JSON.stringify(stats));
  localStorage.removeItem(DIRTY_KEY);
}

export function isStatsDirty(): boolean {
  if (typeof window === "undefined") return true;
  const dirty = localStorage.getItem(DIRTY_KEY);
  const cached = getCachedStats();
  if (!cached) return true;
  if (dirty === "1") return true;
  if (Date.now() - cached.cachedAt > STALE_MS) return true;
  return false;
}

function getMimeCategory(mimeType: string | null): string {
  const t = mimeType ?? "";
  if (t === "application/vnd.google-apps.folder") return "Folders";
  if (t.startsWith("image/")) return "Images";
  if (t.startsWith("video/")) return "Videos";
  if (t.startsWith("audio/")) return "Audio";
  if (t.includes("pdf")) return "PDFs";
  if (t.includes("spreadsheet") || t.includes("sheet")) return "Spreadsheets";
  if (t.includes("presentation") || t.includes("slide")) return "Presentations";
  if (t.includes("document") || t.startsWith("text/")) return "Documents";
  if (t.includes("zip") || t.includes("compressed")) return "Archives";
  return "Other";
}

type RawFile = {
  id: string;
  file_name: string;
  size: number;
  mime_type: string | null;
  account_index: number;
  created_at: string;
};

type RawAccount = {
  account_index: number;
  email: string | null;
  is_connected: boolean;
  used: number;
  limit: number;
  free: number;
};

export function computeStats(files: RawFile[], accounts: RawAccount[]): CachedStats {
  const filesByType: Record<string, number> = {};
  const sizeByType: Record<string, number> = {};
  const filesByAccount: Record<string, number> = {};
  let totalFolders = 0;
  let totalSize = 0;

  const now = new Date();
  const weeklyMap: Record<string, number> = {};
  
  // Initialize weekly map labels
  for (let i = 7; i >= 0; i--) {
    const d = new Date(now);
    d.setDate(d.getDate() - i * 7);
    const label = d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
    weeklyMap[label] = 0;
  }

  // Single pass calculation
  for (const f of files) {
    const isFolder = f.mime_type === "application/vnd.google-apps.folder";
    const size = f.size || 0;
    totalSize += size;

    if (isFolder) {
      totalFolders++;
    } else {
      const cat = getMimeCategory(f.mime_type);
      filesByType[cat] = (filesByType[cat] ?? 0) + 1;
      sizeByType[cat] = (sizeByType[cat] ?? 0) + size;

      const key = `#${f.account_index}`;
      filesByAccount[key] = (filesByAccount[key] ?? 0) + 1;

      // Weekly uploads check
      const created = new Date(f.created_at);
      const weeksAgo = Math.floor((now.getTime() - created.getTime()) / (7 * 24 * 60 * 60 * 1000));
      if (weeksAgo <= 7) {
        const d = new Date(now);
        d.setDate(d.getDate() - weeksAgo * 7);
        const label = d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
        if (weeklyMap[label] !== undefined) weeklyMap[label]++;
      }
    }
  }

  const weeklyUploads = Object.entries(weeklyMap).map(([date, count]) => ({ date, count }));

  return {
    totalFiles: files.length - totalFolders,
    totalFolders,
    totalSize,
    filesByType,
    sizeByType,
    filesByAccount,
    storageByAccount: accounts.filter((a) => a.is_connected).map((a) => ({
      account_index: a.account_index,
      email: a.email,
      used: a.used,
      limit: a.limit,
      free: a.free,
    })),
    weeklyUploads,
    cachedAt: Date.now(),
  };
}
