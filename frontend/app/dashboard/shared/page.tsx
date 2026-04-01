"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useAuth } from "@clerk/nextjs";
import { authenticatedFetch, downloadFileAuthenticated, fetchMediaBlobUrl } from "@/lib/api";

type SharedFile = {
  drive_file_id: string;
  file_name: string;
  account_index: number;
  size: number;
  mime_type: string | null;
  created_at: string;
  shared_by: string | null;
};

type FolderEntry = {
  drive_file_id: string;
  file_name: string;
  account_index: number;
};

type SortKey = "name" | "size" | "date";

import { formatBytes } from "@/lib/utils";

function FileTypeIcon({ mimeType, size = 28 }: { mimeType: string | null; size?: number }) {
  const t = mimeType ?? "";
  if (t === "application/vnd.google-apps.folder") {
    return (
      <svg width={size} height={size} viewBox="0 0 48 48" fill="none">
        <rect x="4" y="14" width="40" height="26" rx="4" fill="#f59e0b" />
        <path d="M4 14h14l4 -5h2v5" fill="#f59e0b" />
        <rect x="4" y="20" width="40" height="20" rx="4" fill="#fbbf24" />
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

export default function SharedPage() {
  const { getToken } = useAuth();
  const [files, setFiles] = useState<SharedFile[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [view, setView] = useState<"grid" | "list">("grid");
  const [sortBy, setSortBy] = useState<SortKey>("date");
  const [folderStack, setFolderStack] = useState<FolderEntry[]>([]);

  const currentFolder = folderStack.length > 0 ? folderStack[folderStack.length - 1] : null;

  const fetchFiles = useCallback(async (folder: FolderEntry | null) => {
    setLoading(true);
    setSearch("");
    try {
      const token = await getToken();
      const url = folder
        ? `/api/files/shared/${folder.account_index}/${folder.drive_file_id}/children`
        : "/api/files/shared";
      const res = await authenticatedFetch(url, token);
      if (res.ok) setFiles(await res.json());
    } catch {}
    setLoading(false);
  }, []);

  useEffect(() => { fetchFiles(currentFolder); }, [folderStack, fetchFiles]); // eslint-disable-line react-hooks/exhaustive-deps

  function openFolder(file: SharedFile) {
    setFolderStack((prev) => [
      ...prev,
      { drive_file_id: file.drive_file_id, file_name: file.file_name, account_index: file.account_index },
    ]);
  }

  function navigateTo(index: number) {
    if (index < 0) setFolderStack([]);
    else setFolderStack((prev) => prev.slice(0, index + 1));
  }

  async function handleDownload(file: SharedFile) {
    try {
      const token = await getToken();
      await downloadFileAuthenticated(file.drive_file_id, file.file_name, token, {
        accountIndex: file.account_index,
        driveFileId: file.drive_file_id,
        customPath: `/api/files/shared/${file.account_index}/${file.drive_file_id}/download`
      });
    } catch (err: any) {
      alert("Download failed: " + err.message);
    }
  }

  async function handlePreview(file: SharedFile) {
    try {
      const token = await getToken();
      const path = `/api/files/shared/${file.account_index}/${file.drive_file_id}/download`; // Shared preview is basically same as download stream
      const url = await fetchMediaBlobUrl(path, token, {
        accountIndex: file.account_index,
        driveFileId: file.drive_file_id,
      });
      window.open(url, "_blank");
    } catch (err: any) {
      alert("Preview failed: " + err.message);
    }
  }

  const isFolder = (f: SharedFile) => f.mime_type === "application/vnd.google-apps.folder";

  const filtered = useMemo(() => {
    let result = files.filter((f) => f.file_name.toLowerCase().includes(search.toLowerCase()));
    return [...result].sort((a, b) => {
      const aFolder = isFolder(a), bFolder = isFolder(b);
      if (aFolder !== bFolder) return aFolder ? -1 : 1;
      if (sortBy === "name") return a.file_name.localeCompare(b.file_name);
      if (sortBy === "size") return b.size - a.size;
      return (b.created_at ?? "").localeCompare(a.created_at ?? "");
    });
  }, [files, search, sortBy]);

  return (
    <div className="space-y-6 animate-fade-up">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl text-sd-text">Shared with me</h1>
          <p className="mt-1 text-sm font-medium text-sd-text2 flex items-center gap-2">
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
                {filtered.length === 1 ? "item" : "items"} inside
              </>
            )}
          </p>
        </div>
        <button
          onClick={() => fetchFiles(currentFolder)}
          disabled={loading}
          className="flex items-center gap-1.5 rounded-xl border border-sd-border bg-sd-s1 px-4 py-2 text-xs font-semibold text-sd-text2 transition hover:bg-sd-s2 hover:text-sd-text hover:border-sd-accent/30 shadow-sm disabled:opacity-50"
        >
          <svg className={`h-4 w-4 ${loading ? "animate-spin text-sd-accent" : ""}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0 3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182m0-4.991v4.99" />
          </svg>
          {loading ? "Refreshing" : "Refresh"}
        </button>
      </div>

      {/* Path bar */}
      <div className="flex items-center gap-1.5 text-xs text-sd-text3 bg-sd-s1 border border-sd-border px-4 py-2.5 rounded-xl shadow-sm overflow-x-auto scrollbar-none">
        <button onClick={() => navigateTo(-1)} className={`transition hover:text-sd-text whitespace-nowrap ${folderStack.length === 0 ? "font-semibold text-sd-text" : "font-medium"}`}>
          <div className="flex items-center gap-1.5">
            <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="m2.25 12 8.954-8.955c.44-.439 1.152-.439 1.591 0L21.75 12M4.5 9.75v10.125c0 .621.504 1.125 1.125 1.125H9.75v-4.875c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21h4.125c.621 0 1.125-.504 1.125-1.125V9.75M8.25 21h8.25" />
            </svg>
            Root
          </div>
        </button>
        {folderStack.map((entry, i) => (
          <span key={entry.drive_file_id} className="flex items-center gap-1.5 whitespace-nowrap">
            <svg className="h-3.5 w-3.5 flex-shrink-0 opacity-40" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="m8.25 4.5 7.5 7.5-7.5 7.5" />
            </svg>
            <button
              onClick={() => navigateTo(i)}
              className={`max-w-[160px] truncate transition hover:text-sd-text line-clamp-1 ${i === folderStack.length - 1 ? "font-semibold text-sd-text" : "font-medium"}`}
              title={entry.file_name}
            >
              {entry.file_name}
            </button>
          </span>
        ))}
      </div>

      {/* Toolbar */}
      <div className="flex items-center gap-3">
        <div className="relative flex-1">
          <svg className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-sd-text3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z" />
          </svg>
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search shared files…"
            className="w-full rounded-xl border border-sd-border bg-sd-s1 py-2.5 pl-10 pr-4 text-sm font-medium text-sd-text placeholder-sd-text3 outline-none focus:border-sd-accent/50 focus:ring-2 focus:ring-sd-accent/10 transition shadow-sm"
          />
        </div>

        <select
          value={sortBy}
          onChange={(e) => setSortBy(e.target.value as SortKey)}
          className="rounded-xl border border-sd-border bg-sd-s1 py-2.5 pl-4 pr-10 text-sm font-medium text-sd-text2 outline-none focus:border-sd-accent/50 focus:ring-2 focus:ring-sd-accent/10 transition shadow-sm appearance-none cursor-pointer"
          style={{ backgroundImage: `url("data:image/svg+xml,%3csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 20 20'%3e%3cpath stroke='%236b82ab' stroke-linecap='round' stroke-linejoin='round' stroke-width='1.5' d='M6 8l4 4 4-4'/%3e%3c/svg%3e")`, backgroundPosition: 'right 0.5rem center', backgroundRepeat: 'no-repeat', backgroundSize: '1.5em 1.5em' }}
        >
          <option value="date">Date</option>
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
              <path strokeLinecap="round" strokeLinejoin="round" d="M7.217 10.907a2.25 2.25 0 1 0 0 2.186m0-2.186c.18.324.283.696.283 1.093s-.103.77-.283 1.093m0-2.186 9.566-5.314m-9.566 7.5 9.566 5.314m0 0a2.25 2.25 0 1 0 3.935 2.186 2.25 2.25 0 0 0-3.935-2.186Zm0-12.814a2.25 2.25 0 1 0 3.933-2.185 2.25 2.25 0 0 0-3.933 2.185Z" />
            </svg>
          </div>
          <p className="font-display tracking-wide text-lg text-sd-text mb-1">
            {search ? "No matching files" : currentFolder ? "Empty folder" : "Nothing shared yet"}
          </p>
          <p className="text-sm font-medium text-sd-text3 max-w-sm">
            {search ? "Try adjusting your search terms." : currentFolder ? "There are no subfolders or files here." : "Files shared with your connected accounts will appear here automatically."}
          </p>
        </div>
      ) : view === "grid" ? (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
          {filtered.map((file) => {
            const key = `${file.account_index}-${file.drive_file_id}`;
            const folder = isFolder(file);
            return (
              <div
                key={key}
                className={`file-card group relative flex flex-col items-center gap-3 rounded-2xl p-4 transition-all duration-300 ${folder ? "cursor-pointer" : ""}`}
                onClick={folder ? () => openFolder(file) : undefined}
              >
                <span className="absolute right-3 top-3 flex items-center justify-center rounded-md border border-sd-border bg-sd-bg px-1.5 py-0.5 text-[9px] font-bold text-sd-text3 z-10">
                  <span className="h-1 w-1 rounded-full bg-emerald-400 mr-1" />
                  {file.account_index}
                </span>
                
                <div className="mt-4 mb-2 relative transform transition duration-300 group-hover:-translate-y-1 group-hover:scale-105">
                  <div className="absolute inset-0 bg-sd-accent/10 blur-xl rounded-full scale-150 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none" />
                  <div className="relative z-10"><FileTypeIcon mimeType={file.mime_type} size={48} /></div>
                </div>
                
                <div className="w-full mt-auto">
                  <span className="line-clamp-2 w-full text-center text-xs font-semibold text-sd-text leading-tight" title={file.file_name}>
                    {file.file_name}
                  </span>
                  {file.shared_by && (
                    <span className="mt-1.5 block truncate w-full text-center text-[10px] font-medium text-sd-text3" title={file.shared_by}>
                      by {file.shared_by}
                    </span>
                  )}
                </div>

                {!folder && (
                  <div className="absolute inset-x-0 bottom-0 top-0 rounded-2xl flex items-center justify-center bg-sd-bg/80 backdrop-blur-sm opacity-0 transition group-hover:opacity-100 gap-2" onClick={(e) => e.stopPropagation()}>
                    <button
                      onClick={() => handleDownload(file)}
                      className="btn-primary flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-[11px] font-semibold"
                      title="Download"
                    >
                      <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12 12 16.5m0 0L7.5 12m4.5 4.5V3" />
                      </svg>
                      Download
                    </button>
                    {file.mime_type?.startsWith("image/") && (
                      <button
                        onClick={() => handlePreview(file)}
                        className="rounded-lg bg-sd-s2 hover:bg-sd-s3 p-1.5 text-sd-text transition border border-sd-border"
                        title="Preview"
                      >
                        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                           <path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 0 1 0-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178Z" />
                           <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" />
                        </svg>
                      </button>
                    )}
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
                <th className="hidden px-5 py-3.5 text-left text-[10px] font-bold uppercase tracking-widest text-sd-text3 sm:table-cell">Shared by</th>
                <th className="hidden px-5 py-3.5 text-left text-[10px] font-bold uppercase tracking-widest text-sd-text3 sm:table-cell">Size</th>
                <th className="hidden px-5 py-3.5 text-left text-[10px] font-bold uppercase tracking-widest text-sd-text3 md:table-cell">Account</th>
                <th className="hidden px-5 py-3.5 text-left text-[10px] font-bold uppercase tracking-widest text-sd-text3 md:table-cell">Date</th>
                <th className="px-5 py-3.5 text-right text-[10px] font-bold uppercase tracking-widest text-sd-text3 w-20">Download</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((file) => {
                const key = `${file.account_index}-${file.drive_file_id}`;
                const folder = isFolder(file);
                return (
                  <tr key={key} className="border-b border-sd-border last:border-0 hover:bg-sd-s2/50 transition-colors">
                    <td className="px-5 py-3.5 pr-2">
                      <div className={`flex items-center gap-4 ${folder ? "cursor-pointer group" : ""}`} onClick={folder ? () => openFolder(file) : undefined}>
                        <div className={`flex-shrink-0 transition-transform ${folder ? "group-hover:scale-110" : ""}`}>
                          <FileTypeIcon mimeType={file.mime_type} size={28} />
                        </div>
                        <span className={`text-sm font-semibold truncate ${folder ? "text-sd-text group-hover:text-sd-accent transition-colors" : "text-sd-text"}`} title={file.file_name}>{file.file_name}</span>
                      </div>
                    </td>
                    <td className="hidden px-5 py-3.5 text-xs font-medium text-sd-text2 sm:table-cell">{file.shared_by ?? "—"}</td>
                    <td className="hidden px-5 py-3.5 text-xs font-mono text-sd-text3 sm:table-cell">{folder ? "—" : formatBytes(file.size)}</td>
                    <td className="hidden px-5 py-3.5 md:table-cell">
                      <span className="inline-flex items-center gap-1.5 rounded-md border border-sd-border bg-sd-bg px-2 py-1 text-[10px] font-bold text-sd-text3">
                        <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
                        {file.account_index}
                      </span>
                    </td>
                    <td className="hidden px-5 py-3.5 text-xs font-medium text-sd-text3 md:table-cell whitespace-nowrap">
                      {file.created_at ? new Date(file.created_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' }) : "—"}
                    </td>
                    <td className="px-5 py-3.5 text-right">
                      {!folder && (
                        <div className="flex items-center justify-end gap-2">
                           {file.mime_type?.startsWith("image/") && (
                             <button
                               onClick={() => handlePreview(file)}
                               className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-sd-text3 transition hover:bg-sd-accent/10 hover:text-sd-accent border border-transparent hover:border-sd-accent/20"
                               title="Preview"
                             >
                                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                   <path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 0 1 0-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178Z" />
                                   <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" />
                                </svg>
                             </button>
                           )}
                           <button
                             onClick={() => handleDownload(file)}
                             className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-sd-text3 transition hover:bg-sd-accent/10 hover:text-sd-accent shadow-sm border border-transparent hover:border-sd-accent/20"
                             title="Download"
                           >
                             <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                               <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12 12 16.5m0 0L7.5 12m4.5 4.5V3" />
                             </svg>
                           </button>
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
