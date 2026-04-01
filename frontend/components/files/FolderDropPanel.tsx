import { useRef, useState, useEffect } from "react";
import type { FileItem } from "@/hooks/useFiles";

type BreadcrumbEntry = { id: string | null; name: string };

export function FolderDropPanel({
  draggedFile,
  folders,
  onDrop,
}: {
  draggedFile: FileItem;
  folders: FileItem[];
  onDrop: (targetDriveId: string) => void;
}) {
  const listRef = useRef<HTMLDivElement>(null);
  const scrollRafRef = useRef<number | null>(null);
  const [dropTarget, setDropTarget] = useState<string | null>(null);

  function stopScroll() {
    if (scrollRafRef.current !== null) {
      cancelAnimationFrame(scrollRafRef.current);
      scrollRafRef.current = null;
    }
  }

  function handleDragOver(e: React.DragEvent) {
    e.preventDefault();
    stopScroll();
    const list = listRef.current;
    if (!list) return;
    const rect = list.getBoundingClientRect();
    const y = e.clientY - rect.top;
    const ZONE = 64;
    if (y < ZONE) {
      const speed = Math.max(3, Math.round(((ZONE - y) / ZONE) * 12));
      const scroll = () => { list.scrollTop -= speed; scrollRafRef.current = requestAnimationFrame(scroll); };
      scrollRafRef.current = requestAnimationFrame(scroll);
    } else if (y > rect.height - ZONE) {
      const speed = Math.max(3, Math.round(((y - (rect.height - ZONE)) / ZONE) * 12));
      const scroll = () => { list.scrollTop += speed; scrollRafRef.current = requestAnimationFrame(scroll); };
      scrollRafRef.current = requestAnimationFrame(scroll);
    }
  }

  function handleDragLeave() {
    stopScroll();
  }

  useEffect(() => () => stopScroll(), []);

  function renderFolderItem(driveId: string, name: string) {
    const isOver = dropTarget === driveId;
    return (
      <div
        key={driveId}
        onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); setDropTarget(driveId); }}
        onDragLeave={() => setDropTarget(null)}
        onDrop={(e) => { e.preventDefault(); e.stopPropagation(); setDropTarget(null); onDrop(driveId); }}
        className={`flex cursor-pointer items-center gap-3 rounded-xl border px-3 py-2.5 transition ${
          isOver ? "border-blue-500 btn-primary/10 shadow-glow-sm" : "border-sd-border bg-sd-s1 hover:border-blue-500/30 hover:bg-sd-hover"
        }`}
      >
        <svg width={20} height={20} viewBox="0 0 48 48" fill="none" className="flex-shrink-0">
          <defs>
            <linearGradient id="fp-back" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#f59e0b" />
              <stop offset="100%" stopColor="#d97706" />
            </linearGradient>
            <linearGradient id="fp-front" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#fde68a" />
              <stop offset="100%" stopColor="#fbbf24" />
            </linearGradient>
          </defs>
          <rect x="4" y="14" width="40" height="26" rx="3" fill="url(#fp-back)" />
          <path d="M4 14h14l4 -5h2v5" fill="url(#fp-back)" />
          <rect x="4" y="20" width="40" height="20" rx="3" fill="url(#fp-front)" />
        </svg>
        <span className="truncate text-xs text-sd-text" title={name}>{name}</span>
        {isOver && (
          <svg className="ml-auto h-3.5 w-3.5 flex-shrink-0 text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0 4.5 4.5M12 3v13.5" />
          </svg>
        )}
      </div>
    );
  }

  return (
    <div className="pointer-events-auto fixed right-0 top-0 z-40 flex h-full w-72 flex-col border-l border-sd-border bg-sd-s1 shadow-2xl animate-slide-in-right">
      <div className="flex items-center justify-between border-b border-sd-border px-4 py-4 bg-sd-bg/50 backdrop-blur-md">
        <div>
          <p className="text-sm font-semibold text-sd-text">Move to folder</p>
          <p className="mt-0.5 truncate text-[11px] text-sd-text3" title={draggedFile.file_name}>
            {draggedFile.file_name} <span className="text-emerald-400">· #{draggedFile.account_index}</span>
          </p>
        </div>
        <div className="flex h-8 w-8 items-center justify-center rounded-lg border border-sd-border bg-sd-bg shadow-sm">
          <svg className="h-4 w-4 text-sd-text2" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0 4.5 4.5M12 3v13.5" />
          </svg>
        </div>
      </div>

      <div
        ref={listRef}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        className="flex-1 overflow-y-auto p-4 scrollbar-none"
      >
        <div className="mb-4 space-y-2">
          <p className="px-1 text-[10px] font-bold uppercase tracking-widest text-sd-text3">Root</p>
          {renderFolderItem("root", "My Drive (root)")}
        </div>

        {folders.length > 0 && (
          <div className="mt-6 space-y-2">
            <p className="px-1 text-[10px] font-bold uppercase tracking-widest text-sd-text3 flex justify-between">
              Folders <span>{folders.length}</span>
            </p>
            {folders.map((f) => renderFolderItem(f.drive_file_id, f.file_name))}
          </div>
        )}

        {folders.length === 0 && (
          <div className="mt-12 flex flex-col items-center gap-3 text-center border border-dashed border-sd-border rounded-xl p-6">
            <svg className="h-8 w-8 text-sd-text3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
            </svg>
            <p className="text-xs font-medium text-sd-text3">No other folders on this account</p>
          </div>
        )}
      </div>

      <div className="border-t border-sd-border px-5 py-4 bg-sd-bg/50 backdrop-blur-md">
        <p className="text-[11px] font-medium text-sd-text3 text-center flex items-center justify-center gap-2">
          <span className="h-2 w-2 rounded-full bg-blue-500 animate-pulse" />
          Drop file onto a folder to move it
        </p>
      </div>
    </div>
  );
}
