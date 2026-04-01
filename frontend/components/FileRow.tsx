"use client";

import { useState } from "react";
import { useAuth } from "@clerk/nextjs";
import { downloadFileAuthenticated, fetchMediaBlobUrl } from "@/lib/api";
import { AuthenticatedThumbnail } from "./AuthenticatedThumbnail";

export type FileItem = {
  id: string; // Changed from number to string to match backend ObjectId
  file_name: string;
  drive_file_id: string;
  account_index: number;
  size: number;
  mime_type: string | null;
  has_thumbnail: boolean;
  created_at: string;
};

import { formatBytes } from "@/lib/utils";

export function FileTypeIcon({ mimeType }: { mimeType: string | null }) {
  const type = mimeType ?? "";

  if (type === "application/vnd.google-apps.folder") {
    return (
      <svg className="h-8 w-8 text-yellow-400" fill="currentColor" viewBox="0 0 24 24">
        <path d="M10 4H4c-1.11 0-2 .89-2 2v12c0 1.11.89 2 2 2h16c1.11 0 2-.89 2-2V8c0-1.11-.89-2-2-2h-8l-2-2z" />
      </svg>
    );
  }

  const configs: Record<string, { bg: string; text: string; label: string }> = {
    "image/": { bg: "bg-purple-500/10", text: "text-purple-400", label: "IMG" },
    "video/": { bg: "bg-blue-500/10", text: "text-blue-400", label: "VID" },
    "audio/": { bg: "bg-pink-500/10", text: "text-pink-400", label: "AUD" },
    "pdf": { bg: "bg-red-500/10", text: "text-red-400", label: "PDF" },
    "zip": { bg: "bg-orange-500/10", text: "text-orange-400", label: "ZIP" },
    "compressed": { bg: "bg-orange-500/10", text: "text-orange-400", label: "ZIP" },
    "spreadsheet": { bg: "bg-emerald-500/10", text: "text-emerald-400", label: "XLS" },
    "sheet": { bg: "bg-emerald-500/10", text: "text-emerald-400", label: "XLS" },
    "presentation": { bg: "bg-orange-500/10", text: "text-orange-400", label: "PPT" },
    "slide": { bg: "bg-orange-500/10", text: "text-orange-400", label: "PPT" },
    "document": { bg: "bg-sky-500/10", text: "text-sky-400", label: "DOC" },
    "text/": { bg: "bg-sky-500/10", text: "text-sky-400", label: "TXT" },
  };

  let bg = "bg-[#21212b]";
  let text = "text-[#8888a4]";
  let label = "FILE";

  for (const [key, val] of Object.entries(configs)) {
    if (type.startsWith(key) || type.includes(key)) {
      bg = val.bg; text = val.text; label = val.label; break;
    }
  }

  return (
    <div className={`flex h-8 w-8 items-center justify-center rounded-lg text-[9px] font-bold ${bg} ${text}`}>
      {label}
    </div>
  );
}

