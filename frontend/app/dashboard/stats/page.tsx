"use client";

import { useEffect, useState } from "react";
import { useFiles } from "@/hooks/useFiles";
import { useStorage } from "@/hooks/useStorage";
import {
  type CachedStats,
  computeStats,
  getCachedStats,
  isStatsDirty,
  setCachedStats,
} from "@/hooks/useStats";
import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  Cell,
  PieChart,
  Pie,
  Tooltip,
  XAxis,
  YAxis,
  CartesianGrid,
  ResponsiveContainer,
} from "recharts";
import { formatBytes } from "@/lib/utils";



const TYPE_COLORS: Record<string, string> = {
  Images: "#a855f7",        // purple-500
  Videos: "#3b82f6",        // blue-500
  Audio: "#ec4899",         // pink-500
  PDFs: "#f43f5e",          // rose-500
  Documents: "#0ea5e9",     // sky-500
  Spreadsheets: "#10b981",  // emerald-500
  Presentations: "#6366f1", // indigo-500
  Folders: "#f59e0b",       // amber-500
  Archives: "#8b5cf6",      // violet-500
  Other: "#64748b",         // slate-500
};

const ACCOUNT_COLORS = ["#3b82f6", "#6366f1", "#8b5cf6", "#10b981", "#14b8a6"];

const TOOLTIP_WRAPPER: React.CSSProperties = {
  background: "none",
  border: "none",
  boxShadow: "none",
  padding: 0,
  outline: "none",
};

function CustomTooltip({ active, payload, label, formatter }: {
  active?: boolean;
  payload?: { name: string; value: number; color: string }[];
  label?: string;
  formatter?: (val: number) => string;
}) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-xl border border-sd-border bg-sd-s1/90 backdrop-blur-md px-4 py-3 shadow-card text-xs">
      {label && <p className="mb-2 font-display text-sm tracking-wide text-sd-text">{label}</p>}
      {payload.map((p, i) => (
        <div key={i} className="flex items-center gap-2 mb-1 last:mb-0">
          <span className="h-2 w-2 rounded-full" style={{ backgroundColor: p.color }} />
          <span className="text-sd-text2 font-medium">{p.name}:</span>
          <span className="font-semibold text-sd-text font-mono">{formatter ? formatter(p.value) : p.value}</span>
        </div>
      ))}
    </div>
  );
}

