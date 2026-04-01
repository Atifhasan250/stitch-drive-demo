type Account = {
  account_index: number;
  email: string | null;
  is_connected: boolean;
  used: number;
  limit: number;
  free: number;
};

function formatBytes(bytes: number): string {
  if (bytes >= 1e9) return (bytes / 1e9).toFixed(1) + " GB";
  if (bytes >= 1e6) return (bytes / 1e6).toFixed(1) + " MB";
  return (bytes / 1e3).toFixed(0) + " KB";
}

export default function StorageBar({ accounts }: { accounts: Account[] }) {
  const totalUsed = accounts.reduce((sum, a) => sum + a.used, 0);
  const totalLimit = accounts.reduce((sum, a) => sum + a.limit, 0);
  const percent = totalLimit > 0 ? Math.min(100, (totalUsed / totalLimit) * 100) : 0;

  return (
    <div className="rounded-xl border border-[#21212b] bg-[#15151a] p-5">
      <div className="mb-3 flex items-end justify-between">
        <span className="text-2xl font-semibold text-white">{formatBytes(totalUsed)}</span>
        <span className="text-sm text-[#555568]">of {formatBytes(totalLimit)} used</span>
      </div>

      <div className="h-2 w-full overflow-hidden rounded-full bg-[#21212b]">
        <div
          className="h-full rounded-full bg-indigo-500 transition-all duration-700"
          style={{ width: `${percent}%` }}
        />
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {accounts
          .filter((a) => a.is_connected)
          .map((a) => {
            const pct = a.limit > 0 ? Math.min(100, (a.used / a.limit) * 100) : 0;
            return (
              <div key={a.account_index} className="space-y-1.5">
                <div className="flex justify-between text-xs">
                  <span className="truncate text-[#8888a4]">{a.email ?? `Account ${a.account_index}`}</span>
                  <span className="text-[#555568]">{pct.toFixed(0)}%</span>
                </div>
                <div className="h-1 w-full overflow-hidden rounded-full bg-[#21212b]">
                  <div
                    className="h-full rounded-full bg-indigo-500/60"
                    style={{ width: `${pct}%` }}
                  />
                </div>
              </div>
            );
          })}
      </div>
    </div>
  );
}
