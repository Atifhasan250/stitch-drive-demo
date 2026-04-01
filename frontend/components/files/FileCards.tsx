import { useState, useRef, useEffect } from "react";
import type { FileItem } from "@/hooks/useFiles";
import { useUpload } from "@/contexts/UploadContext";
import { FileTypeIcon } from "./FileIcons";
import { downloadFileAuthenticated } from "@/lib/api";
import { useAuth } from "@clerk/nextjs";
import { AuthenticatedThumbnail } from "../AuthenticatedThumbnail";

import { formatBytes } from "@/lib/utils";

export function ActionsMenu({
  file,
  onRename,
  onDownload,
  onDelete,
  onShare,
  onPreview,
  onMoveToAccount,
  onSelectMode,
  inFolder,
  onMoveToRoot,
}: {
  file: FileItem;
  onRename: () => void;
  onDownload: () => void;
  onDelete: () => void;
  onShare: () => void;
  onPreview: () => void;
  onMoveToAccount: () => void;
  onSelectMode?: () => void;
  inFolder?: boolean;
  onMoveToRoot?: () => void;
}) {
  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const isFolder = file.mime_type === "application/vnd.google-apps.folder";

  useEffect(() => {
    if (!open) return;
    function handleClick(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [open]);

  function handleLocate() {
    const id = file.drive_file_id;
    const url = isFolder
      ? `https://drive.google.com/drive/folders/${id}`
      : `https://drive.google.com/file/d/${id}/view`;
    window.open(url, "_blank", "noopener,noreferrer");
    setOpen(false);
  }

  return (
    <div ref={menuRef} className="relative">
      <button
        onClick={(e) => { e.stopPropagation(); setOpen((v) => !v); }}
        className="flex h-8 w-8 items-center justify-center rounded-lg text-sd-text2 transition hover:bg-sd-s2 hover:text-sd-text"
        title="More actions"
      >
        <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 24 24">
          <circle cx="5" cy="12" r="1.5" />
          <circle cx="12" cy="12" r="1.5" />
          <circle cx="19" cy="12" r="1.5" />
        </svg>
      </button>

      {open && (
        <div className="absolute right-0 bottom-full mb-1 z-[100] min-w-[170px] rounded-xl border border-sd-border bg-sd-s1 py-1.5 shadow-card animate-fade-in origin-bottom-right">
          {!isFolder && (
            <button
              onClick={() => { onPreview(); setOpen(false); }}
              className="flex w-full items-center gap-3 px-4 py-2 text-xs font-medium text-sd-text2 transition hover:bg-sd-hover hover:text-sd-accent"
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 0 1 0-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.964-7.178Z" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" />
              </svg>
              Open File
            </button>
          )}
          <button
            onClick={() => { onRename(); setOpen(false); }}
            className="flex w-full items-center gap-3 px-4 py-2 text-xs font-medium text-sd-text2 transition hover:bg-sd-hover hover:text-sd-text"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="m16.862 4.487 1.687-1.688a1.875 1.875 0 1 1 2.652 2.652L10.582 16.07a4.5 4.5 0 0 1-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 0 1 1.13-1.897l8.932-8.931Zm0 0L19.5 7.125" />
            </svg>
            Rename
          </button>
          {onSelectMode && (
            <button
              onClick={() => { onSelectMode(); setOpen(false); }}
              className="flex w-full items-center gap-3 px-4 py-2 text-xs font-medium text-sd-text2 transition hover:bg-sd-hover hover:text-sd-text"
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                 <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              Select
            </button>
          )}
          {!isFolder && (
            <button
              onClick={() => { onDownload(); setOpen(false); }}
              className="flex w-full items-center gap-3 px-4 py-2 text-xs font-medium text-sd-text2 transition hover:bg-sd-hover hover:text-sd-text"
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12 12 16.5m0 0L7.5 12m4.5 4.5V3" />
              </svg>
              Download
            </button>
          )}
          <button
            onClick={() => { onShare(); setOpen(false); }}
            className="flex w-full items-center gap-3 px-4 py-2 text-xs font-medium text-sd-text2 transition hover:bg-sd-hover hover:text-sd-text"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M13.19 8.688a4.5 4.5 0 0 1 1.242 7.244l-4.5 4.5a4.5 4.5 0 0 1-6.364-6.364l1.757-1.757m13.35-.622 1.757-1.757a4.5 4.5 0 0 0-6.364-6.364l-4.5 4.5a4.5 4.5 0 0 0 1.242 7.244" />
            </svg>
            Share Link
          </button>
          <button
            onClick={handleLocate}
            className="flex w-full items-center gap-3 px-4 py-2 text-xs font-medium text-sd-text2 transition hover:bg-sd-hover hover:text-sd-text"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 6H5.25A2.25 2.25 0 0 0 3 8.25v10.5A2.25 2.25 0 0 0 5.25 21h10.5A2.25 2.25 0 0 0 18 18.75V10.5m-10.5 6L21 3m0 0h-5.25M21 3v5.25" />
            </svg>
            Locate in Drive
          </button>
          <button
            onClick={() => { onMoveToAccount(); setOpen(false); }}
            className="flex w-full items-center gap-3 px-4 py-2 text-xs font-medium text-sd-text2 transition hover:bg-sd-hover hover:text-sd-text"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M7.5 21 3 16.5m0 0L7.5 12M3 16.5h13.5m0-13.5L21 7.5m0 0L16.5 12M21 7.5H7.5" />
            </svg>
            Move to Account
          </button>
          {inFolder && onMoveToRoot && (
            <button
              onClick={() => { onMoveToRoot(); setOpen(false); }}
              className="flex w-full items-center gap-3 px-4 py-2 text-xs font-medium text-sd-text2 transition hover:bg-sd-hover hover:text-sd-text"
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 12l8.954-8.955c.44-.439 1.152-.439 1.591 0L21.75 12M4.5 9.75v10.125c0 .621.504 1.125 1.125 1.125H9.75v-4.875c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21h4.125c.621 0 1.125-.504 1.125-1.125V9.75M8.25 21h8.25" />
              </svg>
              Move to Root
            </button>
          )}
          <div className="my-1 border-t border-sd-border" />
          <button
            onClick={() => { onDelete(); setOpen(false); }}
            className="flex w-full items-center gap-3 px-4 py-2 text-xs font-medium text-rose-400 transition hover:bg-rose-500/10 hover:text-rose-300"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="m14.74 9-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
            </svg>
            Delete File
          </button>
        </div>
      )}
    </div>
  );
}

export function GridCard({
  file,
  onOpen,
  onRename,
  onDelete,
  onMove,
  onUploadInto,
  inFolder,
  onMoveToRoot,
  onDragStartFile,
  onShare,
  onPreview,
  selectionMode,
  selected,
  onMoveToAccount,
  onSelectMode,
  onToggleSelect,
}: {
  file: FileItem;
  onOpen: (file: FileItem) => void;
  onRename: (id: string, newName: string) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
  onMove: (fileId: string, targetFolderDriveId: string) => Promise<void>;
  onUploadInto: (file: File, parentFolderDriveId: string) => void;
  inFolder: boolean;
  onMoveToRoot: () => void;
  onDragStartFile?: (file: FileItem) => void;
  onShare: (file: FileItem) => void;
  onPreview: (file: FileItem) => void;
  onMoveToAccount: (file: FileItem) => void;
  selectionMode?: boolean;
  selected?: boolean;
  onSelectMode?: () => void;
  onToggleSelect?: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const [editName, setEditName] = useState(file.file_name);
  const [deleting, setDeleting] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const isFolder = file.mime_type === "application/vnd.google-apps.folder";
  const { confirm } = useUpload();
  const { getToken } = useAuth();

  async function commitRename() {
    const trimmed = editName.trim();
    if (trimmed && trimmed !== file.file_name) await onRename(file.id, trimmed);
    else setEditName(file.file_name);
    setEditing(false);
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter") commitRename();
    if (e.key === "Escape") { setEditName(file.file_name); setEditing(false); }
  }

  function handleDelete() {
    confirm(`Delete "${file.file_name}"?`, async () => {
      setDeleting(true);
      await onDelete(file.id);
    }, { confirmLabel: "Delete", danger: true });
  }

  async function handleDownload() {
    try {
      const token = await getToken();
      await downloadFileAuthenticated(file.id, file.file_name, token, {
        accountIndex: file.account_index,
        driveFileId: file.drive_file_id
      });
    } catch (err: any) {
      console.error("[Download] Error:", err);
    }
  }

  function handleDragStart(e: React.DragEvent) {
    e.dataTransfer.setData("application/x-drivecloud-file-id", String(file.id));
    e.dataTransfer.effectAllowed = "move";
    onDragStartFile?.(file);
  }

  function handleDragOver(e: React.DragEvent) {
    if (!isFolder) return;
    e.preventDefault();
    e.stopPropagation();
    e.nativeEvent.stopImmediatePropagation();
    e.dataTransfer.dropEffect = "move";
    setDragOver(true);
  }

  function handleDragLeave() {
    setDragOver(false);
  }

  async function handleDrop(e: React.DragEvent) {
    if (!isFolder) return;
    e.preventDefault();
    e.stopPropagation();
    e.nativeEvent.stopImmediatePropagation();
    setDragOver(false);

    const internalId = e.dataTransfer.getData("application/x-drivecloud-file-id");
    if (internalId) {
      await onMove(internalId, file.drive_file_id);
    } else {
      Array.from(e.dataTransfer.files).forEach((f: any) => onUploadInto(f, file.drive_file_id));
    }
  }

  return (
    <div
      draggable={!isFolder && !selectionMode}
      onDragStart={!selectionMode ? handleDragStart : undefined}
      onDragOver={!selectionMode ? handleDragOver : undefined}
      onDragLeave={!selectionMode ? handleDragLeave : undefined}
      onDrop={!selectionMode ? handleDrop : undefined}
      className={`stat-card file-card group flex flex-col justify-between rounded-2xl shadow-sm transition-all duration-300 ${deleting ? "opacity-50 grayscale transition-opacity" : ""} ${dragOver ? "border-blue-500 bg-blue-500/5 shadow-glow-sm" : ""} ${selected ? "ring-2 ring-blue-500 bg-blue-500/5 shadow-glow-sm" : ""} ${selectionMode ? "cursor-pointer" : ""}`}
      onClick={() => {
        if (selectionMode && onToggleSelect) onToggleSelect();
      }}
    >
      <div
        className={`thumbnail-area relative flex h-36 items-center justify-center overflow-hidden bg-sd-bg ${isFolder && !selectionMode ? "cursor-pointer" : ""}`}
        onClick={(e) => {
          if (selectionMode && onToggleSelect) {
            e.stopPropagation();
            onToggleSelect();
          } else if (isFolder) {
            onOpen(file);
          }
        }}
      >
        {selectionMode && (
          <div className="absolute left-3 top-3 z-20">
            <div className={`flex h-5 w-5 items-center justify-center rounded-full border shadow-md transition-all duration-200 ${selected ? "bg-blue-500 border-blue-500 text-white scale-110" : "border-sd-text3 bg-sd-bg/50 backdrop-blur-sm text-transparent"}`}>
              <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
              </svg>
            </div>
          </div>
        )}
        <span className="absolute right-3 top-3 flex items-center justify-center rounded-md border border-sd-border bg-sd-s1 px-1.5 py-0.5 text-[9px] font-bold text-sd-text3 z-10 shadow-sm top-layer">
          <span className="h-1 w-1 rounded-full bg-emerald-400 mr-1" />
          {file.account_index}
        </span>
        <div className={`thumbnail-area w-full flex justify-center transform transition duration-300 ${!selectionMode ? "group-hover:-translate-y-1 group-hover:scale-105" : ""}`}>
           {file.has_thumbnail ? (
             <div className="relative h-28 w-full overflow-hidden rounded-xl bg-sd-s1/50 shadow-inner group-hover:shadow-glow-sm transition-shadow duration-300">
               <AuthenticatedThumbnail
                 fileId={file.id}
                 mimeType={file.mime_type}
                 className="h-full w-full object-cover select-none"
               />
             </div>
           ) : (
             <FileTypeIcon mimeType={file.mime_type} size={52} />
           )}
        </div>
      </div>

      <div className="flex items-end justify-between gap-2 p-4 pt-3 border-t border-sd-border/50">
        <div className="min-w-0 flex-1">
          {editing ? (
            <input
              autoFocus
              value={editName}
              onChange={(e) => setEditName(e.target.value)}
              onBlur={commitRename}
              onKeyDown={handleKeyDown}
              className="w-full rounded-md border border-blue-500/50 bg-sd-bg px-2 py-1 text-xs text-sd-text font-semibold outline-none focus:ring-2 focus:ring-blue-500/20"
            />
          ) : (
            <p
              className={`truncate text-sm font-semibold leading-tight text-sd-text ${isFolder && !selectionMode ? "cursor-pointer hover:text-blue-400 transition" : ""}`}
              onClick={(e) => {
                if (selectionMode && onToggleSelect) {
                  e.stopPropagation();
                  onToggleSelect();
                } else if (isFolder) {
                  onOpen(file);
                }
              }}
              title={file.file_name}
            >
              {file.file_name}
            </p>
          )}
          <p className="mt-1 font-mono text-[10px] text-sd-text3">{isFolder ? "Folder" : formatBytes(file.size)}</p>
        </div>
        {!selectionMode && (
          <ActionsMenu file={file} onRename={() => setEditing(true)} onDownload={handleDownload} onDelete={handleDelete} onShare={() => onShare(file)} onPreview={() => onPreview(file)} onMoveToAccount={() => onMoveToAccount(file)} inFolder={inFolder} onMoveToRoot={onMoveToRoot} onSelectMode={onSelectMode} />
        )}
      </div>
    </div>
  );
}

export function ListRow({
  file,
  onOpen,
  onRename,
  onDelete,
  onMove,
  onUploadInto,
  inFolder,
  onMoveToRoot,
  onDragStartFile,
  onShare,
  onPreview,
  onMoveToAccount,
  onSelectMode,
  selectionMode,
  selected,
  onToggleSelect,
}: {
  file: FileItem;
  onOpen: (file: FileItem) => void;
  onRename: (id: string, newName: string) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
  onMove: (fileId: string, targetFolderDriveId: string) => Promise<void>;
  onUploadInto: (file: File, parentFolderDriveId: string) => void;
  inFolder: boolean;
  onMoveToRoot: () => void;
  onDragStartFile?: (file: FileItem) => void;
  onShare: (file: FileItem) => void;
  onPreview: (file: FileItem) => void;
  onMoveToAccount: (file: FileItem) => void;
  onSelectMode?: () => void;
  selectionMode?: boolean;
  selected?: boolean;
  onToggleSelect?: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const [editName, setEditName] = useState(file.file_name);
  const [deleting, setDeleting] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const isFolder = file.mime_type === "application/vnd.google-apps.folder";
  const { confirm } = useUpload();
  const { getToken } = useAuth();

  async function commitRename() {
    const trimmed = editName.trim();
    if (trimmed && trimmed !== file.file_name) await onRename(file.id, trimmed);
    else setEditName(file.file_name);
    setEditing(false);
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter") commitRename();
    if (e.key === "Escape") { setEditName(file.file_name); setEditing(false); }
  }

  function handleDelete() {
    confirm(`Delete "${file.file_name}"?`, async () => {
      setDeleting(true);
      await onDelete(file.id);
    }, { confirmLabel: "Delete", danger: true });
  }

  async function handleDownload() {
    try {
      const token = await getToken();
      await downloadFileAuthenticated(file.id, file.file_name, token, {
        accountIndex: file.account_index,
        driveFileId: file.drive_file_id
      });
    } catch (err: any) {
      console.error("[Download] Error:", err);
    }
  }

  function handleDragStart(e: React.DragEvent) {
    e.dataTransfer.setData("application/x-drivecloud-file-id", String(file.id));
    e.dataTransfer.effectAllowed = "move";
    onDragStartFile?.(file);
  }

  function handleDragOver(e: React.DragEvent) {
    if (!isFolder) return;
    e.preventDefault();
    e.stopPropagation();
    e.nativeEvent.stopImmediatePropagation();
    e.dataTransfer.dropEffect = "move";
    setDragOver(true);
  }

  function handleDragLeave() {
    setDragOver(false);
  }

  async function handleDrop(e: React.DragEvent) {
    if (!isFolder) return;
    e.preventDefault();
    e.stopPropagation();
    e.nativeEvent.stopImmediatePropagation();
    setDragOver(false);

    const internalId = e.dataTransfer.getData("application/x-drivecloud-file-id");
    if (internalId) {
      await onMove(internalId, file.drive_file_id);
    } else {
      Array.from(e.dataTransfer.files).forEach((f: any) => onUploadInto(f, file.drive_file_id));
    }
  }

  return (
    <tr
      draggable={!isFolder && !selectionMode}
      onDragStart={!selectionMode ? handleDragStart : undefined}
      onDragOver={!selectionMode ? handleDragOver : undefined}
      onDragLeave={!selectionMode ? handleDragLeave : undefined}
      onDrop={!selectionMode ? handleDrop : undefined}
      className={`group border-b border-sd-border transition-colors ${selectionMode ? "cursor-pointer" : ""} ${deleting ? "opacity-30" : ""} ${dragOver ? "bg-blue-500/10 shadow-inner" : "hover:bg-sd-s2/50"} ${selected ? "bg-blue-500/10 border-blue-500/30 shadow-inner" : ""} ${selectionMode && !selected ? "opacity-75" : ""}`}
      onClick={() => {
        if (selectionMode && onToggleSelect) {
          onToggleSelect();
        }
      }}
    >
      <td className="px-5 py-3.5 pr-2">
        <div className="flex items-center gap-4">
          {selectionMode && (
            <div className="flex-shrink-0">
              <div className={`flex h-5 w-5 items-center justify-center rounded-full border shadow-sm transition ${selected ? "bg-blue-500 border-blue-500 text-white" : "border-sd-border2 bg-sd-bg relative text-transparent"}`}>
                <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
                </svg>
              </div>
            </div>
          )}
          <div
            className={`thumbnail-area flex-shrink-0 transition-transform ${isFolder && !selectionMode ? "cursor-pointer group-hover:scale-105" : ""}`}
            onClick={(e) => {
              if (selectionMode && onToggleSelect) {
                e.stopPropagation();
                onToggleSelect();
              } else if (isFolder) {
                e.stopPropagation();
                onOpen(file);
              }
            }}
          >
            <FileTypeIcon mimeType={file.mime_type} size={32} />
          </div>
          {editing ? (
            <input autoFocus value={editName} onChange={(e) => setEditName(e.target.value)} onBlur={commitRename} onKeyDown={handleKeyDown} className="rounded-lg border border-blue-500/50 bg-sd-bg px-3 py-1 text-sm font-semibold text-sd-text outline-none focus:ring-2 focus:ring-blue-500/20" />
          ) : (
            <span
              className={`text-sm font-semibold text-sd-text truncate max-w-[200px] md:max-w-md ${isFolder && !selectionMode ? "cursor-pointer hover:text-blue-400 transition" : ""}`}
              onClick={(e) => {
                if (selectionMode && onToggleSelect) {
                  e.stopPropagation();
                  onToggleSelect();
                } else if (isFolder) {
                  e.stopPropagation();
                  onOpen(file);
                }
              }}
              title={file.file_name}
            >
              {file.file_name}
            </span>
          )}
        </div>
      </td>
      <td className="hidden px-5 py-3.5 text-xs font-mono text-sd-text3 sm:table-cell">{isFolder ? "—" : formatBytes(file.size)}</td>
      <td className="hidden px-5 py-3.5 md:table-cell">
        <span className="inline-flex items-center gap-1.5 rounded-md border border-sd-border bg-sd-bg px-2 py-1 text-[10px] font-bold text-sd-text3">
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
          {file.account_index}
        </span>
      </td>
      <td className="hidden px-5 py-3.5 text-xs font-medium text-sd-text3 md:table-cell">{new Date(file.created_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}</td>
      <td className="px-5 py-3.5 text-right">
        <div className="flex justify-end pr-2">
          <ActionsMenu file={file} onRename={() => setEditing(true)} onDownload={handleDownload} onDelete={handleDelete} onShare={() => onShare(file)} onPreview={() => onPreview(file)} onMoveToAccount={() => onMoveToAccount(file)} inFolder={inFolder} onMoveToRoot={onMoveToRoot} onSelectMode={onSelectMode} />
        </div>
      </td>
    </tr>
  );
}
