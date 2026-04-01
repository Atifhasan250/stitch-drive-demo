"use client";

import { useAuth } from "@clerk/nextjs";
import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { authenticatedFetch } from "@/lib/api";

type Snack = { id: number; name: string; progress: number; status: "uploading" | "done" | "error" };
type Toast = { id: number; message: string; type: "loading" | "success" | "error" };
type ConfirmState = { message: string; description?: string; confirmLabel: string; danger: boolean; onConfirm: () => void };

interface UploadCtx {
  upload: (file: File | Blob, parentFolderDriveId?: string | null, targetAccountIndex?: number | null) => void;
  addCompleteListener: (fn: () => void) => () => void;
  setCurrentFolder: (folderId: string | null, folderName?: string | null) => void;
  toast: (message: string, type: "loading" | "success" | "error") => number;
  updateToast: (id: number, type: "success" | "error", message: string) => void;
  confirm: (message: string, onConfirm: () => void, opts?: { description?: string; confirmLabel?: string; danger?: boolean }) => void;
  moveFile: (file: any, targetAccountIndex: number) => void;
}

const UploadContext = createContext<UploadCtx>({
  upload: () => {},
  addCompleteListener: () => () => {},
  setCurrentFolder: () => {},
  toast: () => 0,
  updateToast: () => {},
  confirm: () => {},
  moveFile: () => {},
} as UploadCtx);

