export default function Loading() {
  return (
    <div className="h-full space-y-6 animate-pulse">
      {/* Header Skeleton */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="space-y-2">
          <div className="h-8 w-48 rounded-lg bg-sd-border/30" />
          <div className="h-4 w-64 rounded-md bg-sd-border/20" />
        </div>
        <div className="h-10 w-32 rounded-xl bg-sd-border/30" />
      </div>

      {/* Stats Cards Skeleton */}
      <div className="grid grid-cols-2 gap-4 xl:grid-cols-4">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="stat-card h-32 rounded-2xl p-5" />
        ))}
      </div>

      {/* Middle Section Skeleton */}
      <div className="grid gap-4 lg:grid-cols-5">
        <div className="lg:col-span-3 rounded-2xl border border-sd-border bg-sd-s1/50 p-6 h-[300px]" />
        <div className="lg:col-span-2 rounded-2xl border border-sd-border bg-sd-s1/50 p-6 h-[300px]" />
      </div>

      {/* Table/List Skeleton */}
      <div className="rounded-2xl border border-sd-border bg-sd-s1/50 overflow-hidden">
        <div className="h-14 border-b border-sd-border bg-sd-s2/30" />
        <div className="p-6 space-y-4">
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="flex items-center gap-4">
              <div className="h-10 w-10 rounded-lg bg-sd-border/30" />
              <div className="flex-1 space-y-2">
                <div className="h-4 w-1/3 rounded bg-sd-border/30" />
                <div className="h-3 w-1/4 rounded bg-sd-border/20" />
              </div>
              <div className="h-4 w-16 rounded bg-sd-border/20" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
