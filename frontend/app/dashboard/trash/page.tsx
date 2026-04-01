"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useAuth } from "@clerk/nextjs";
import { authenticatedFetch } from "@/lib/api";
import { formatBytes } from "@/lib/utils";
import { useUpload } from "@/contexts/UploadContext";

type TrashFile = {
  drive_file_id: string;
  file_name: string;
  account_index: number;
  size: number;
  mime_type: string | null;
  trashed_at: string;
};

type SortKey = "name" | "size" | "date";



function FileTypeIcon({ mimeType, size = 28 }: { mimeType: string | null; size?: number }) {
  const t = mimeType ?? "";
  if (t === "application/vnd.google-apps.folder") {
    return (
      <svg width={size} height={size} viewBox="0 0 48 48" fill="none">
        <rect x="4" y="14" width="40" height="26" rx="4" fill="#64748b" />
        <path d="M4 14h14l4 -5h2v5" fill="#64748b" />
        <rect x="4" y="20" width="40" height="20" rx="4" fill="#94a3b8" />
      </svg>
    );
  }
  const color = t.startsWith("image/") ? "#a855f7"
    : t.startsWith("video/") ? "#3b82f6"
    : t.startsWith("audio/") ? "#ec4899"
    : t.includes("pdf") ? "#f43f5e"
    : t.includes("spreadsheet") || t.includes("sheet") ? "#10b981"
    : t.includes("document") || t.startsWith("text/") ? "#0ea5e9"
    : "#94a3b8";
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" fill="none">
      <path d="M14 8h14l10 10v24a3 3 0 01-3 3H14a3 3 0 01-3-3V10a3 3 0 013-3z" stroke={color} strokeWidth="3" fill="none" />
      <path d="M28 8v10h10" stroke={color} strokeWidth="3" strokeLinejoin="round" fill="none" />
    </svg>
  );
}

