"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useFiles } from "@/hooks/useFiles";
import { useStorage } from "@/hooks/useStorage";
import { formatBytes } from "@/lib/utils";
import { type CachedStats, computeStats, getCachedStats, isStatsDirty, setCachedStats } from "@/hooks/useStats";
import { CredentialsUpload } from "@/components/CredentialsUpload";
import { AuthenticatedThumbnail } from "@/components/AuthenticatedThumbnail";

type Account = {
  account_index: number;
  email: string | null;
  is_connected: boolean;
  used: number;
  limit: number;
  free: number;
};



type StatCardProps = {
  label: string;
  value: string;
  sub?: string;
  icon: React.ReactNode;
  iconBg: string;
};

function StatCard({ label, value, sub, icon, iconBg }: StatCardProps) {
  return (
    <div className="stat-card rounded-2xl p-5">
      <div className={`mb-4 inline-flex rounded-xl p-3 ${iconBg}`}>{icon}</div>
      <div className="text-2xl font-bold font-display tracking-wide text-sd-text">{value}</div>
      {sub && <div className="mt-1 text-xs font-medium text-sd-text3">{sub}</div>}
      <div className="mt-1.5 text-sm font-medium text-sd-text2">{label}</div>
    </div>
  );
}

function StorageCard({ used, free, iconBg }: { used: string; free: string; iconBg: string }) {
  return (
    <div className="stat-card rounded-2xl p-5 relative overflow-hidden">
      {/* subtle gradient glow behind everything */}
      <div className="absolute -bottom-8 -right-8 h-32 w-32 rounded-full bg-blue-500/10 blur-3xl pointer-events-none" />
      <div className={`mb-4 inline-flex rounded-xl p-3 ${iconBg}`}>
        <svg className="h-5 w-5 text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M20.25 6.375c0 2.278-3.694 4.125-8.25 4.125S3.75 8.653 3.75 6.375m16.5 0c0-2.278-3.694-4.125-8.25-4.125S3.75 4.097 3.75 6.375m16.5 0v11.25c0 2.278-3.694 4.125-8.25 4.125s-8.25-1.847-8.25-4.125V6.375m16.5 2.25c0 2.278-3.694 4.125-8.25 4.125s-8.25-1.847-8.25-4.125" />
        </svg>
      </div>
      <div className="flex items-end justify-between gap-2 relative z-10">
        <div>
          <div className="text-2xl font-bold font-display tracking-wide text-sd-text">{used}</div>
          <div className="mt-1 text-xs font-medium text-sd-text3">used</div>
        </div>
        <div className="text-right">
          <div className="text-2xl font-bold font-display tracking-wide text-emerald-400">{free}</div>
          <div className="mt-1 text-xs font-medium text-sd-text3">free</div>
        </div>
      </div>
      <div className="mt-2.5 text-sm font-medium text-sd-text2">Storage Status</div>
    </div>
  );
}

function FileTypeIcon({ mimeType }: { mimeType: string | null }) {
  const t = mimeType ?? "";
  let bg = "bg-sd-s2";
  let text = "text-sd-text2";
  let label = "FILE";

  if (t === "application/vnd.google-apps.folder") { bg = "bg-amber-500/10"; text = "text-amber-400"; label = "DIR"; }
  else if (t.startsWith("image/")) { bg = "bg-purple-500/10"; text = "text-purple-400"; label = "IMG"; }
  else if (t.startsWith("video/")) { bg = "bg-blue-500/10"; text = "text-blue-400"; label = "VID"; }
  else if (t.startsWith("audio/")) { bg = "bg-pink-500/10"; text = "text-pink-400"; label = "AUD"; }
  else if (t.includes("pdf")) { bg = "bg-rose-500/10"; text = "text-rose-400"; label = "PDF"; }
  else if (t.includes("spreadsheet") || t.includes("sheet")) { bg = "bg-emerald-500/10"; text = "text-emerald-400"; label = "XLS"; }
  else if (t.includes("presentation") || t.includes("slide")) { bg = "bg-indigo-500/10"; text = "text-indigo-400"; label = "PPT"; }
  else if (t.includes("document") || t.startsWith("text/")) { bg = "bg-sky-500/10"; text = "text-sky-400"; label = "DOC"; }

  return (
    <div className={`flex h-8 w-8 items-center justify-center rounded-lg text-[9px] font-bold ${bg} ${text}`}>
      {label}
    </div>
  );
}