export function UploadProvider({ children }: { children: React.ReactNode }) {
  const { getToken } = useAuth();
  const [snacks, setSnacks] = useState<Snack[]>([]);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [confirmState, setConfirmState] = useState<ConfirmState | null>(null);
  const [dragging, setDragging] = useState(false);
  const [isManagerMinimized, setIsManagerMinimized] = useState(false);
  
  const idRef = useRef(0);
  const listeners = useRef<Set<() => void>>(new Set());
  const dragCounter = useRef(0);
  const currentFolderRef = useRef<string | null>(null);
  const currentFolderNameRef = useRef<string | null>(null);

  function addCompleteListener(fn: () => void) {
    listeners.current.add(fn);
    return () => listeners.current.delete(fn);
  }

  function setCurrentFolder(folderId: string | null, folderName?: string | null) {
    currentFolderRef.current = folderId;
    currentFolderNameRef.current = folderName ?? null;
  }

  const toast = useCallback((message: string, type: "loading" | "success" | "error"): number => {
    const id = ++idRef.current;
    setToasts((t) => [...t, { id, message, type }]);
    if (type !== "loading") {
      setTimeout(() => setToasts((t) => t.filter((item) => item.id !== id)), type === "error" ? 5000 : 3000);
    }
    return id;
  }, []);

  const updateToast = useCallback((id: number, type: "success" | "error", message: string) => {
    setToasts((t) => t.map((item) => (item.id === id ? { ...item, type, message } : item)));
    setTimeout(() => setToasts((t) => t.filter((item) => item.id !== id)), type === "error" ? 5000 : 3000);
  }, []);

  const confirm = useCallback((
    message: string,
    onConfirm: () => void,
    opts?: { description?: string; confirmLabel?: string; danger?: boolean },
  ) => {
    setConfirmState({
      message,
      description: opts?.description,
      confirmLabel: opts?.confirmLabel ?? "Confirm",
      danger: opts?.danger ?? false,
      onConfirm,
    });
  }, []);

  const upload = useCallback(async (file: File | Blob, parentFolderDriveId?: string | null, targetAccountIndex?: number | null) => {
    const id = ++idRef.current;
    const fileName = (file as File).name || "blob-file-" + id;
    const fileType = (file as File).type || "application/octet-stream";
    
    // Auto maximize manager if it was minimized upon new upload
    setIsManagerMinimized(false);
    
    setSnacks((s) => [...s, { id, name: fileName, progress: 0, status: "uploading" }]);

    try {
      const parentId = parentFolderDriveId !== undefined ? parentFolderDriveId : currentFolderRef.current;
      const token = await getToken();
      
      // Step 1: Initiate upload session with backend
        const creds = localStorage.getItem("credentials");
        const initRes = await fetch("/api/files/upload/initiate", {
          method: "POST",
          headers: { 
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
            ...(creds ? { "X-Credentials": creds } : {})
          },
        body: JSON.stringify({
          fileName,
          mimeType: fileType,
          parentFolderId: parentId,
          accountIndex: targetAccountIndex,
        }),
      });

      if (!initRes.ok) {
        const errorData = await initRes.json().catch(() => ({ detail: "Unknown initiation error" }));
        throw new Error(errorData.detail || "Failed to initiate upload session");
      }
      const { sessionUrl, accountIndex } = await initRes.json();
      const fileSize = file.size;
      const CHUNK_SIZE = 5 * 1024 * 1024; // 5MB chunks
      let start = 0;
      let driveFileId = "";

      while (start < fileSize) {
        const end = Math.min(start + CHUNK_SIZE, fileSize);
        const chunk = file.slice(start, end);
        const contentRange = `bytes ${start}-${end - 1}/${fileSize}`;

        const uploadChunk = () => new Promise<{ id?: string }>((resolve, reject) => {
          const xhr = new XMLHttpRequest();
          xhr.open("PUT", sessionUrl);
          xhr.setRequestHeader("Content-Range", contentRange);
          xhr.setRequestHeader("Content-Type", fileType);

          xhr.upload.onprogress = (e) => {
            if (e.lengthComputable) {
              const totalUploaded = start + e.loaded;
              const pct = Math.round((totalUploaded / fileSize) * 100);
              setSnacks((s) => s.map((sn) => (sn.id === id ? { ...sn, progress: pct } : sn)));
            }
          };

          xhr.onload = () => {
            if (xhr.status === 308) {
              resolve({});
            } else if (xhr.status >= 200 && xhr.status < 300) {
              const data = JSON.parse(xhr.responseText || "{}");
              resolve({ id: data.id });
            } else {
              reject(new Error(`Chunk upload failed with status ${xhr.status}`));
            }
          };
          xhr.onerror = () => reject(new Error("Network error during chunk upload"));
          xhr.send(chunk);
        });

        const result = await uploadChunk();
        if (result.id) driveFileId = result.id;
        start = end;
      }

      if (!driveFileId) throw new Error("No Drive ID returned from Google after upload");

      // Step 3: Finalize metadata in our DB
      const finalRes = await authenticatedFetch("/api/files/upload/finalize", token, {
        method: "POST",
        body: JSON.stringify({ driveFileId, accountIndex }),
      });

      if (finalRes.ok) {
        setSnacks((s) => s.map((sn) => (sn.id === id ? { ...sn, status: "done", progress: 100 } : sn)));
        listeners.current.forEach((fn) => fn());
      } else {
        const err = await finalRes.json().catch(() => ({}));
        throw new Error(err.detail || "Finalization failed");
      }
    } catch (err: any) {
      console.error("[Upload] Critical Error:", err.message);
      setSnacks((s) => s.map((sn) => (sn.id === id ? { ...sn, status: "error" } : sn)));
    }
  }, [getToken]);

  const moveFile = useCallback(async (file: any, targetAccountIndex: number) => {
    const id = ++idRef.current;
    const fileName = file.file_name || file.name;
    const creds = localStorage.getItem("credentials");
    
    setIsManagerMinimized(false);
    setSnacks((s) => [...s, { id, name: `Preparing: ${fileName}`, progress: 0, status: "uploading" }]);

    try {
      const token = await getToken();

      // Step 1: Get Source Token
      setSnacks((s) => s.map((sn) => (sn.id === id ? { ...sn, name: `[1/3] Downloading: ${fileName}` } : sn)));
      const tokenRes = await fetch(`/api/accounts/${file.account_index}/token`, {
        headers: { ...(creds ? { "X-Credentials": creds || "" } : {}) }
      });
      if (!tokenRes.ok) throw new Error("Source auth failed");
      const { accessToken } = await tokenRes.json();

      // Step 2: Download directly from Google to Browser
      const downloadRes = await fetch(`https://www.googleapis.com/drive/v3/files/${file.drive_file_id}?alt=media`, {
        headers: { Authorization: `Bearer ${accessToken}` }
      });
      if (!downloadRes.ok) throw new Error("Download from Google failed");
      
      // Track download progress if possible? Fetch doesn't support easily but for simplicity we assume it's fast-ish
      const blob = await downloadRes.blob();

      // Step 3: Initiate resumable upload to target account
      setSnacks((s) => s.map((sn) => (sn.id === id ? { ...sn, progress: 30, name: `[2/3] Uploading: ${fileName}` } : sn)));
      const mimeType = file.mime_type || "application/octet-stream";
      
      const initRes = await fetch("/api/files/upload/initiate", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
          ...(creds ? { "X-Credentials": creds } : {})
        },
        body: JSON.stringify({ fileName, mimeType, accountIndex: targetAccountIndex }),
      });
      if (!initRes.ok) throw new Error("Target upload initiation failed");
      const { sessionUrl, accountIndex } = await initRes.json();

      // Step 4: Stream upload directly to target account via XHR
      const xhr = new XMLHttpRequest();
      xhr.open("PUT", sessionUrl);
      xhr.setRequestHeader("Content-Type", mimeType);
      
      const uploadPromise = new Promise<{ driveFileId: string }>((resolve, reject) => {
        xhr.upload.onprogress = (e) => {
          if (e.lengthComputable) {
            const pct = 30 + Math.round((e.loaded / e.total) * 60); // 30% to 90%
            setSnacks((s) => s.map((sn) => (sn.id === id ? { ...sn, progress: pct } : sn)));
          }
        };
        xhr.onload = () => {
          if (xhr.status >= 200 && xhr.status < 300) {
            const data = JSON.parse(xhr.responseText || "{}");
            if (data.id) resolve({ driveFileId: data.id });
            else reject(new Error("No Drive ID after move upload"));
          } else reject(new Error("Upload move failed"));
        };
        xhr.onerror = () => reject(new Error("Network error during move"));
        xhr.send(blob);
      });

      const { driveFileId } = await uploadPromise;

      // Step 5: Finalize in DB
      const finalRes = await fetch("/api/files/upload/finalize", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
          ...(creds ? { "X-Credentials": creds } : {})
        },
        body: JSON.stringify({ driveFileId, accountIndex }),
      });
      if (!finalRes.ok) throw new Error("Failed to finalize moved file");

      // Step 6: Delete from source account
      setSnacks((s) => s.map((sn) => (sn.id === id ? { ...sn, name: `[3/3] Deleting Source: ${fileName}`, progress: 95 } : sn)));
      const deleteRes = await fetch(`/api/files/${file.id}`, {
        method: "DELETE",
        headers: { ...(creds ? { "X-Credentials": creds || "" } : {}) }
      });
      if (!deleteRes.ok) console.warn("[Move] Warning: File was moved but source couldn't be deleted.");

      setSnacks((s) => s.map((sn) => (sn.id === id ? { ...sn, status: "done", progress: 100, name: `Moved: ${fileName}` } : sn)));
      listeners.current.forEach((fn) => fn());
      
    } catch (err: any) {
      console.error("[Move] Progress Error:", err.message);
      setSnacks((s) => s.map((sn) => (sn.id === id ? { ...sn, status: "error", name: `Move Failed: ${fileName}` } : sn)));
    }
  }, [getToken]);

  useEffect(() => {
    function onDragEnter(e: DragEvent) {
      const types = Array.from(e.dataTransfer?.types || []);
      if (!types.includes("Files")) return;
      e.preventDefault();
      dragCounter.current++;
      if (dragCounter.current === 1) setDragging(true);
    }
    function onDragLeave(e: DragEvent) {
      const types = Array.from(e.dataTransfer?.types || []);
      if (!types.includes("Files")) return;
      dragCounter.current--;
      if (dragCounter.current <= 0) {
        dragCounter.current = 0;
        setDragging(false);
      }
    }
    function onDragOver(e: DragEvent) {
      const types = Array.from(e.dataTransfer?.types || []);
      if (!types.includes("Files")) return;
      e.preventDefault();
    }
    function onDrop(e: DragEvent) {
      const types = Array.from(e.dataTransfer?.types || []);
      if (!types.includes("Files")) return;
      e.preventDefault();
      dragCounter.current = 0;
      setDragging(false);
      Array.from(e.dataTransfer?.files ?? []).forEach((f) => upload(f));
    }

    window.addEventListener("dragenter", onDragEnter);
    window.addEventListener("dragleave", onDragLeave);

    window.addEventListener("dragover", onDragOver);
    window.addEventListener("drop", onDrop);
    return () => {
      window.removeEventListener("dragenter", onDragEnter);
      window.removeEventListener("dragleave", onDragLeave);
      window.removeEventListener("dragover", onDragOver);
      window.removeEventListener("drop", onDrop);
    };
  }, [upload]);

  // Derived state for the upload manager widget
  const showManager = snacks.length > 0;
  const activeUploads = snacks.filter(s => s.status === "uploading").length;
  const completedUploads = snacks.filter(s => s.status === "done").length;
  const failedUploads = snacks.filter(s => s.status === "error").length;

  return (
    <UploadContext.Provider value={{ upload, addCompleteListener, setCurrentFolder, toast, updateToast, confirm, moveFile }}>
      {children}

      {/* Drop overlay */}
      {dragging && (
        <div className="pointer-events-none fixed inset-0 z-50 flex items-center justify-center bg-sd-bg/85 backdrop-blur-sm transition-all duration-300">
          <div className="flex flex-col items-center gap-4 rounded-[2rem] border-2 border-dashed border-sd-accent/50 bg-sd-s1/80 px-24 py-16 shadow-2xl animate-fade-up">
            <div className="flex h-20 w-20 items-center justify-center rounded-3xl border border-sd-accent/20 bg-sd-accent/10 shadow-glow">
              <svg className="h-10 w-10 text-sd-accent animate-float" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0 4.5 4.5M12 3v13.5" />
              </svg>
            </div>
            <div className="text-center">
              <p className="text-2xl font-bold text-sd-text">Drop files to upload</p>
              <p className="mt-2 text-base font-medium text-sd-text2 max-w-sm">
                Files will be securely uploaded to your {currentFolderNameRef.current ? `"${currentFolderNameRef.current}"` : "root"} folder.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Confirm dialog */}
      {confirmState && (
        <div
          className="fixed inset-0 z-[150] flex items-center justify-center bg-black/70 backdrop-blur-sm px-4"
          onClick={() => setConfirmState(null)}
        >
          <div
            className="relative w-full max-w-sm rounded-2xl border border-sd-border bg-sd-s1 p-6 shadow-2xl animate-fade-up-d1 mx-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="absolute top-0 left-6 right-6 h-px bg-gradient-to-r from-transparent via-sd-border2 to-transparent" />
            <p className="text-lg font-bold text-sd-text">{confirmState.message}</p>
            {confirmState.description && (
              <p className="mt-2 text-sm text-sd-text3">{confirmState.description}</p>
            )}
            <div className="mt-6 flex justify-end gap-3">
              <button
                onClick={() => setConfirmState(null)}
                className="rounded-xl border border-sd-border bg-sd-bg px-5 py-2 text-sm font-semibold text-sd-text2 hover:bg-sd-hover hover:text-sd-text transition"
              >
                Cancel
              </button>
              <button
                onClick={() => { const fn = confirmState.onConfirm; setConfirmState(null); fn(); }}
                className={`rounded-xl px-5 py-2 text-sm font-bold shadow-sm transition ${
                  confirmState.danger
                    ? "bg-red-500 hover:bg-red-600 text-white shadow-red-500/20"
                    : "btn-primary"
                }`}
              >
                {confirmState.confirmLabel}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Toast notifications (excluding file uploads) */}
      <div className="fixed bottom-24 md:bottom-auto md:top-6 right-4 md:right-6 z-[140] flex flex-col gap-3 pointer-events-none w-[calc(100%-2rem)] md:w-full md:max-w-[320px]">
        {toasts.map((t) => (
          <div
            key={t.id}
            className={`pointer-events-auto flex items-center gap-3 rounded-xl border px-4 py-3 shadow-lg backdrop-blur-md animate-slide-in-right ${
              t.type === "success" ? "border-emerald-500/30 bg-sd-s1/95"
              : t.type === "error"   ? "border-red-500/30 bg-sd-s1/95"
              : "border-sd-border bg-sd-s1/95"
            }`}
          >
            {t.type === "loading" ? (
              <svg className="h-5 w-5 flex-shrink-0 animate-spin text-sd-accent" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                 <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0 3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182m0-4.991v4.99" />
              </svg>
            ) : t.type === "success" ? (
              <div className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-emerald-500/20 border border-emerald-500/30">
                <svg className="h-4 w-4 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
                </svg>
              </div>
            ) : (
              <div className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-red-500/20 border border-red-500/30">
                <svg className="h-4 w-4 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
                </svg>
              </div>
            )}
            <p className="text-sm font-medium text-sd-text flex-1">{t.message}</p>
          </div>
        ))}
      </div>

      {showManager && (
        <div 
          className="fixed md:bottom-6 bottom-24 right-0 md:right-6 z-[110] transition-all duration-500 ease-in-out w-full md:w-[380px] px-4 md:px-0 animate-fade-in"
          style={{ 
            transform: isManagerMinimized ? (window.innerWidth < 768 ? 'translateY(calc(100% - 40px))' : 'translateY(calc(100% - 48px))') : 'translateY(0)',
          }}
        >
          <div className="flex flex-col w-full rounded-2xl bg-sd-s1 border border-sd-border shadow-[0_8px_40px_rgba(0,0,0,0.5)] overflow-hidden glass">
            {/* Header */}
            <div 
              className="group flex items-center justify-between px-4 py-3 bg-sd-bg/80 backdrop-blur-md border-b border-sd-border cursor-pointer hover:bg-sd-hover transition-colors"
              onClick={() => setIsManagerMinimized(!isManagerMinimized)}
            >
              <div className="flex items-center gap-3">
                {activeUploads > 0 ? (
                  <svg className="h-4 w-4 animate-spin text-sd-accent" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                     <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0 3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182m0-4.991v4.99" />
                  </svg>
                ) : failedUploads > 0 ? (
                  <div className="h-5 w-5 flex items-center justify-center rounded-full bg-red-500/20 text-red-400 border border-red-500/30">
                    <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                    </svg>
                  </div>
                ) : (
                  <div className="h-5 w-5 flex items-center justify-center rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                    <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
                    </svg>
                  </div>
                )}
                <span className="text-sm font-bold text-sd-text truncate max-w-[180px] sm:max-w-none">
                  {activeUploads > 0 
                    ? `Uploading ${activeUploads} ${activeUploads === 1 ? 'item' : 'items'}` 
                    : `${completedUploads} ${completedUploads === 1 ? 'upload' : 'uploads'} complete`}
                </span>
              </div>
              <div className="flex items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
                <button 
                  className={`flex h-8 w-8 items-center justify-center rounded-xl bg-sd-s2/40 text-sd-text3 transition hover:bg-sd-s2 hover:text-sd-text ${isManagerMinimized ? "rotate-180" : ""}`}
                  onClick={() => setIsManagerMinimized(!isManagerMinimized)}
                  title={isManagerMinimized ? "Expand" : "Minimize"}
                >
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="m19.5 8.25-7.5 7.5-7.5-7.5" />
                  </svg>
                </button>
                <button 
                  className="h-8 w-8 flex items-center justify-center rounded-xl hover:bg-rose-500/10 text-sd-text3 hover:text-rose-400 transition"
                  onClick={() => setSnacks([])}
                  title="Close"
                >
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>

            {/* List */}
            <div className="max-h-[350px] overflow-y-auto bg-sd-s1">
              {snacks.map((snack) => (
                <div key={snack.id} className="flex items-center gap-3 px-4 py-3 border-b border-sd-border/50 last:border-0 hover:bg-sd-s2/30 transition">
                  <div className="flex-shrink-0">
                    {snack.status === "uploading" ? (
                      <svg className="h-5 w-5 text-sd-text3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m3.75 9v6m3-3H9m1.5-12H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9Z" />
                      </svg>
                    ) : snack.status === "done" ? (
                      <div className="h-5 w-5 rounded bg-emerald-500/10 flex items-center justify-center border border-emerald-500/20">
                        <svg className="h-3.5 w-3.5 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
                        </svg>
                      </div>
                    ) : (
                      <div className="h-5 w-5 rounded bg-red-500/10 flex items-center justify-center border border-red-500/20">
                        <svg className="h-3.5 w-3.5 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                        </svg>
                      </div>
                    )}
                  </div>
                  <div className="min-w-0 flex-1 flex flex-col justify-center py-0.5">
                    <p className="truncate text-[11px] sm:text-xs font-semibold text-sd-text" title={snack.name}>{snack.name}</p>
                    {snack.status === "uploading" ? (
                      <div className="mt-1.5 flex items-center gap-2">
                        <div className="h-1 w-full overflow-hidden rounded-full bg-sd-border relative">
                          <div
                            className="absolute top-0 bottom-0 left-0 bg-blue-500 transition-all duration-300 ease-out shadow-[0_0_8px_rgba(59,130,246,0.8)]"
                            style={{ width: `${snack.progress}%` }}
                          />
                        </div>
                        <span className="text-[10px] font-mono text-sd-text3">{snack.progress}%</span>
                      </div>
                    ) : (
                      <p className={`mt-0.5 text-[10px] ${snack.status === 'done' ? 'text-emerald-400' : 'text-red-400'}`}>
                        {snack.status === "done" ? "Upload complete" : "Upload failed"}
                      </p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

    </UploadContext.Provider>
  );
}

export const useUpload = () => useContext(UploadContext);
