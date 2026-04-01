import { useEffect, useState } from "react";
import { useAuth } from "@clerk/nextjs";
import { fetchMediaBlobUrl, downloadFileAuthenticated } from "@/lib/api";
import type { FileItem } from "@/hooks/useFiles";

export function PreviewModal({ file, onClose }: { file: FileItem; onClose: () => void }) {
  const { getToken } = useAuth();
  const [authenticatedUrl, setAuthenticatedUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  
  const mime = file.mime_type ?? "";
  const isGoogleWorkspace = mime.startsWith("application/vnd.google-apps.") && mime !== "application/vnd.google-apps.folder";

  useEffect(() => {
    let active = true;
    let blobUrl = "";

    async function loadMedia() {
      if (isGoogleWorkspace) {
        setLoading(false);
        return;
      }
      try {
        const token = await getToken();
        blobUrl = await fetchMediaBlobUrl(`/api/files/${file.id}/view`, token, {
          accountIndex: file.account_index,
          driveFileId: file.drive_file_id,
        });
        if (active) {
          setAuthenticatedUrl(blobUrl);
          setLoading(false);
        }
      } catch (err) {
        console.error("[Preview] Error loading media:", err);
        if (active) setLoading(false);
      }
    }

    loadMedia();
    return () => {
      active = false;
      if (blobUrl) URL.revokeObjectURL(blobUrl);
    };
  }, [file.id, getToken, isGoogleWorkspace]);

  useEffect(() => {
    function handleKey(e: KeyboardEvent) { if (e.key === "Escape") onClose(); }
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [onClose]);

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

  function renderContent() {
    if (loading) {
       return (
         <div className="flex flex-col items-center justify-center gap-4 py-32">
           <div className="h-10 w-10 animate-spin rounded-full border-4 border-sd-accent border-t-transparent" />
           <p className="text-sm font-medium text-sd-text3">Decrypting media...</p>
         </div>
       );
    }

    if (isGoogleWorkspace) {
      return (
        <div className="flex flex-col items-center justify-center gap-4 py-24 text-center">
          <svg className="h-16 w-16 text-sd-text3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9Z" />
          </svg>
          <div>
            <p className="text-lg font-semibold text-sd-text">Google Workspace File</p>
            <p className="mt-1 text-sm text-sd-text3 max-w-sm">This file type is native to Google Workspace and can only be opened directly in Google Drive.</p>
          </div>
          <a
            href={`https://drive.google.com/file/d/${file.drive_file_id}/view`}
            target="_blank"
            rel="noopener noreferrer"
            className="btn-primary flex items-center gap-2 rounded-xl px-6 py-3 text-sm font-semibold transition mt-2"
          >
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 6H5.25A2.25 2.25 0 0 0 3 8.25v10.5A2.25 2.25 0 0 0 5.25 21h10.5A2.25 2.25 0 0 0 18 18.75V10.5m-10.5 6L21 3m0 0h-5.25M21 3v5.25" />
            </svg>
            Open in Google Drive
          </a>
        </div>
      );
    }

    if (!authenticatedUrl) {
       return (
         <div className="flex flex-col items-center justify-center gap-4 py-24 text-center text-rose-400">
           <p className="font-semibold">Authentication required to view this file.</p>
           <button onClick={onClose} className="text-sm underline">Close</button>
         </div>
       );
    }

    if (mime.startsWith("image/")) {
      return (
        <div className="flex h-full w-full items-center justify-center p-4">
          <img src={authenticatedUrl} alt={file.file_name} className="max-h-[85vh] max-w-[95vw] rounded-xl object-contain shadow-2xl transition-transform duration-300" />
        </div>
      );
    }
    if (mime.startsWith("video/")) {
      return (
        <div className="flex h-full w-full items-center justify-center p-4">
          <video src={authenticatedUrl} controls autoPlay className="max-h-[85vh] max-w-[95vw] rounded-xl shadow-2xl" />
        </div>
      );
    }
    if (mime.startsWith("audio/")) {
      return (
        <div className="flex h-full w-full items-center justify-center p-16">
          <div className="w-full max-w-md rounded-3xl bg-sd-s1 p-8 shadow-card border border-sd-border flex flex-col items-center">
            <div className="h-20 w-20 rounded-full bg-sd-accent/10 flex items-center justify-center mb-6 border border-sd-accent/20">
              <svg className="h-10 w-10 text-sd-accent" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="m9 9.018 1.99 2.031M9 9.018v7.418c0 .598.406 1.107.986 1.25l7.632 1.898A1.125 1.125 0 0 0 19.5 18.514V5.514A1.125 1.125 0 0 0 17.868 4.43l-7.632 1.898C9.406 6.47 9 6.98 9 7.577zM9 9.018 7.01 6.987M15 11l-3 3m0-3 3 3" />
              </svg>
            </div>
            <p className="font-semibold text-lg text-sd-text truncate w-full text-center mb-6">{file.file_name}</p>
            <audio src={authenticatedUrl} controls className="w-full" autoPlay />
          </div>
        </div>
      );
    }
    if (mime.includes("pdf") || mime.startsWith("text/")) {
      return (
        <div className="h-full w-full p-4 md:p-12 flex justify-center">
          <iframe
            src={authenticatedUrl}
            title={file.file_name}
            className="h-full w-full max-w-6xl rounded-xl border border-sd-border bg-white shadow-2xl"
          />
        </div>
      );
    }
    return (
      <div className="flex flex-col items-center justify-center gap-4 py-24 text-center">
        <svg className="h-16 w-16 text-sd-text3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9Z" />
        </svg>
        <div>
          <p className="text-lg font-semibold text-sd-text">No preview available</p>
          <p className="mt-1 text-sm text-sd-text3 max-w-sm">This file type cannot be previewed directly in the browser. You'll need to download it.</p>
        </div>
        <button
          onClick={handleDownload}
          className="btn-primary flex items-center gap-2 rounded-xl px-6 py-3 text-sm font-semibold transition mt-2"
        >
          <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12 12 16.5m0 0L7.5 12m4.5 4.5V3" />
          </svg>
          Download File
        </button>
      </div>
    );
  }

  // Determine if it's a media format that should be mostly borderless (immersive)
  const isImageOrVideo = mime.startsWith("image/") || mime.startsWith("video/");

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/85 backdrop-blur-xl animate-fade-in"
      onClick={onClose}
    >
      {/* Top action bar */}
      <div className="absolute top-0 left-0 right-0 z-10 flex items-center justify-between bg-gradient-to-b from-black/60 to-transparent px-6 py-4 pointer-events-none">
        <div className="flex min-w-0 items-center gap-4 pointer-events-auto">
          <div className="flex flex-col">
            <p className="truncate text-base font-semibold text-white drop-shadow-md">{file.file_name}</p>
            <span className="text-xs text-white/70 drop-shadow-sm flex items-center gap-1.5 mt-0.5">
              <span className="flex-shrink-0 h-1.5 w-1.5 rounded-full bg-emerald-400" />
              Account #{file.account_index}
            </span>
          </div>
        </div>
        <div className="flex items-center gap-3 pointer-events-auto">
          {!isGoogleWorkspace && (
            <button
              onClick={handleDownload}
              className="flex items-center gap-2 rounded-xl bg-white/10 backdrop-blur-md border border-white/20 px-4 py-2 text-sm font-semibold text-white transition hover:bg-white/20 hover:scale-105"
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12 12 16.5m0 0L7.5 12m4.5 4.5V3" />
              </svg>
              Download
            </button>
          )}
          <button
            onClick={onClose}
            className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/10 backdrop-blur-md border border-white/20 text-white transition hover:bg-white/20 hover:scale-105"
            title="Close (Esc)"
          >
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      </div>

      {/* Main Content Area */}
      {isImageOrVideo ? (
        <div className="pointer-events-none flex h-full w-full items-center justify-center p-4 pt-16" onClick={(e) => e.stopPropagation()}>
          <div className="pointer-events-auto flex items-center justify-center max-h-full max-w-full">
            {renderContent()}
          </div>
        </div>
      ) : (
        <div
          className="relative mt-16 flex w-full max-w-4xl max-h-[80vh] flex-col overflow-hidden rounded-2xl border border-sd-border bg-sd-s1 shadow-2xl animate-fade-up-d1"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="h-full overflow-auto bg-sd-bg">
            {renderContent()}
          </div>
        </div>
      )}
    </div>
  );
}