export default function FileRow({
  file,
  onRename,
  onDelete,
}: {
  file: FileItem;
  onRename: (id: string, newName: string) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
}) {
  const { getToken } = useAuth();
  const [editing, setEditing] = useState(false);
  const [editName, setEditName] = useState(file.file_name);
  const [deleting, setDeleting] = useState(false);

  async function commitRename() {
    const trimmed = editName.trim();
    if (trimmed && trimmed !== file.file_name) {
      await onRename(file.id, trimmed);
    } else {
      setEditName(file.file_name);
    }
    setEditing(false);
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter") commitRename();
    if (e.key === "Escape") { setEditName(file.file_name); setEditing(false); }
  }

  async function handleDelete() {
    if (!confirm(`Delete "${file.file_name}"?`)) return;
    setDeleting(true);
    await onDelete(file.id);
  }

  async function handleDownload() {
    try {
      const token = await getToken();
      await downloadFileAuthenticated(file.id, file.file_name, token, {
        accountIndex: file.account_index,
        driveFileId: file.drive_file_id,
      });
    } catch (err: any) {
      alert("Download failed: " + err.message);
    }
  }

  async function handlePreview() {
    try {
      const token = await getToken();
      const url = await fetchMediaBlobUrl(`/api/files/${file.id}/view`, token, {
        accountIndex: file.account_index,
        driveFileId: file.drive_file_id,
      });
      window.open(url, "_blank");
      // Note: We're opening in a new tab, so we can't easily revoke the URL here without breaking the tab.
      // In a real app, we'd use a modal previewer.
    } catch (err: any) {
      alert("Preview failed: " + err.message);
    }
  }

  return (
    <tr className={`border-b border-[#21212b] transition hover:bg-[#18181e] ${deleting ? "opacity-40" : ""}`}>
      <td className="px-4 py-3">
        <div className="flex items-center gap-3">
          {file.has_thumbnail ? (
            <AuthenticatedThumbnail
              fileId={file.id}
              mimeType={file.mime_type}
            />
          ) : (
            <FileTypeIcon mimeType={file.mime_type} />
          )}
          {editing ? (
            <input
              autoFocus
              value={editName}
              onChange={(e) => setEditName(e.target.value)}
              onBlur={commitRename}
              onKeyDown={handleKeyDown}
              className="rounded-lg border border-indigo-500/50 bg-[#0c0c10] px-2 py-0.5 text-sm text-white outline-none focus:ring-1 focus:ring-indigo-500/30"
            />
          ) : (
            <span
              className="cursor-text truncate text-sm text-[#e8e8f0] hover:text-indigo-400 transition-colors"
              onClick={() => setEditing(true)}
              title="Click to rename"
            >
              {file.file_name}
            </span>
          )}
        </div>
      </td>
      <td className="px-4 py-3 text-sm text-[#555568]">{formatBytes(file.size)}</td>
      <td className="px-4 py-3">
        <span className="rounded-md border border-[#21212b] px-2 py-0.5 text-xs text-[#555568]">
          #{file.account_index}
        </span>
      </td>
      <td className="px-4 py-3 text-sm text-[#555568]">
        {new Date(file.created_at).toLocaleDateString()}
      </td>
      <td className="px-4 py-3">
        <div className="flex items-center gap-1">
          <button
            onClick={handleDownload}
            className="rounded-lg p-1.5 text-[#555568] transition hover:bg-[#21212b] hover:text-indigo-400"
            title="Download"
          >
            <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5M16.5 12 12 16.5m0 0L7.5 12m4.5 4.5V3" />
            </svg>
          </button>
          
          {file.mime_type?.startsWith("image/") && (
            <button
              onClick={handlePreview}
              className="rounded-lg p-1.5 text-[#555568] transition hover:bg-[#21212b] hover:text-purple-400"
              title="Preview Image"
            >
              <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 0 1 0-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178Z" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" />
              </svg>
            </button>
          )}

          <button
            onClick={() => window.open(`https://drive.google.com/open?id=${file.drive_file_id}`, "_blank")}
            className="rounded-lg p-1.5 text-[#555568] transition hover:bg-[#21212b] hover:text-blue-400"
            title="Locate in Drive"
          >
            <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 6H5.25A2.25 2.25 0 0 0 3 8.25v10.5A2.25 2.25 0 0 0 5.25 21h10.5A2.25 2.25 0 0 0 18 18.75V10.5m-10.5 6L21 3m0 0h-5.25M21 3v5.25" />
            </svg>
          </button>
          <button
            onClick={handleDelete}
            disabled={deleting}
            className="rounded-lg p-1.5 text-[#555568] transition hover:bg-[#21212b] hover:text-red-400 disabled:opacity-40"
            title="Delete"
          >
            <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="m14.74 9-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 0 1-2.244 2.077H8.084a2.25 2.25 0 0 1-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 0 0-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 0 1 3.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 0 0-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 0 0-7.5 0" />
            </svg>
          </button>
        </div>
      </td>
    </tr>
  );
}