export default function OverviewPage() {
  const { accounts } = useStorage();
  const { files } = useFiles();
  const [stats, setStats] = useState<CachedStats | null>(null);
  const [fromCache, setFromCache] = useState(false);
  const [hasCredentials, setHasCredentials] = useState<boolean | null>(null);

  useEffect(() => {
    const checkCreds = () => {
      const saved = localStorage.getItem("credentials");
      setHasCredentials(!!saved);
    };
    checkCreds();
    // Listen for storage changes in other tabs
    window.addEventListener("storage", checkCreds);
    return () => window.removeEventListener("storage", checkCreds);
  }, []);

  useEffect(() => {
    if (files.length === 0 && accounts.length === 0) return;
    if (isStatsDirty()) {
      const fresh = computeStats(files, accounts);
      setCachedStats(fresh);
      setStats(fresh);
      setFromCache(false);
    } else {
      const cached = getCachedStats();
      if (cached) {
        setStats(cached);
        setFromCache(true);
      } else {
        const fresh = computeStats(files, accounts);
        setCachedStats(fresh);
        setStats(fresh);
        setFromCache(false);
      }
    }
  }, [files, accounts]);

  const s = stats;
  const connectedAccounts = accounts.filter((a: Account) => a.is_connected);
  const totalUsed = connectedAccounts.reduce((acc: number, a: Account) => acc + a.used, 0);
  const totalLimit = connectedAccounts.reduce((acc: number, a: Account) => acc + a.limit, 0);
  const totalFree = Math.max(0, totalLimit - totalUsed);
  const connectedCount = connectedAccounts.length;
  const recentFiles = files.slice(0, 6);

  return (
    <div className="space-y-6 animate-fade-up">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-1">
          <h1 className="font-display text-2xl text-sd-text">Overview</h1>
          <p className="text-sm text-sd-text2 font-medium">Your unified cloud storage at a glance</p>
          
          {fromCache && (
            <Link
              href="/dashboard/stats"
              className="inline-flex mt-2 items-center gap-1.5 rounded-lg border border-sd-border bg-sd-s1/50 px-2.5 py-1 text-[11px] text-sd-text3 font-medium transition hover:border-sd-accent/40 hover:text-sd-text"
            >
              <span className="h-1 w-1 rounded-full bg-sd-accent animate-pulse" />
              Cached · View analytics
            </Link>
          )}
        </div>
        
        <div className="flex items-center gap-3">
          <CredentialsUpload />
        </div>
      </div>

      {/* Missing Credentials Alert */}
      {hasCredentials === false && (
        <div className="relative group overflow-hidden rounded-2xl border border-rose-500/20 bg-rose-500/5 p-4 sm:p-5 transition-all hover:border-rose-500/30">
          <div className="absolute top-0 left-0 w-1 h-full bg-rose-500/50" />
          <div className="flex flex-col sm:flex-row sm:items-center gap-4">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-rose-500/10 text-rose-400">
              <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z" />
              </svg>
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="text-sm font-bold text-sd-text">Google Drive Credentials Required</h3>
              <p className="mt-1 text-sm text-sd-text2 font-medium">Please upload your <code className="text-rose-400 font-mono">credentials.json</code> file to enable cloud storage features. This data is stored locally in your browser and never leaves your device.</p>
            </div>
          </div>
        </div>
      )}

      {/* Stats cards */}
      <div className="grid grid-cols-2 gap-4 xl:grid-cols-4">
        <StatCard
          label="Total Files"
          value={(s?.totalFiles ?? 0).toLocaleString()}
          sub={`${(s?.totalFolders ?? 0).toLocaleString()} folders`}
          iconBg="bg-blue-500/10 border border-blue-500/20"
          icon={
            <svg className="h-5 w-5 text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9Z" />
            </svg>
          }
        />
        <StorageCard
          used={formatBytes(totalUsed)}
          free={formatBytes(totalFree)}
          iconBg="bg-teal-500/10 border border-teal-500/20"
        />
        <StatCard
          label="Total Capacity"
          value={formatBytes(totalLimit)}
          sub={`Used: ${((totalUsed / (totalLimit || 1)) * 100).toFixed(1)}%`}
          iconBg="bg-violet-500/10 border border-violet-500/20"
          icon={
            <svg className="h-5 w-5 text-violet-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 3.75v4.5m0-4.5h4.5m-4.5 0L9 9M3.75 20.25v-4.5m0 4.5h4.5m-4.5 0L9 15M20.25 3.75h-4.5m4.5 0v4.5m0-4.5L15 9m5.25 11.25h-4.5m4.5 0v-4.5m0 4.5L15 15" />
            </svg>
          }
        />
        <StatCard
          label="Drive Accounts"
          value={`${connectedCount} / ${accounts.length}`}
          sub={accounts.length - connectedCount > 0 ? `${accounts.length - connectedCount} disconnected` : "All connected"}
          iconBg="bg-amber-500/10 border border-amber-500/20"
          icon={
            <svg className="h-5 w-5 text-amber-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z" />
            </svg>
          }
        />
      </div>

      {/* Storage breakdown + File types */}
      <div className="grid gap-4 lg:grid-cols-5">
        <div className="lg:col-span-3 rounded-2xl border border-sd-border bg-sd-s1 p-6 shadow-sm relative overflow-hidden">
          <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-sd-border2 to-transparent opacity-50" />
          <h2 className="mb-5 text-sm font-semibold tracking-wide text-sd-text uppercase">Storage Breakdown</h2>
          <div className="mb-6">
            <div className="mb-2 flex items-end justify-between">
              <span className="text-xl font-bold font-display tracking-tight text-sd-text">
                {formatBytes(totalUsed)}
              </span>
              <span className="text-xs font-medium text-sd-text3">
                of <span className="text-sd-text2">{formatBytes(totalLimit)}</span>
              </span>
            </div>
            <div className="h-3 w-full overflow-hidden rounded-full bg-sd-s3 shadow-inner">
              <div
                className="progress-bar h-full rounded-full transition-all duration-700"
                style={{ width: `${totalLimit > 0 ? Math.min(100, (totalUsed / totalLimit) * 100) : 0}%` }}
              />
            </div>
          </div>
          <div className="space-y-4 relative z-10">
            {connectedAccounts.map((a: Account, idx: number) => {
              const pct = a.limit > 0 ? Math.min(100, (a.used / a.limit) * 100) : 0;
              // Cycle through subtle accent colors for each account bar
              const barColors = [
                "bg-blue-500", "bg-indigo-500", "bg-violet-500", "bg-emerald-500", "bg-teal-500"
              ];
              const color = barColors[idx % barColors.length];
              return (
                <div key={a.account_index} className="group">
                  <div className="mb-1.5 flex items-center justify-between text-xs font-medium">
                    <span className="flex items-center gap-2 max-w-[200px] truncate text-sd-text2 group-hover:text-sd-text transition-colors">
                      <span className={`h-1.5 w-1.5 rounded-full ${color}`} />
                      {a.email ?? `Account ${a.account_index}`}
                    </span>
                    <span className="text-sd-text3 font-mono">
                      {formatBytes(a.used)} <span className="text-sd-border2">/</span> {formatBytes(a.limit)}
                    </span>
                  </div>
                  <div className="h-1.5 w-full overflow-hidden rounded-full bg-sd-s2">
                    <div className={`h-full rounded-full ${color} opacity-80 transition-all shadow-glow-sm`} style={{ width: `${pct}%` }} />
                  </div>
                </div>
              );
            })}
            {connectedCount === 0 && <p className="text-sm font-medium text-sd-text3">No connected accounts</p>}
          </div>
        </div>

        <div className="lg:col-span-2 rounded-2xl border border-sd-border bg-sd-s1 p-6 shadow-sm">
          <h2 className="mb-5 text-sm font-semibold tracking-wide text-sd-text uppercase">File Types</h2>
          <div className="space-y-3.5">
            {[
              { key: "Images", color: "bg-purple-500", textColor: "text-purple-400" },
              { key: "Documents", color: "bg-sky-500", textColor: "text-sky-400" },
              { key: "Videos", color: "bg-blue-500", textColor: "text-blue-400" },
              { key: "Folders", color: "bg-amber-500", textColor: "text-amber-400" },
              { key: "PDFs", color: "bg-rose-500", textColor: "text-rose-400" },
              { key: "Spreadsheets", color: "bg-emerald-500", textColor: "text-emerald-400" },
              { key: "Other", color: "bg-sd-text3", textColor: "text-sd-text2" },
            ]
              .filter(({ key }) => (s?.filesByType[key] ?? 0) > 0)
              .map(({ key, color, textColor }) => (
                <div key={key} className="flex items-center justify-between group">
                  <div className="flex items-center gap-2.5">
                    <span className={`flex h-6 w-6 items-center justify-center rounded-lg bg-sd-s2 overflow-hidden`}>
                      <span className={`h-2 w-2 rounded-full ${color}`} />
                    </span>
                    <span className="text-sm font-medium text-sd-text2 group-hover:text-sd-text transition">{key}</span>
                  </div>
                  <span className={`text-sm font-mono font-medium ${textColor}`}>{s?.filesByType[key] ?? 0}</span>
                </div>
              ))}
            {!s && <p className="text-sm font-medium text-sd-text3">Loading…</p>}
            {s && Object.keys(s.filesByType).length === 0 && (
              <p className="text-sm font-medium text-sd-text3">No files yet</p>
            )}
          </div>
          <div className="mt-5 border-t border-sd-border pt-5">
            <Link href="/dashboard/stats" className="text-xs font-semibold text-sd-accent hover:text-sd-accent2 flex justify-end gap-1 items-center transition">
              View detailed analytics
              <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5 21 12m0 0-7.5 7.5M21 12H3" />
              </svg>
            </Link>
          </div>
        </div>
      </div>

      {/* Recent files */}
      <div className="rounded-2xl border border-sd-border bg-sd-s1 shadow-sm overflow-hidden">
        <div className="flex items-center justify-between border-b border-sd-border bg-sd-s2/30 px-6 py-4">
          <h2 className="text-sm font-semibold tracking-wide text-sd-text uppercase">Recent Files</h2>
          <Link href="/dashboard/files" className="text-xs font-semibold text-sd-text2 transition hover:text-sd-accent flex gap-1 items-center">
            View all
            <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5 21 12m0 0-7.5 7.5M21 12H3" />
            </svg>
          </Link>
        </div>
        {recentFiles.length === 0 ? (
          <div className="py-16 text-center">
            <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-xl bg-sd-s2">
              <svg className="h-6 w-6 text-sd-text3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9Z" />
              </svg>
            </div>
            <p className="text-sm font-medium text-sd-text3">No files yet. Upload something to get started.</p>
          </div>
        ) : (
          <div className="divide-y divide-sd-border">
            {recentFiles.map((file) => (
              <div key={file.id} className="file-card flex items-center gap-4 px-6 py-3.5 bg-sd-s1 hover:bg-sd-s2 transition-colors cursor-pointer rounded-none border-none">
                <div className="flex-shrink-0">
                  {file.has_thumbnail ? (
                    <AuthenticatedThumbnail 
                      fileId={file.id} 
                      mimeType={file.mime_type} 
                      className="h-9 w-9 rounded-lg object-cover shadow-sm border border-sd-border/50"
                    />
                  ) : (
                    <FileTypeIcon mimeType={file.mime_type} />
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-sd-text">{file.file_name}</p>
                  <p className="flex items-center gap-2 mt-0.5 text-xs font-mono text-sd-text3">
                    <span>{formatBytes(file.size)}</span>
                    <span className="h-1 w-1 rounded-full bg-sd-border2" />
                    <span>Account #{file.account_index}</span>
                  </p>
                </div>
                <span className="flex-shrink-0 text-xs font-medium text-sd-text3 w-24 text-right">
                  {new Date(file.created_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