export default function StatsPage() {
  const { files } = useFiles();
  const { accounts } = useStorage();
  const [stats, setStats] = useState<CachedStats | null>(null);
  const [fromCache, setFromCache] = useState(false);

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

  function forceRefresh() {
    const fresh = computeStats(files, accounts);
    setCachedStats(fresh);
    setStats(fresh);
    setFromCache(false);
  }

  if (!stats) {
    return (
      <div className="flex items-center justify-center py-32 animate-fade-up">
        <div className="text-center bg-sd-s1 border border-sd-border rounded-2xl p-8 shadow-sm">
          <div className="mx-auto mb-4 h-10 w-10 animate-spin rounded-full border-4 border-sd-s2 border-t-sd-accent shadow-[0_0_15px_rgba(59,130,246,0.5)]" />
          <p className="text-sm font-semibold tracking-wide text-sd-text uppercase">Loading statistics…</p>
          <p className="mt-1 text-xs text-sd-text3">Computing local data</p>
        </div>
      </div>
    );
  }

  const pieData = Object.entries(stats.filesByType)
    .filter(([, v]) => v > 0)
    .sort(([, a], [, b]) => b - a)
    .map(([name, value]) => ({ name, value }));

  const connectedAccounts = accounts.filter((a) => a.is_connected);
  const storageData = connectedAccounts.map((a) => ({
    name: a.email ? a.email.split("@")[0] : `Acct ${a.account_index}`,
    used: a.used,
    free: a.free,
  }));

  return (
    <div className="space-y-6 animate-fade-up">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl text-sd-text">Analytics</h1>
          <p className="mt-1.5 text-sm font-medium text-sd-text2 flex items-center gap-2">
            Storage usage and upload trends
            {fromCache && (
              <span className="inline-flex items-center gap-1.5 rounded-lg border border-sd-border bg-sd-s1 px-2 py-0.5 text-[10px] uppercase font-bold tracking-wider text-sd-text3 shadow-sm">
                <span className="h-1.5 w-1.5 rounded-full bg-sd-accent animate-pulse" />
                Cached
              </span>
            )}
          </p>
        </div>
        <button
          onClick={forceRefresh}
          className="flex items-center gap-1.5 rounded-xl border border-sd-border bg-sd-s1 px-4 py-2 text-xs font-semibold text-sd-text2 transition hover:bg-sd-s2 hover:text-sd-text hover:border-sd-accent/30 shadow-sm"
        >
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0 3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182m0-4.991v4.99" />
          </svg>
          Refresh Data
        </button>
      </div>

      {/* Summary chips */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        {[
          { label: "Total Files", value: stats.totalFiles.toLocaleString(), color: "text-blue-400", bg: "bg-blue-500/10", border: "border-blue-500/20" },
          { label: "Total Folders", value: stats.totalFolders.toLocaleString(), color: "text-indigo-400", bg: "bg-indigo-500/10", border: "border-indigo-500/20" },
          { label: "Total Size", value: formatBytes(stats.totalSize), color: "text-violet-400", bg: "bg-violet-500/10", border: "border-violet-500/20" },
          { label: "Accounts", value: connectedAccounts.length.toString(), color: "text-emerald-400", bg: "bg-emerald-500/10", border: "border-emerald-500/20" },
        ].map((item) => (
          <div key={item.label} className={`stat-card rounded-2xl p-5 border ${item.border}`}>
            <div className={`mb-3 inline-flex rounded-lg px-2.5 py-1 ${item.bg}`}>
              <p className="text-[10px] font-bold uppercase tracking-widest text-sd-text3">{item.label}</p>
            </div>
            <p className={`font-display text-3xl tracking-tight ${item.color}`}>{item.value}</p>
          </div>
        ))}
      </div>

      {/* Weekly uploads */}
      <div className="stat-card rounded-2xl p-6 shadow-sm overflow-hidden relative">
        <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-sd-accent/30 to-transparent" />
        <h2 className="mb-6 text-sm font-semibold tracking-wide text-sd-text uppercase">Weekly Upload Activity</h2>
        <ResponsiveContainer width="100%" height={220}>
          <AreaChart data={stats.weeklyUploads} margin={{ top: 10, right: 10, left: -25, bottom: 0 }}>
            <defs>
              <linearGradient id="uploadGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.4} />
                <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--sd-border)" vertical={false} />
            <XAxis dataKey="date" tick={{ fontSize: 11, fill: "var(--sd-text3)" }} axisLine={false} tickLine={false} tickMargin={12} />
            <YAxis tick={{ fontSize: 11, fill: "var(--sd-text3)", fontWeight: 500 }} axisLine={false} tickLine={false} allowDecimals={false} />
            <Tooltip
              content={<CustomTooltip />}
              wrapperStyle={TOOLTIP_WRAPPER}
              cursor={{ stroke: 'var(--sd-border2)', strokeWidth: 1, strokeDasharray: '4 4' }}
            />
            <Area type="monotone" dataKey="count" name="Uploads" stroke="#3b82f6" strokeWidth={3} fill="url(#uploadGrad)" activeDot={{ r: 6, strokeWidth: 0, fill: '#3b82f6' }} />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      {/* Storage + pie */}
      <div className="grid gap-4 lg:grid-cols-2">
        <div className="stat-card rounded-2xl p-6 shadow-sm relative overflow-hidden">
          <div className="absolute top-0 right-0 p-8 h-40 w-40 bg-sd-accent/5 blur-3xl rounded-full pointer-events-none" />
          <h2 className="mb-6 text-sm font-semibold tracking-wide text-sd-text uppercase relative z-10">Storage by Account</h2>
          {storageData.length === 0 ? (
            <p className="py-12 text-center text-sm font-medium text-sd-text3 relative z-10">No connected accounts</p>
          ) : (
            <ResponsiveContainer width="100%" height={240}>
              <BarChart data={storageData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }} barSize={40}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--sd-border)" vertical={false} />
                <XAxis dataKey="name" tick={{ fontSize: 11, fill: "var(--sd-text3)" }} axisLine={false} tickLine={false} tickMargin={12} />
                <YAxis tick={{ fontSize: 11, fill: "var(--sd-text3)", fontWeight: 500 }} axisLine={false} tickLine={false} tickFormatter={(v) => formatBytes(v)} />
                <Tooltip
                  content={<CustomTooltip formatter={formatBytes} />}
                  wrapperStyle={TOOLTIP_WRAPPER}
                  cursor={{ fill: 'var(--sd-s2)', opacity: 0.5 }}
                />
                <Bar dataKey="used" name="Used" stackId="a" radius={[0, 0, 6, 6]}>
                  {storageData.map((_, i) => (
                    <Cell key={i} fill={ACCOUNT_COLORS[i % ACCOUNT_COLORS.length]} />
                  ))}
                </Bar>
                <Bar dataKey="free" name="Free" stackId="a" fill="var(--sd-s2)" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>

        <div className="stat-card rounded-2xl p-6 shadow-sm overflow-hidden">
          <h2 className="mb-5 text-sm font-semibold tracking-wide text-sd-text uppercase">Files Breakdown</h2>
          {pieData.length === 0 ? (
            <p className="py-16 text-center text-sm font-medium text-sd-text3">No files yet</p>
          ) : (
            <div className="flex flex-col sm:flex-row items-center gap-6">
              <ResponsiveContainer width="100%" height={210} className="sm:w-1/2">
                <PieChart>
                  <Pie
                    data={pieData}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={95}
                    paddingAngle={3}
                    dataKey="value"
                    stroke="none"
                    cornerRadius={4}
                  >
                    {pieData.map((entry, i) => (
                      <Cell key={i} fill={TYPE_COLORS[entry.name] ?? "#64748b"} />
                    ))}
                  </Pie>
                  <Tooltip content={<CustomTooltip />} wrapperStyle={TOOLTIP_WRAPPER} />
                </PieChart>
              </ResponsiveContainer>
              <div className="flex-1 space-y-2.5 w-full sm:w-auto overflow-y-auto max-h-[200px] pr-2">
                {pieData.map((entry) => (
                  <div key={entry.name} className="flex items-center justify-between gap-3 group">
                    <div className="flex items-center gap-2">
                      <span className="h-2 w-2 flex-shrink-0 rounded-full" style={{ backgroundColor: TYPE_COLORS[entry.name] ?? "#64748b" }} />
                      <span className="truncate text-sm font-medium text-sd-text2 group-hover:text-sd-text transition">{entry.name}</span>
                    </div>
                    <span className="flex-shrink-0 text-sm font-mono font-medium text-sd-text">{entry.value.toLocaleString()}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Size by type */}
      {Object.keys(stats.sizeByType).length > 0 && (
        <div className="stat-card rounded-2xl p-6 shadow-sm">
          <h2 className="mb-6 text-sm font-semibold tracking-wide text-sd-text uppercase">Storage Format Usage</h2>
          <div className="space-y-4">
            {Object.entries(stats.sizeByType)
              .sort(([, a], [, b]) => b - a)
              .map(([type, size]) => {
                const pct = stats.totalSize > 0 ? (size / stats.totalSize) * 100 : 0;
                return (
                  <div key={type} className="group">
                    <div className="mb-1.5 flex items-center justify-between text-xs font-medium">
                      <span className="text-sd-text2 group-hover:text-sd-text transition flex items-center gap-2">
                        <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: TYPE_COLORS[type] ?? "#64748b" }} />
                        {type}
                      </span>
                      <span className="text-sd-text3 font-mono">
                        {formatBytes(size)} <span className="opacity-50 mx-1">/</span> <span className="text-sd-text2">{pct.toFixed(1)}%</span>
                      </span>
                    </div>
                    <div className="h-2 w-full overflow-hidden rounded-full bg-sd-s2">
                      <div
                        className="h-full rounded-full transition-all shadow-glow-sm"
                        style={{ width: `${pct}%`, backgroundColor: TYPE_COLORS[type] ?? "#64748b" }}
                      />
                    </div>
                  </div>
                );
              })}
          </div>
        </div>
      )}
    </div>
  );
}
