"use client";

import { useAuth, useSignIn } from "@clerk/nextjs";
import { useState, useEffect } from "react";
import { useStorage } from "@/hooks/useStorage";
import { useUpload } from "@/contexts/UploadContext";
import { useSearchParams, useRouter } from "next/navigation";
import { formatBytes } from "@/lib/utils";
import { authenticatedFetch } from "@/lib/api";
import Link from "next/link";



export default function SettingsPage() {
  const { accounts, refreshStorage } = useStorage();
  const { confirm, toast } = useUpload();
  const { getToken } = useAuth();
  const [connecting, setConnecting] = useState(false);
  const searchParams = useSearchParams();
  const router = useRouter();
  const error = searchParams.get("error");
  const status = searchParams.get("status");

  useEffect(() => {
    if (error === "account_already_connected") {
      toast("This Google account is already connected.", "error");
      router.replace("/dashboard/settings");
    } else if (error) {
      toast("Connection failed. Please try again.", "error");
      router.replace("/dashboard/settings");
    } else if (status === "success") {
      toast("Account connected successfully!", "success");
      refreshStorage();
      router.replace("/dashboard/settings");
    }
  }, [error, status, router, toast, refreshStorage]);

  const totalUsed = accounts.reduce((s, a) => s + a.used, 0);
  const totalLimit = accounts.reduce((s, a) => s + a.limit, 0);
  const connectedCount = accounts.filter((a) => a.is_connected).length;

  async function handleAction(index: number, isConnected: boolean) {
    const confirmMsg = isConnected ? "Disconnect Account" : "Remove Account Entry";
    const body = isConnected 
      ? "You will lose access to files on this account until you reconnect. Local file records for this account will be deleted from StitchDrive."
      : "Permanently remove this account slot from your dashboard? You can add it back anytime.";
    
    confirm(confirmMsg, async () => {
      const token = await getToken();
      await authenticatedFetch(`/api/accounts/${index}`, token, { 
        method: "DELETE" 
      });
      refreshStorage();
    }, { description: body, confirmLabel: isConnected ? "Disconnect" : "Remove", danger: true });
  }

  async function handleConnect(index: number) {
    try {
      const token = await getToken();
      const res = await authenticatedFetch(`/api/accounts/oauth/${index}`, token);
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.detail || "Failed to get auth URL");
      }
      const data = await res.json();
      if (data.auth_url) window.location.href = data.auth_url;
      else throw new Error("No auth URL returned");
    } catch (err: any) {
      toast(err.message || "Connection failed", "error");
    }
  }

  async function handleConnectNew() {
    if (connecting) return;
    setConnecting(true);
    try {
      const token = await getToken();
      const res = await authenticatedFetch("/api/accounts/oauth/new", token);
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.detail || "Failed to initiate connection");
      }
      const data = await res.json();
      if (data.auth_url) window.location.href = data.auth_url;
      else throw new Error("No auth URL returned");
    } catch (err: any) {
      toast(err.message || "Connection failed", "error");
    } finally {
      setConnecting(false);
    }
  }
  async function handleRemoveCredentials() {
    confirm("Remove stored credentials?", async () => {
      const token = await getToken();
      await authenticatedFetch("/api/credentials", token, { method: "DELETE" });
      toast("Credentials removed successfully.", "success");
      setTimeout(() => window.location.reload(), 1500);
    }, { 
      description: "This will permanently delete your Google Cloud credentials from the server. You will need to re-upload them to use StitchDrive features.",
      confirmLabel: "Remove Credentials",
      danger: true 
    });
  }

  return (
    <div className="space-y-6 animate-fade-up">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl text-sd-text">Settings</h1>
          <p className="mt-1 flex items-center gap-2 text-sm font-medium text-sd-text2">
            <span className="flex h-5 items-center justify-center rounded-md bg-sd-s2 px-2 pb-[1px] text-[11px] font-bold text-sd-text">{connectedCount} / {accounts.length}</span>
            accounts connected
          </p>
        </div>
        <button
          onClick={handleConnectNew}
          disabled={connecting}
          className="btn-primary flex items-center gap-2 rounded-xl px-4 py-2.5 text-xs font-semibold disabled:opacity-60"
        >
          {connecting ? (
            <svg className="h-4 w-4 animate-spin" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4l3-3-3-3v4a8 8 0 00-8 8h4z" />
            </svg>
          ) : (
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
            </svg>
          )}
          {connecting ? "Redirecting…" : "Connect Account"}
        </button>
      </div>

      {/* Storage pool overview */}
      <div className="stat-card relative overflow-hidden rounded-2xl p-6 shadow-sm">
        <div className="absolute top-0 right-0 h-40 w-40 rounded-full bg-blue-500/10 blur-3xl pointer-events-none" />
        <div className="absolute inset-0 bg-gradient-to-br from-sd-bg/60 to-sd-s1 z-0 pointer-events-none" />
        
        <div className="relative z-10">
          <div className="mb-5 flex items-end justify-between">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-widest text-sd-text3 mb-1">Total Storage Pool</p>
              <p className="font-display text-3xl tracking-tight text-sd-text">{formatBytes(totalLimit)}</p>
            </div>
            <div className="text-right">
              <p className="text-sm font-medium text-sd-text">{formatBytes(totalUsed)} used</p>
              <p className="text-xs font-medium text-sd-text3">{formatBytes(Math.max(0, totalLimit - totalUsed))} free</p>
            </div>
          </div>
          <div className="h-3 w-full overflow-hidden rounded-full bg-sd-s2 shadow-inner">
            <div
              className="progress-bar h-full rounded-full transition-all duration-700 shadow-glow-sm"
              style={{ width: `${totalLimit > 0 ? Math.min(100, (totalUsed / totalLimit) * 100) : 0}%` }}
            />
          </div>
          <div className="mt-5 flex flex-wrap gap-2.5">
            {accounts.filter((a) => a.is_connected).map((a, i) => {
              const borderColors = ["border-blue-500/30", "border-indigo-500/30", "border-violet-500/30", "border-emerald-500/30", "border-teal-500/30"];
              const dotColors = ["bg-blue-500", "bg-indigo-500", "bg-violet-500", "bg-emerald-500", "bg-teal-500"];
              const colorIdx = i % dotColors.length;
              return (
                <div key={a.account_index} className={`flex items-center gap-2 rounded-lg border ${borderColors[colorIdx]} bg-sd-s1 px-3 py-1.5 shadow-sm`}>
                  <span className={`h-1.5 w-1.5 rounded-full ${dotColors[colorIdx]} shadow-[0_0_8px_currentColor]`} />
                  <span className="text-xs font-medium text-sd-text2">{a.email ?? `Account ${a.account_index}`}</span>
                  <span className="text-xs font-mono text-sd-text3">{formatBytes(a.used)}</span>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Drive accounts section */}
      <div>
        <h2 className="mb-4 text-sm font-semibold tracking-wide text-sd-text uppercase">Google Drive Accounts</h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {accounts.map((account) => {
            const pct = account.limit > 0 ? Math.min(100, (account.used / account.limit) * 100) : 0;
            return (
              <div
                key={account.account_index}
                className={`stat-card flex flex-col justify-between rounded-2xl p-5 transition-colors ${
                  account.is_connected
                    ? "border-sd-border bg-sd-s1"
                    : "border-sd-border/50 bg-sd-bg opacity-75 grayscale-[0.2]"
                }`}
              >
                <div>
                  <div className="mb-5 flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-sd-text">
                        {account.email ?? `Account ${account.account_index}`}
                      </p>
                      <div className="mt-1.5 flex items-center gap-1.5">
                        <span className={`inline-block h-2 w-2 rounded-full shadow-[0_0_8px_currentColor] ${account.is_connected ? "bg-emerald-400 text-emerald-400" : "bg-sd-text3 text-sd-text3"}`} />
                        <span className={`text-xs font-medium ${account.is_connected ? "text-emerald-400" : "text-sd-text3"}`}>
                          {account.is_connected ? "Connected" : "Disconnected"}
                        </span>
                      </div>
                    </div>
                    <span className="flex flex-shrink-0 items-center justify-center rounded-lg border border-sd-border bg-sd-s2 px-2.5 py-1 text-[10px] font-bold text-sd-text3">
                      #{account.account_index}
                    </span>
                  </div>

                  {account.is_connected && (
                    <div className="mb-5 space-y-2">
                      <div className="flex justify-between text-[11px] font-medium text-sd-text2">
                        <span>{formatBytes(account.used)} used</span>
                        <span className={pct > 90 ? "text-rose-400" : ""}>{pct.toFixed(0)}%</span>
                      </div>
                      <div className="h-1.5 w-full overflow-hidden rounded-full bg-sd-s2">
                        <div
                          className={`h-full rounded-full transition-all shadow-glow-sm ${pct > 90 ? "bg-rose-500" : "bg-blue-500"}`}
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                      <div className="flex justify-between text-[11px] font-medium text-sd-text3">
                        <span>{formatBytes(account.free)} free</span>
                        <span>of {formatBytes(account.limit)}</span>
                      </div>
                    </div>
                  )}
                </div>

                {account.is_connected ? (
                  <button
                    onClick={() => handleAction(account.account_index, true)}
                    className="w-full rounded-xl border border-sd-border bg-sd-bg py-2.5 text-xs font-semibold tracking-wide text-sd-text2 transition hover:border-rose-500/40 hover:bg-rose-500/5 hover:text-rose-400"
                  >
                    Disconnect
                  </button>
                ) : (
                  <div className="flex gap-2">
                    <button
                      onClick={() => handleConnect(account.account_index)}
                      className="flex-1 rounded-xl bg-blue-500/10 py-2.5 text-xs font-semibold tracking-wide text-blue-400 transition hover:bg-blue-500/20"
                    >
                      Connect
                    </button>
                    <button
                      onClick={() => handleAction(account.account_index, false)}
                      className="flex items-center justify-center rounded-xl border border-sd-border bg-sd-bg px-3.5 py-2.5 text-sd-text3 transition hover:border-rose-500/40 hover:bg-rose-500/5 hover:text-rose-400"
                      title="Remove account"
                    >
                      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Credentials management */}
      <div className="stat-card rounded-2xl p-6 relative overflow-hidden border-rose-500/20 bg-rose-500/5">
        <div className="absolute top-0 right-0 h-32 w-32 rounded-full bg-rose-500/5 blur-3xl pointer-events-none" />
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 relative z-10">
          <div>
            <h2 className="text-sm font-semibold tracking-wide text-rose-400 uppercase mb-1">Stored Credentials</h2>
            <p className="text-xs font-medium text-sd-text3 max-w-md">
              Remove the Google Cloud `credentials.json` stored on the server. You will need to re-upload it to perform file operations.
            </p>
          </div>
          <button
            onClick={handleRemoveCredentials}
            className="flex items-center justify-center gap-2 rounded-xl border border-rose-500/30 bg-rose-500/10 px-5 py-2.5 text-xs font-bold text-rose-400 transition hover:bg-rose-500/20 hover:border-rose-500/50 shadow-sm shadow-rose-500/5"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 0 1-2.244 2.077H8.084a2.25 2.25 0 0 1-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 0 0-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 0 1 3.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 0 0-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 0 0-7.5 0" />
            </svg>
            Remove Credentials
          </button>
        </div>
      </div>

      {/* About section */}
      <div className="stat-card rounded-2xl p-6 relative overflow-hidden">
        <div className="absolute top-0 left-0 bottom-0 w-1 bg-gradient-to-b from-blue-500 to-indigo-500" />
        <h2 className="mb-3 text-sm font-semibold tracking-wide text-sd-text uppercase">About StitchDrive</h2>
        <p className="text-sm font-medium text-sd-text2 leading-relaxed max-w-3xl">
          StitchDrive aggregates multiple Google Drive accounts into a unified storage pool. Files are automatically routed to the account with the most available space. All data is stored in your own Google Drive accounts — StitchDrive never stores files on its own servers.
        </p>
        <div className="mt-5 flex gap-3">
          <a
            href="https://github.com/Atifhasan250/Stitch-Drive"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 rounded-xl border border-sd-border bg-sd-bg px-4 py-2.5 text-xs font-semibold text-sd-text2 transition hover:border-sd-accent/40 hover:text-sd-text hover:bg-sd-s2"
          >
            <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 24 24">
              <path d="M12 2C6.477 2 2 6.477 2 12c0 4.418 2.865 8.166 6.839 9.489.5.092.682-.217.682-.482 0-.237-.008-.866-.013-1.7-2.782.603-3.369-1.342-3.369-1.342-.454-1.155-1.11-1.462-1.11-1.462-.908-.62.069-.608.069-.608 1.003.07 1.531 1.03 1.531 1.03.892 1.529 2.341 1.087 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.11-4.555-4.943 0-1.091.39-1.984 1.029-2.683-.103-.253-.446-1.27.098-2.647 0 0 .84-.269 2.75 1.025A9.578 9.578 0 0112 6.836c.85.004 1.705.115 2.504.337 1.909-1.294 2.747-1.025 2.747-1.025.546 1.377.202 2.394.1 2.647.64.699 1.028 1.592 1.028 2.683 0 3.842-2.339 4.687-4.566 4.935.359.309.678.919.678 1.852 0 1.336-.012 2.415-.012 2.743 0 .267.18.578.688.48C19.138 20.163 22 16.418 22 12c0-5.523-4.477-10-10-10z" />
            </svg>
            View on GitHub
          </a>
        </div>
      </div>
    </div>
  );
}