export default function TrashPage() {
  const { getToken } = useAuth();
  const [files, setFiles] = useState<TrashFile[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [view, setView] = useState<"grid" | "list">("grid");
  const [sortBy, setSortBy] = useState<SortKey>("date");
  const [acting, setActing] = useState<string | null>(null);
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedItems, setSelectedItems] = useState<Set<string>>(new Set());
  const { toast, updateToast, confirm } = useUpload();

  function getItemKey(file: TrashFile) {
    return `${file.account_index}:${file.drive_file_id}`;
  }

  function handleToggleSelect(file: TrashFile) {
    const key = getItemKey(file);
    setSelectedItems(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  function handleExitSelectionMode() {
    setSelectionMode(false);
    setSelectedItems(new Set());
  }

  function handleDeselectAll() {
    setSelectedItems(new Set());
  }

  function handleSelectAll() {
    const newSelection = new Set<string>();
    filtered.forEach(f => newSelection.add(getItemKey(f)));
    setSelectedItems(newSelection);
  }

  async function handleBulkRestore() {
    if (selectedItems.size === 0) return;
    confirm(`Restore ${selectedItems.size} selected items?`, async () => {
      const currentSelected = new Set(selectedItems);
      const tid = toast(`Restoring ${currentSelected.size} items...`, "loading");
      setSelectionMode(false);
      try {
        const promises = Array.from(currentSelected).map(async (key) => {
          const [acc, fid] = key.split(":");
          const token = await getToken();
          const res = await authenticatedFetch(`/api/files/trash/${acc}/${fid}/restore`, token, { method: "POST" });
          return { key, ok: res.ok || res.status === 204 };
        });
        const results = await Promise.all(promises);
        const succeededKeys = new Set(results.filter(r => r.ok).map(r => r.key));
        
        setFiles(prev => prev.filter(f => !succeededKeys.has(getItemKey(f))));
        setSelectedItems(new Set());
        
        if (succeededKeys.size === currentSelected.size) {
           updateToast(tid, "success", `Restored all ${succeededKeys.size} items successfully!`);
        } else {
           updateToast(tid, "error", `Restored ${succeededKeys.size} of ${currentSelected.size} items`);
        }
      } catch (err: any) {
        console.error("[Trash] Bulk restore error:", err);
        updateToast(tid, "error", err.message || "Bulk restore failed");
      }
    }, { confirmLabel: "Restore" });
  }

  async function handleBulkDelete() {
    if (selectedItems.size === 0) return;
    confirm(`Permanently delete ${selectedItems.size} selected items?`, async () => {
      const currentSelected = new Set(selectedItems);
      const tid = toast(`Deleting ${currentSelected.size} items permanently...`, "loading");
      setSelectionMode(false);
      try {
        const promises = Array.from(currentSelected).map(async (key) => {
          const [acc, fid] = key.split(":");
          const token = await getToken();
          const res = await authenticatedFetch(`/api/files/trash/${acc}/${fid}`, token, { method: "DELETE" });
          return { key, ok: res.ok || res.status === 204 };
        });
        const results = await Promise.all(promises);
        const succeededKeys = new Set(results.filter(r => r.ok).map(r => r.key));
        
        setFiles(prev => prev.filter(f => !succeededKeys.has(getItemKey(f))));
        setSelectedItems(new Set());
        
        if (succeededKeys.size === currentSelected.size) {
           updateToast(tid, "success", `Permanently deleted all ${succeededKeys.size} items`);
        } else {
           updateToast(tid, "error", `Deleted ${succeededKeys.size} of ${currentSelected.size} items`);
        }
      } catch (err: any) {
        console.error("[Trash] Bulk delete error:", err);
        updateToast(tid, "error", err.message || "Bulk delete failed");
      }
    }, { confirmLabel: "Delete permanently", danger: true });
  }

  const fetchTrash = useCallback(async () => {
    setLoading(true);
    try {
      const token = await getToken();
      const res = await authenticatedFetch("/api/files/trash", token);
      if (res.ok) setFiles(await res.json());
    } catch (err: any) {
      if (err.message?.includes("credentials")) {
         toast(err.message, "error");
      }
    }
    setLoading(false);
  }, [getToken]);

  useEffect(() => { fetchTrash(); }, [fetchTrash]);

  const filtered = useMemo(() => {
    let result = files.filter((f) => f.file_name.toLowerCase().includes(search.toLowerCase()));
    return [...result].sort((a, b) => {
      if (sortBy === "name") return a.file_name.localeCompare(b.file_name);
      if (sortBy === "size") return b.size - a.size;
      return (b.trashed_at ?? "").localeCompare(a.trashed_at ?? "");
    });
  }, [files, search, sortBy]);

  async function handleRestore(file: TrashFile) {
    const key = `restore-${file.account_index}-${file.drive_file_id}`;
    setActing(key);
    const tid = toast(`Restoring "${file.file_name}"…`, "loading");
    try {
      const token = await getToken();
      const res = await authenticatedFetch(
        `/api/files/trash/${file.account_index}/${file.drive_file_id}/restore`,
        token,
        { method: "POST" }
      );
      if (res.ok || res.status === 204) {
        setFiles((prev) => prev.filter(
          (f) => !(f.drive_file_id === file.drive_file_id && f.account_index === file.account_index)
        ));
        updateToast(tid, "success", `Restored "${file.file_name}" to original location`);
      } else {
        const err = await res.json().catch(() => ({}));
        updateToast(tid, "error", `Restore failed: ${err.detail || 'Access denied'}`);
      }
    } catch (err: any) {
      updateToast(tid, "error", `Restore failed: ${err.message}`);
    }
    setActing(null);
  }

  async function handleDelete(file: TrashFile) {
    const key = `delete-${file.account_index}-${file.drive_file_id}`;
    setActing(key);
    const tid = toast(`Deleting "${file.file_name}" permanently…`, "loading");
    try {
      const token = await getToken();
      const res = await authenticatedFetch(
        `/api/files/trash/${file.account_index}/${file.drive_file_id}`,
        token,
        { method: "DELETE" }
      );
      if (res.ok || res.status === 204) {
        setFiles((prev) => prev.filter(
          (f) => !(f.drive_file_id === file.drive_file_id && f.account_index === file.account_index)
        ));
        updateToast(tid, "success", "Deleted permanently from Google Drive");
      } else {
        const err = await res.json().catch(() => ({}));
        updateToast(tid, "error", `Delete failed: ${err.detail || 'Access denied'}`);
      }
    } catch (err: any) {
      updateToast(tid, "error", `Delete failed: ${err.message}`);
    }
    setActing(null);
  }

  function ActionButtons({ file }: { file: TrashFile }) {
    const restoreKey = `restore-${file.account_index}-${file.drive_file_id}`;
    const deleteKey = `delete-${file.account_index}-${file.drive_file_id}`;
    const isRestoring = acting === restoreKey;
    const isDeleting = acting === deleteKey;
    const busy = isRestoring || isDeleting;

    return (
      <>
        <button
          onClick={() => handleRestore(file)}
          disabled={busy}
          className="flex h-8 w-8 items-center justify-center rounded-lg text-sd-text3 transition hover:bg-emerald-500/10 hover:text-emerald-400 disabled:opacity-40"
          title="Restore"
        >
          {isRestoring ? (
            <svg className="h-4 w-4 animate-spin" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0 3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182m0-4.991v4.99" />
            </svg>
          ) : (
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 15 3 9m0 0 6-6M3 9h12a6 6 0 0 1 0 12h-3" />
            </svg>
          )}
        </button>
        <button
          onClick={() => handleDelete(file)}
          disabled={busy}
          className="flex h-8 w-8 items-center justify-center rounded-lg text-sd-text3 transition hover:bg-rose-500/10 hover:text-rose-400 disabled:opacity-40"
          title="Delete permanently"
        >
          {isDeleting ? (
            <svg className="h-4 w-4 animate-spin" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0 3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182m0-4.991v4.99" />
            </svg>
          ) : (
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="m14.74 9-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 0 1-2.244 2.077H8.084a2.25 2.25 0 0 1-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 0 0-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 0 1 3.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 0 0-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 0 0-7.5 0" />
            </svg>
          )}
        </button>
      </>
    );
  }

  return (
    <div className="space-y-6 animate-fade-up">
      {/* Header */}
      {selectionMode ? (
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 rounded-2xl border border-blue-500/30 bg-blue-500/10 px-5 py-4 shadow-sm animate-fade-in backdrop-blur-sm">
          <div className="flex items-center gap-3 w-full sm:w-auto">
            <button
              onClick={handleExitSelectionMode}
              className="flex h-8 w-8 items-center justify-center rounded-lg text-blue-400 hover:bg-blue-500/20 transition"
            >
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
              </svg>
            </button>
            <h1 className="font-display text-xl sm:text-2xl font-bold text-blue-400">
              {selectedItems.size} Selected
            </h1>
          </div>
          
          <div className="flex flex-wrap items-center justify-center sm:justify-end gap-2 w-full sm:w-auto">
            <div className="flex items-center gap-2 w-full sm:w-auto justify-center sm:justify-start">
              <button
                onClick={handleSelectAll}
                className="flex-1 sm:flex-none rounded-xl border border-blue-500/30 bg-blue-500/20 px-4 py-2 text-sm font-semibold text-blue-300 transition hover:bg-blue-500/30 shadow-sm"
              >
                Select All
              </button>
              <button
                onClick={handleDeselectAll}
                className="flex-1 sm:flex-none rounded-xl border border-sd-border bg-sd-s1 px-4 py-2 text-sm font-semibold text-sd-text3 transition hover:text-sd-text hover:bg-sd-hover shadow-sm"
              >
                Deselect
              </button>
            </div>
            <div className="flex items-center gap-2 w-full sm:w-auto justify-center sm:justify-start">
              <button
                onClick={handleBulkRestore}
                disabled={selectedItems.size === 0}
                className="flex-1 sm:flex-none rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-2 text-sm font-semibold text-emerald-400 transition hover:bg-emerald-500/20 disabled:opacity-50 shadow-sm"
              >
                Restore
              </button>
              <button
                onClick={handleBulkDelete}
                disabled={selectedItems.size === 0}
                className="flex-1 sm:flex-none rounded-xl border border-rose-500/30 bg-rose-500/10 px-4 py-2 text-sm font-semibold text-rose-400 transition hover:bg-rose-500/20 disabled:opacity-50 shadow-sm"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      ) : (
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-4">
            <div>
              <h1 className="font-display text-2xl text-sd-text">Trash</h1>
              <p className="mt-1 flex items-center gap-2 text-sm font-medium text-sd-text2">
                {loading ? (
                  <>
                    <span className="h-1.5 w-1.5 rounded-full bg-sd-text3 animate-pulse" />
                    Loading…
                  </>
                ) : (
                  <>
                    <span className="flex h-5 items-center justify-center rounded-md bg-sd-s2 px-2 pb-[1px] text-[11px] font-bold text-sd-text">
                      {filtered.length}
                    </span>
                    {filtered.length === 1 ? "item" : "items"} available
                  </>
                )}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2.5">
            <button
              onClick={fetchTrash}
              disabled={loading}
              className="flex items-center gap-1.5 rounded-xl border border-sd-border bg-sd-s1 px-4 py-2 text-xs font-semibold text-sd-text2 transition hover:bg-sd-s2 hover:text-sd-text hover:border-sd-accent/30 shadow-sm disabled:opacity-50"
            >
              <svg className={`h-4 w-4 ${loading ? "animate-spin text-sd-accent" : ""}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0 3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182m0-4.991v4.99" />
              </svg>
              {loading ? "Refreshing" : "Refresh"}
            </button>
            <button
               onClick={() => setSelectionMode(true)}
               className="flex items-center gap-2 rounded-xl border border-sd-border bg-sd-s1 px-4 py-2 text-xs font-semibold text-sd-text2 transition hover:text-sd-text hover:bg-sd-hover hover:border-sd-accent/30 shadow-sm"
            >
               <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
               </svg>
               Select
            </button>
          </div>
        </div>
      )}

      {/* Toolbar */}
      <div className="flex items-center gap-3">
        <div className="relative flex-1">
          <svg className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-sd-text3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z" />
          </svg>
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search trash…"
            className="w-full rounded-xl border border-sd-border bg-sd-s1 py-2.5 pl-10 pr-4 text-sm font-medium text-sd-text placeholder-sd-text3 outline-none focus:border-sd-accent/50 focus:ring-2 focus:ring-sd-accent/10 transition shadow-sm"
          />
        </div>

        <select
          value={sortBy}
          onChange={(e) => setSortBy(e.target.value as SortKey)}
          className="rounded-xl border border-sd-border bg-sd-s1 py-2.5 pl-4 pr-10 text-sm font-medium text-sd-text2 outline-none focus:border-sd-accent/50 focus:ring-2 focus:ring-sd-accent/10 transition shadow-sm appearance-none cursor-pointer"
          style={{ backgroundImage: `url("data:image/svg+xml,%3csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 20 20'%3e%3cpath stroke='%236b82ab' stroke-linecap='round' stroke-linejoin='round' stroke-width='1.5' d='M6 8l4 4 4-4'/%3e%3c/svg%3e")`, backgroundPosition: 'right 0.5rem center', backgroundRepeat: 'no-repeat', backgroundSize: '1.5em 1.5em' }}
        >
          <option value="date">Date trashed</option>
          <option value="name">Name</option>
          <option value="size">Size</option>
        </select>

        <div className="flex rounded-xl border border-sd-border bg-sd-s1 p-1 shadow-sm">
          <button
            onClick={() => setView("grid")}
            className={`flex h-8 w-8 items-center justify-center rounded-lg transition ${view === "grid" ? "bg-sd-s2 text-sd-text shadow-sm" : "text-sd-text3 hover:text-sd-text hover:bg-sd-s2/50"}`}
            title="Grid view"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6A2.25 2.25 0 016 3.75h2.25A2.25 2.25 0 0110.5 6v2.25a2.25 2.25 0 01-2.25 2.25H6a2.25 2.25 0 01-2.25-2.25V6zM3.75 15.75A2.25 2.25 0 016 13.5h2.25a2.25 2.25 0 012.25 2.25V18a2.25 2.25 0 01-2.25 2.25H6A2.25 2.25 0 013.75 18v-2.25zM13.5 6a2.25 2.25 0 012.25-2.25H18A2.25 2.25 0 0120.25 6v2.25A2.25 2.25 0 0118 10.5h-2.25a2.25 2.25 0 01-2.25-2.25V6zM13.5 15.75a2.25 2.25 0 012.25-2.25H18a2.25 2.25 0 012.25 2.25V18A2.25 2.25 0 0118 20.25h-2.25A2.25 2.25 0 0113.5 18v-2.25z" />
            </svg>
          </button>
          <button
            onClick={() => setView("list")}
            className={`flex h-8 w-8 items-center justify-center rounded-lg transition ${view === "list" ? "bg-sd-s2 text-sd-text shadow-sm" : "text-sd-text3 hover:text-sd-text hover:bg-sd-s2/50"}`}
            title="List view"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 6.75h12M8.25 12h12m-12 5.25h12M3.75 6.75h.007v.008H3.75V6.75zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zM3.75 12h.007v.008H3.75V12zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm-.375 5.25h.007v.008H3.75v-.008zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0z" />
            </svg>
          </button>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-32">
          <svg className="h-8 w-8 animate-spin text-sd-accent shadow-glow" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0 3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182m0-4.991v4.99" />
          </svg>
        </div>
      ) : filtered.length === 0 ? (
        <div className="stat-card flex flex-col items-center justify-center rounded-2xl py-32 text-center shadow-sm">
          <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-sd-s2 border border-sd-border shadow-inner">
            <svg className="h-8 w-8 text-sd-text3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="m14.74 9-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 0 1-2.244 2.077H8.084a2.25 2.25 0 0 1-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 0 0-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 0 1 3.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 0 0-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 0 0-7.5 0" />
            </svg>
          </div>
          <p className="font-display tracking-wide text-lg text-sd-text mb-1">
            {search ? "No matching files" : "Trash is empty"}
          </p>
          <p className="text-sm font-medium text-sd-text3 max-w-sm">
            {search ? "Try adjusting your search terms." : "Deleted items will appear here before permanent deletion."}
          </p>
        </div>
      ) : view === "grid" ? (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
          {filtered.map((file) => {
            const key = getItemKey(file);
            const isSelected = selectedItems.has(key);
            return (
              <div
                key={key}
                onClick={() => selectionMode && handleToggleSelect(file)}
                className={`file-card group relative flex flex-col items-center gap-3 rounded-2xl p-4 transition-all duration-300 ${isSelected ? "ring-2 ring-blue-500 bg-blue-500/5 shadow-glow-sm opacity-100 grayscale-0 mix-blend-normal" : "opacity-80 mix-blend-luminosity grayscale-[0.3]"} ${selectionMode ? "cursor-pointer" : "hover:border-sd-border/80 hover:bg-sd-s2 hover:opacity-100 hover:grayscale-0 hover:mix-blend-normal"}`}
              >
                {selectionMode && (
                  <div className="absolute left-3 top-3 z-20">
                    <div className={`flex h-5 w-5 items-center justify-center rounded-full border shadow-md transition-all duration-200 ${isSelected ? "bg-blue-500 border-blue-500 text-white scale-110" : "border-sd-text3 bg-sd-bg/50 backdrop-blur-sm text-transparent"}`}>
                      <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
                      </svg>
                    </div>
                  </div>
                )}
                <span className="absolute right-3 top-3 flex items-center justify-center rounded-md border border-sd-border bg-sd-bg px-1.5 py-0.5 text-[9px] font-bold text-sd-text3 z-10">
                  <span className="h-1 w-1 rounded-full bg-emerald-400 mr-1" />
                  {file.account_index}
                </span>

                <div className="mt-4 mb-2 relative transform transition duration-300 group-hover:-translate-y-1">
                  <FileTypeIcon mimeType={file.mime_type} size={48} />
                </div>

                <div className="w-full mt-auto">
                  <span className="line-clamp-2 w-full text-center text-xs font-semibold text-sd-text leading-tight" title={file.file_name}>
                    {file.file_name}
                  </span>
                  <span className="mt-1.5 block w-full text-center font-mono text-[10px] text-sd-text3">
                    {file.trashed_at ? new Date(file.trashed_at).toLocaleDateString() : "—"}
                  </span>
                </div>

                {!selectionMode && (
                  <div className="absolute inset-x-0 bottom-0 top-0 rounded-2xl flex items-center justify-center gap-2 bg-sd-bg/85 backdrop-blur-[2px] opacity-0 transition group-hover:opacity-100" onClick={(e) => e.stopPropagation()}>
                    <ActionButtons file={file} />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      ) : (
        <div className="stat-card overflow-hidden rounded-2xl shadow-sm">
          <table className="w-full">
            <thead>
              <tr className="border-b border-sd-border bg-sd-s2/30">
                <th className="px-5 py-3.5 text-left text-[10px] font-bold uppercase tracking-widest text-sd-text3">Name</th>
                <th className="hidden px-5 py-3.5 text-left text-[10px] font-bold uppercase tracking-widest text-sd-text3 sm:table-cell">Size</th>
                <th className="hidden px-5 py-3.5 text-left text-[10px] font-bold uppercase tracking-widest text-sd-text3 md:table-cell">Account</th>
                <th className="hidden px-5 py-3.5 text-left text-[10px] font-bold uppercase tracking-widest text-sd-text3 md:table-cell">Trashed</th>
                <th className="px-5 py-3.5 text-right text-[10px] font-bold uppercase tracking-widest text-sd-text3 w-24">Actions</th>
              </tr>
            </thead>
             <tbody>
               {filtered.map((file) => {
                 const key = getItemKey(file);
                 const isSelected = selectedItems.has(key);
                 return (
                   <tr
                    key={key}
                    onClick={() => selectionMode && handleToggleSelect(file)}
                    className={`border-b border-sd-border last:border-0 transition-colors ${selectionMode ? "cursor-pointer" : ""} ${isSelected ? "bg-blue-500/10 border-blue-500/30 opacity-100 grayscale-0 mix-blend-normal shadow-inner" : "hover:bg-sd-s2/50 opacity-80 mix-blend-luminosity grayscale-[0.3]"}`}
                  >
                     <td className="px-5 py-3.5 pr-2">
                       <div className="flex items-center gap-4">
                         {selectionMode && (
                            <div className="flex-shrink-0">
                              <div className={`flex h-5 w-5 items-center justify-center rounded-full border shadow-sm transition ${isSelected ? "bg-blue-500 border-blue-500 text-white" : "border-sd-text3 bg-sd-bg relative text-transparent"}`}>
                                <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                                  <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
                                </svg>
                              </div>
                            </div>
                         )}
                         <div className="flex-shrink-0">
                           <FileTypeIcon mimeType={file.mime_type} size={28} />
                         </div>
                         <span className="text-sm font-semibold truncate text-sd-text" title={file.file_name}>{file.file_name}</span>
                       </div>
                     </td>
                     <td className="hidden px-5 py-3.5 text-xs font-mono text-sd-text3 sm:table-cell">{formatBytes(file.size)}</td>
                     <td className="hidden px-5 py-3.5 md:table-cell">
                       <span className="inline-flex items-center gap-1.5 rounded-md border border-sd-border bg-sd-bg px-2 py-1 text-[10px] font-bold text-sd-text3">
                         <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
                         {file.account_index}
                       </span>
                     </td>
                     <td className="hidden px-5 py-3.5 text-xs font-medium text-sd-text3 md:table-cell whitespace-nowrap">
                       {file.trashed_at ? new Date(file.trashed_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' }) : "—"}
                     </td>
                     <td className="px-5 py-3.5 text-right">
                       {!selectionMode && (
                        <div className="flex items-center justify-end gap-1">
                          <ActionButtons file={file} />
                        </div>
                       )}
                     </td>
                   </tr>
                 );
               })}
             </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
