"use client";

import { useState, useMemo, useRef, useEffect, useCallback } from "react";
import { useFiles, type FileItem } from "@/hooks/useFiles";
import { useStorage } from "@/hooks/useStorage";
import { useSync } from "@/hooks/useSync";
import { useUpload } from "@/contexts/UploadContext";
import { markStatsDirty } from "@/hooks/useStats";
import { GridCard, ListRow } from "@/components/files/FileCards";
import { PreviewModal } from "@/components/files/PreviewModal";
import { downloadFileAuthenticated, authenticatedFetch } from "@/lib/api";
import { FolderDropPanel } from "@/components/files/FolderDropPanel";
import MoveToAccountModal from "@/components/files/MoveToAccountModal";
import { useAuth } from "@clerk/nextjs";

type TypeFilter = "all" | "folder" | "image" | "video" | "audio" | "pdf" | "doc" | "sheet" | "archive";
type SortKey = "date-desc" | "date-asc" | "name-asc" | "name-desc" | "size-desc" | "size-asc";
type BreadcrumbEntry = { id: string | null; name: string };

export default function FilesPage() {
  const { files, refreshFiles } = useFiles();
  const { accounts, refreshStorage } = useStorage();
  const { syncAll, isSyncing, syncError } = useSync();
  const { upload, addCompleteListener, setCurrentFolder, toast, updateToast, confirm } = useUpload();
  const { getToken } = useAuth();
  const [view, setView] = useState<"list" | "grid">("grid");
  const [breadcrumb, setBreadcrumb] = useState<BreadcrumbEntry[]>([{ id: null, name: "All Files" }]);
  const scrollStack = useRef<number[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [search, setSearch] = useState("");
  const [filterAccount, setFilterAccount] = useState<number | "all">("all");
  const [filterType, setFilterType] = useState<TypeFilter>("all");
  const [sortBy, setSortBy] = useState<SortKey>("date-desc");
  const [draggedFile, setDraggedFile] = useState<FileItem | null>(null);
  const [shareModal, setShareModal] = useState<{ file: FileItem; link: string | null; loading: boolean; revoking: boolean } | null>(null);
  const [previewFile, setPreviewFile] = useState<FileItem | null>(null);
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedItems, setSelectedItems] = useState<Set<string>>(new Set());
  const [moveToAccountFile, setMoveToAccountFile] = useState<FileItem | null>(null);

  function handleToggleSelect(id: string) {
    setSelectedItems(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
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
    filteredFiles.forEach(f => newSelection.add(f.id));
    setSelectedItems(newSelection);
  }

  async function handleBulkDelete() {
    if (selectedItems.size === 0) return;
    confirm(`Delete ${selectedItems.size} selected file${selectedItems.size === 1 ? '' : 's'}?`, async () => {
      const tid = toast(`Deleting ${selectedItems.size} items...`, "loading");
      try {
        const token = await getToken();
        const promises = Array.from(selectedItems).map(id => authenticatedFetch(`/api/files/${id}`, token, { 
          method: "DELETE" 
        }));
        const results = await Promise.allSettled(promises);
        const succeeded = results.filter(r => r.status === "fulfilled" && r.value.ok).length;
        markStatsDirty();
        await refreshFiles();
        refreshStorage();
        handleExitSelectionMode();
        if (succeeded === selectedItems.size) {
           updateToast(tid, "success", `Deleted ${succeeded} items`);
        } else {
           updateToast(tid, "error", `Deleted ${succeeded} of ${selectedItems.size} items`);
        }
      } catch (err: any) {
        updateToast(tid, "error", err.message || "Bulk delete failed");
      }
    }, { confirmLabel: "Delete", danger: true });
  }

  useEffect(() => {
    const unsub = addCompleteListener(() => {
      markStatsDirty();
      refreshFiles();
      refreshStorage();
    });
    return unsub;
  }, [addCompleteListener, refreshFiles, refreshStorage]);

  const currentFolder = breadcrumb[breadcrumb.length - 1];
  const currentFolderId = currentFolder.id;
  const currentFolderName = currentFolder.name;

  useEffect(() => {
    setCurrentFolder(currentFolderId, currentFolderId ? currentFolderName : null);
  }, [currentFolderId, currentFolderName, setCurrentFolder]);

  useEffect(() => {
    function onDragEnd() { setDraggedFile(null); }
    window.addEventListener("dragend", onDragEnd);
    return () => window.removeEventListener("dragend", onDragEnd);
  }, []);

  const panelFolders = useMemo(() => {
    if (!draggedFile) return [];
    return files.filter(
      (f) => f.account_index === draggedFile.account_index &&
             f.mime_type === "application/vnd.google-apps.folder" &&
             f.id !== draggedFile.id
    );
  }, [draggedFile, files]);

  const folderIds = useMemo(() => {
    const ids = new Set<string>();
    for (const f of files) {
      if (f.mime_type === "application/vnd.google-apps.folder") ids.add(f.drive_file_id);
    }
    return ids;
  }, [files]);

  const visibleFiles = useMemo(() => {
    if (currentFolder.id === null) {
      return files.filter((f) => !f.parent_drive_file_id || !folderIds.has(f.parent_drive_file_id));
    }
    return files.filter((f) => f.parent_drive_file_id === currentFolder.id);
  }, [files, currentFolder, folderIds]);

  const filteredFiles = useMemo(() => {
    let result = visibleFiles;

    if (search) {
      const q = search.toLowerCase();
      result = result.filter((f) => f.file_name.toLowerCase().includes(q));
    }

    if (filterAccount !== "all") {
      result = result.filter((f) => f.account_index === filterAccount);
    }

    if (filterType !== "all") {
      result = result.filter((f) => {
        const m = f.mime_type ?? "";
        switch (filterType) {
          case "folder": return m === "application/vnd.google-apps.folder";
          case "image": return m.startsWith("image/");
          case "video": return m.startsWith("video/");
          case "audio": return m.startsWith("audio/");
          case "pdf": return m.includes("pdf");
          case "sheet": return m.includes("spreadsheet") || m.includes("sheet");
          case "archive": return m.includes("zip") || m.includes("compressed") || m.includes("archive");
          case "doc": return m.includes("document") || m.startsWith("text/");
          default: return true;
        }
      });
    }

    return [...result].sort((a, b) => {
      switch (sortBy) {
        case "name-asc": return a.file_name.localeCompare(b.file_name);
        case "name-desc": return b.file_name.localeCompare(a.file_name);
        case "size-asc": return a.size - b.size;
        case "size-desc": return b.size - a.size;
        case "date-asc": return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
        default: return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
      }
    });
  }, [visibleFiles, search, filterAccount, filterType, sortBy]);

  function openFolder(file: FileItem) {
    const scroller = document.getElementById("sd-scroll");
    scrollStack.current = [...scrollStack.current, scroller?.scrollTop ?? 0];
    setBreadcrumb((prev) => [...prev, { id: file.drive_file_id, name: file.file_name }]);
    setTimeout(() => { document.getElementById("sd-scroll")?.scrollTo({ top: 0 }); }, 0);
  }

  function navigateTo(index: number) {
    const savedScroll = scrollStack.current[index] ?? 0;
    scrollStack.current = scrollStack.current.slice(0, index);
    setBreadcrumb((prev) => prev.slice(0, index + 1));
    setTimeout(() => {
      const scroller = document.getElementById("sd-scroll");
      if (scroller) scroller.scrollTop = savedScroll;
    }, 0);
  }

  async function handleRename(id: string, newName: string) {
    const tid = toast("Renaming…", "loading");
    try {
      const token = await getToken();
      const res = await authenticatedFetch(`/api/files/${id}/rename`, token, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ new_name: newName }),
      });
      if (!res.ok) throw new Error();
      refreshFiles();
      updateToast(tid, "success", "Renamed");
    } catch (err: any) {
      updateToast(tid, "error", err.message || "Rename failed");
    }
  }

  async function handleDelete(id: string) {
    const tid = toast("Deleting...", "loading");
    try {
      const token = await getToken();
      const res = await authenticatedFetch(`/api/files/${id}`, token, { 
        method: "DELETE"
      });
      if (!res.ok) throw new Error(String(res.status));
      markStatsDirty();
      await refreshFiles();
      refreshStorage();
      updateToast(tid, "success", "Deleted");
    } catch (err: any) {
      updateToast(tid, "error", err.message || "Delete failed");
    }
  }

  async function handleMove(fileId: string, targetFolderDriveId: string) {
    async function doMove(label: string, successMsg: string, tid: number) {
      try {
        const token = await getToken();
        const res = await authenticatedFetch(`/api/files/${fileId}/move`, token, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ new_parent_drive_file_id: targetFolderDriveId }),
        });
        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          const detail = body?.detail ?? "Move failed";
          const msg = detail.includes("no refresh token") ? "Account not connected — reconnect it from Accounts" : detail;
          updateToast(tid, "error", msg);
          return;
        }
        await refreshFiles();
        updateToast(tid, "success", successMsg);
      } catch (err: any) {
        updateToast(tid, "error", err.message || "Move failed");
      }
  }

    const isToRoot = targetFolderDriveId === "root";
    if (isToRoot) {
      confirm("Move to root?", async () => {
        const tid = toast("Moving to root...", "loading");
        await doMove("root", "Moved to root", tid);
      }, { confirmLabel: "Move", danger: false });
      return;
    }
    const tid = toast("Moving...", "loading");
    await doMove("folder", "File moved", tid);
  }

  async function handleShare(file: FileItem) {
    setShareModal({ file, link: null, loading: true, revoking: false });
    try {
      const token = await getToken();
      const res = await authenticatedFetch(`/api/files/${file.id}/share`, token, { 
        method: "POST"
      });
      if (!res.ok) throw new Error();
      const data = await res.json();
      setShareModal((prev) => prev ? { ...prev, link: data.link, loading: false } : null);
    } catch (err: any) {
      toast(err.message || "Failed to generate share link", "error");
      setShareModal(null);
    }
  }

  async function handleUnshare() {
    if (!shareModal) return;
    setShareModal((prev) => prev ? { ...prev, revoking: true } : null);
    try {
      const token = await getToken();
      const res = await authenticatedFetch(`/api/files/${shareModal.file.id}/share`, token, { 
        method: "DELETE"
      });
      if (!res.ok) throw new Error();
      toast("File is now private", "success");
      setShareModal(null);
    } catch (err: any) {
      toast(err.message || "Failed to revoke sharing", "error");
      setShareModal((prev) => prev ? { ...prev, revoking: false } : null);
    }
  }

  async function handleSync() {
    await syncAll();
    refreshFiles();
  }

  function handleFileInputChange(e: React.ChangeEvent<HTMLInputElement>) {
    Array.from(e.target.files ?? []).forEach((f) => upload(f, currentFolder.id));
    e.target.value = "";
  }

  const handleDragStartFile = useCallback((file: FileItem) => setDraggedFile(file), []);

  return (
    <>
      {draggedFile && (
        <FolderDropPanel
          draggedFile={draggedFile}
          folders={panelFolders}
          onDrop={(driveId) => handleMove(draggedFile.id, driveId)}
        />
      )}

      {previewFile && (
        <PreviewModal file={previewFile} onClose={() => setPreviewFile(null)} />
      )}

      {moveToAccountFile && (
        <MoveToAccountModal
          file={moveToAccountFile}
          onClose={() => setMoveToAccountFile(null)}
          onSuccess={() => { refreshFiles(); refreshStorage(); markStatsDirty(); }}
        />
      )}

      {shareModal && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 backdrop-blur-sm animate-fade-in"
          onClick={() => !shareModal.loading && !shareModal.revoking && setShareModal(null)}
        >
          <div
            className="w-full max-w-md rounded-2xl border border-sd-border bg-sd-s1 p-6 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-4 flex items-start justify-between gap-3">
              <div className="min-w-0 flex items-center gap-3">
                 <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-blue-500/10 text-blue-400 border border-blue-500/20">
                    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M13.19 8.688a4.5 4.5 0 0 1 1.242 7.244l-4.5 4.5a4.5 4.5 0 0 1-6.364-6.364l1.757-1.757m13.35-.622 1.757-1.757a4.5 4.5 0 0 0-6.364-6.364l-4.5 4.5a4.5 4.5 0 0 0 1.242 7.244" />
                    </svg>
                 </div>
                 <div className="min-w-0">
                    <p className="text-base font-semibold text-sd-text">Share Link</p>
                    <p className="mt-0.5 truncate text-xs font-medium text-sd-text3" title={shareModal.file.file_name}>
                      {shareModal.file.file_name}
                    </p>
                 </div>
              </div>
              <button
                onClick={() => setShareModal(null)}
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-sd-text3 hover:bg-sd-hover hover:text-sd-text transition"
              >
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {shareModal.loading ? (
              <div className="flex flex-col items-center justify-center gap-3 py-8 text-sd-text3">
                <svg className="h-6 w-6 animate-spin text-blue-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0 3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182m0-4.991v4.99" />
                </svg>
                <span className="text-sm font-medium">Generating secure link…</span>
              </div>
            ) : shareModal.link ? (
              <div className="animate-fade-up">
                <div className="flex items-center gap-2 rounded-xl border border-sd-border bg-sd-bg px-3 py-2.5 shadow-inner">
                  <input
                    readOnly
                    value={shareModal.link}
                    className="min-w-0 flex-1 bg-transparent text-sm font-medium text-sd-text outline-none selection:bg-blue-500/30"
                    onFocus={(e) => e.target.select()}
                  />
                  <button
                    onClick={() => { navigator.clipboard.writeText(shareModal.link!); toast("Link copied!", "success"); }}
                    className="btn-primary shrink-0 rounded-lg px-4 py-1.5 text-xs font-semibold shadow-sm"
                  >
                    Copy
                  </button>
                </div>
                <p className="mt-3 text-xs text-sd-text3 flex items-center gap-1.5">
                   <svg className="h-4 w-4 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                     <path strokeLinecap="round" strokeLinejoin="round" d="m11.25 11.25.041-.02a.75.75 0 0 1 1.063.852l-.708 2.836a.75.75 0 0 0 1.063.853l.041-.021M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Zm-9-3.75h.008v.008H12V8.25Z" />
                   </svg>
                   Anyone with this link can view and download the file.
                </p>
                
                <div className="mt-6 flex justify-between gap-3 border-t border-sd-border pt-4">
                  <button
                    onClick={handleUnshare}
                    disabled={shareModal.revoking}
                    className="flex items-center gap-2 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-2 text-sm font-medium text-red-400 transition hover:bg-red-500/20 disabled:opacity-50"
                  >
                    {shareModal.revoking && (
                      <svg className="h-4 w-4 animate-spin" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0 3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182m0-4.991v4.99" />
                      </svg>
                    )}
                    Revoke access
                  </button>
                  <button
                    onClick={() => setShareModal(null)}
                    className="rounded-xl border border-sd-border bg-sd-s1 px-5 py-2 text-sm font-semibold text-sd-text transition hover:bg-sd-hover shadow-sm"
                  >
                    Done
                  </button>
                </div>
              </div>
            ) : null}
          </div>
        </div>
      )}

    <div className="space-y-6 animate-fade-up">
      <input ref={fileInputRef} type="file" multiple className="hidden" onChange={handleFileInputChange} />



      {/* Header and filters section */}
      <div className="flex flex-col gap-4">
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
                  onClick={handleBulkDelete}
                  disabled={selectedItems.size === 0}
                  className="flex-1 sm:flex-none rounded-xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm font-semibold text-rose-400 transition hover:bg-rose-500/20 disabled:opacity-50 shadow-sm min-w-[100px]"
                >
                  Delete
                </button>
              </div>
            </div>
          </div>
        ) : (
          <>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-4">
              <div>
                <h1 className="font-display text-3xl font-bold text-sd-text">Files</h1>
                <p className="mt-1 text-sm font-medium text-sd-text3">
                  {filteredFiles.length !== visibleFiles.length
                    ? `Showing ${filteredFiles.length} of ${visibleFiles.length} items`
                    : `${visibleFiles.length} ${visibleFiles.length === 1 ? "item" : "items"}`}
                </p>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2.5">
            <button
              onClick={handleSync}
              disabled={isSyncing}
              className="flex items-center gap-2 rounded-xl border border-sd-border bg-sd-s1 px-4 py-2.5 text-sm font-semibold text-sd-text2 transition hover:text-sd-text hover:bg-sd-hover hover:border-sd-text3 disabled:opacity-50 shadow-sm"
            >
              <svg className={`h-4 w-4 ${isSyncing ? "animate-spin text-blue-400" : ""}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0 3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182m0-4.991v4.99" />
              </svg>
              {isSyncing ? "Syncing..." : "Sync Drive"}
            </button>

            <button
               onClick={() => setSelectionMode(true)}
               className="flex items-center gap-2 rounded-xl border border-sd-border bg-sd-s1 px-4 py-2.5 text-sm font-semibold text-sd-text2 transition hover:text-sd-text hover:bg-sd-hover hover:border-sd-text3 shadow-sm"
            >
               <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
               </svg>
               Select
            </button>

            <div className="flex rounded-xl border border-sd-border bg-sd-s1 p-1 shadow-sm">
              <button onClick={() => setView("grid")} className={`rounded-lg p-1.5 transition ${view === "grid" ? "bg-sd-s2 text-sd-text shadow-sm" : "text-sd-text3 hover:text-sd-text"}`} title="Grid view">
                <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M4 4h6v6H4zm10 0h6v6h-6zM4 14h6v6H4zm10 0h6v6h-6z"/>
                </svg>
              </button>
              <button onClick={() => setView("list")} className={`rounded-lg p-1.5 transition ${view === "list" ? "bg-sd-s2 text-sd-text shadow-sm" : "text-sd-text3 hover:text-sd-text"}`} title="List view">
                <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M4 6h16v2H4zm0 5h16v2H4zm0 5h16v2H4z"/>
                </svg>
              </button>
            </div>

            <button
              onClick={() => fileInputRef.current?.click()}
              className="btn-primary flex items-center gap-2 rounded-xl px-5 py-2.5 text-sm font-bold shadow-md transition"
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0 4.5 4.5M12 3v13.5" />
              </svg>
              Upload Files
            </button>
          </div>
        </div>

        {/* Filters */}
        <div className="flex flex-wrap items-center gap-3">
          <div className="w-full rounded-2xl border border-blue-500/20 bg-blue-500/5 px-4 py-3 text-sm font-medium text-blue-300 shadow-sm">
            Click sync drive to sync recently added files.
          </div>
          <div className="relative flex-1 min-w-[200px]">
            <svg className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-sd-text3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z" />
            </svg>
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search files by name..."
              className="w-full rounded-xl border border-sd-border bg-sd-s1 py-2.5 pl-10 pr-4 text-sm font-medium text-sd-text placeholder-sd-text3 outline-none focus:border-blue-500/50 focus:ring-2 focus:ring-blue-500/10 transition shadow-sm"
            />
          </div>

          <div className="flex flex-wrap gap-2">
            <select
              value={filterAccount}
              onChange={(e) => setFilterAccount(e.target.value === "all" ? "all" : Number(e.target.value))}
              className="cursor-pointer appearance-none rounded-xl border border-sd-border bg-sd-s1 px-4 py-2.5 pr-8 text-sm font-medium text-sd-text outline-none focus:border-blue-500/50 hover:bg-sd-hover transition shadow-sm"
              style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 24 24' stroke='%235c749c'%3E%3Cpath stroke-linecap='round' stroke-linejoin='round' stroke-width='2' d='M19 9l-7 7-7-7'%3E%3C/path%3E%3C/svg%3E")`, backgroundPosition: 'right 10px center', backgroundRepeat: 'no-repeat', backgroundSize: '16px' }}
            >
              <option value="all">Every Account</option>
              {accounts.filter((a) => a.is_connected).map((a) => (
                <option key={a.account_index} value={a.account_index}>
                  {a.email ? a.email.split("@")[0] : `Account #${a.account_index}`}
                </option>
              ))}
            </select>

            <select
              value={filterType}
              onChange={(e) => setFilterType(e.target.value as TypeFilter)}
              className="cursor-pointer appearance-none rounded-xl border border-sd-border bg-sd-s1 px-4 py-2.5 pr-8 text-sm font-medium text-sd-text outline-none focus:border-blue-500/50 hover:bg-sd-hover transition shadow-sm"
              style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 24 24' stroke='%235c749c'%3E%3Cpath stroke-linecap='round' stroke-linejoin='round' stroke-width='2' d='M19 9l-7 7-7-7'%3E%3C/path%3E%3C/svg%3E")`, backgroundPosition: 'right 10px center', backgroundRepeat: 'no-repeat', backgroundSize: '16px' }}
            >
              <option value="all">Any Type</option>
              <option value="folder">Folders only</option>
              <option value="image">Images</option>
              <option value="video">Videos</option>
              <option value="audio">Audio</option>
              <option value="pdf">PDFs</option>
              <option value="doc">Documents</option>
              <option value="sheet">Spreadsheets</option>
              <option value="archive">Archives / ZIPs</option>
            </select>

            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as SortKey)}
              className="cursor-pointer appearance-none rounded-xl border border-sd-border bg-sd-s1 px-4 py-2.5 pr-8 text-sm font-medium text-sd-text outline-none focus:border-blue-500/50 hover:bg-sd-hover transition shadow-sm"
              style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 24 24' stroke='%235c749c'%3E%3Cpath stroke-linecap='round' stroke-linejoin='round' stroke-width='2' d='M19 9l-7 7-7-7'%3E%3C/path%3E%3C/svg%3E")`, backgroundPosition: 'right 10px center', backgroundRepeat: 'no-repeat', backgroundSize: '16px' }}
            >
              <option value="date-desc">Newest First</option>
              <option value="date-asc">Oldest First</option>
              <option value="name-asc">Alphabetical (A-Z)</option>
              <option value="name-desc">Alphabetical (Z-A)</option>
              <option value="size-desc">Largest Size First</option>
              <option value="size-asc">Smallest Size First</option>
            </select>
          </div>
        </div>
        </>
        )}

        {/* Breadcrumb */}
        <div className="flex items-center gap-1 overflow-x-auto rounded-xl border border-sd-border bg-sd-s1 px-5 py-3 shadow-sm scrollbar-none">
          <svg className="mr-2 h-4 w-4 flex-shrink-0 text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
          </svg>
          {breadcrumb.map((entry, i) => (
            <div key={i} className="flex flex-shrink-0 items-center gap-1.5">
              {i > 0 && <span className="text-sd-text3 mx-1 font-bold">/</span>}
              <button
                onClick={() => navigateTo(i)}
                className={`rounded-lg px-2 py-1 text-sm transition font-medium ${
                  i === breadcrumb.length - 1 ? "bg-sd-s2 text-blue-400 shadow-sm" : "text-sd-text2 hover:text-blue-400 hover:bg-sd-s2/50"
                }`}
              >
                {entry.name}
              </button>
            </div>
          ))}
        </div>
      </div>

      {filteredFiles.length === 0 ? (
        <div className="flex flex-col items-center justify-center stat-card rounded-3xl border border-sd-border shadow-sm py-28 text-center animate-fade-in">
          <div className="mb-6 flex h-16 w-16 items-center justify-center rounded-2xl border border-sd-border bg-sd-bg shadow-inner">
            <svg className="h-8 w-8 text-sd-text3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
            </svg>
          </div>
          <p className="text-lg font-bold text-sd-text">
            {search || filterAccount !== "all" || filterType !== "all"
              ? "No files found"
              : breadcrumb.length > 1
              ? "This folder is empty"
              : "Your StitchDrive is empty"}
          </p>
          <p className="mt-2 text-sm text-sd-text3 max-w-sm">
            {search || filterAccount !== "all" || filterType !== "all"
              ? "Try adjusting your filters or search terms."
              : breadcrumb.length > 1
              ? "Drag and drop files here to upload them into this folder."
              : "Upload files or connect more Google Drive accounts to get started."}
          </p>
          {!(search || filterAccount !== "all" || filterType !== "all") && (
             <button
                onClick={() => fileInputRef.current?.click()}
                className="btn-primary mt-6 rounded-xl px-6 py-2.5 text-sm font-semibold shadow-glow"
             >
                Upload Files
             </button>
          )}
        </div>
      ) : view === "grid" ? (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 animate-fade-in">
          {filteredFiles.map((file) => (
            <GridCard
              key={file.id}
              file={file}
              onOpen={openFolder}
              onRename={handleRename}
              onDelete={handleDelete}
              onMove={handleMove}
              onUploadInto={upload}
              inFolder={currentFolder.id !== null}
              onMoveToRoot={() => handleMove(file.id, "root")}
              onDragStartFile={handleDragStartFile}
              onShare={handleShare}
              onPreview={setPreviewFile}
              onMoveToAccount={setMoveToAccountFile}
              selectionMode={selectionMode}
              selected={selectedItems.has(file.id)}
              onSelectMode={() => {
                 setSelectionMode(true);
                 setSelectedItems(new Set([file.id]));
              }}
              onToggleSelect={() => handleToggleSelect(file.id)}
            />
          ))}
        </div>
      ) : (
        <div className="overflow-hidden stat-card rounded-2xl border border-sd-border shadow-sm animate-fade-in">
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="border-b border-sd-border bg-sd-bg/50">
                  <th className="px-5 py-3.5 text-xs font-bold uppercase tracking-widest text-sd-text3">Name</th>
                  <th className="hidden px-5 py-3.5 text-xs font-bold uppercase tracking-widest text-sd-text3 sm:table-cell">Size</th>
                  <th className="hidden px-5 py-3.5 text-xs font-bold uppercase tracking-widest text-sd-text3 md:table-cell">Account</th>
                  <th className="hidden px-5 py-3.5 text-xs font-bold uppercase tracking-widest text-sd-text3 md:table-cell">Modified</th>
                  <th className="px-5 py-3.5 text-right text-xs font-bold uppercase tracking-widest text-sd-text3">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredFiles.map((file) => (
                  <ListRow
                    key={file.id}
                    file={file}
                    onOpen={openFolder}
                    onRename={handleRename}
                    onDelete={handleDelete}
                    onMove={handleMove}
                    onUploadInto={upload}
                    inFolder={currentFolder.id !== null}
                    onMoveToRoot={() => handleMove(file.id, "root")}
                    onDragStartFile={handleDragStartFile}
                    onShare={handleShare}
                    onPreview={setPreviewFile}
                    onMoveToAccount={setMoveToAccountFile}
                    selectionMode={selectionMode}
                    selected={selectedItems.has(file.id)}
                    onSelectMode={() => {
                       setSelectionMode(true);
                       setSelectedItems(new Set([file.id]));
                    }}
                    onToggleSelect={() => handleToggleSelect(file.id)}
                  />
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
    </>
  );
}
