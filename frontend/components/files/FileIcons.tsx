export function FolderIcon({ size = 40 }: { size?: number }) {
  const id = `fg-${size}`;
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" fill="none">
      <defs>
        <linearGradient id={`${id}-back`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#f59e0b" />
          <stop offset="100%" stopColor="#d97706" />
        </linearGradient>
        <linearGradient id={`${id}-front`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#fde68a" />
          <stop offset="100%" stopColor="#fbbf24" />
        </linearGradient>
      </defs>
      <rect x="4" y="14" width="40" height="26" rx="3" fill={`url(#${id}-back)`} />
      <path d="M4 14h14l4 -5h2v5" fill={`url(#${id}-back)`} />
      <rect x="4" y="20" width="40" height="20" rx="3" fill={`url(#${id}-front)`} />
      <rect x="10" y="24" width="12" height="2" rx="1" fill="white" fillOpacity="0.4" />
    </svg>
  );
}

export function FileTypeIcon({ mimeType, size = 40 }: { mimeType: string | null; size?: number }) {
  const t = mimeType ?? "";
  if (t === "application/vnd.google-apps.folder") return <FolderIcon size={size} />;

  const icons: { match: (t: string) => boolean; render: () => React.ReactNode }[] = [
    {
      match: (t) => t.startsWith("image/"),
      render: () => (
        <svg width={size} height={size} viewBox="0 0 48 48" fill="none">
          <rect width="48" height="48" rx="8" fill="#ea580c" fillOpacity="0.15" />
          <rect x="10" y="12" width="28" height="24" rx="3" stroke="#fb923c" strokeWidth="2" fill="none" />
          <circle cx="19" cy="21" r="3" fill="#fb923c" />
          <path d="M10 30l8-8 6 6 4-4 10 8" stroke="#fb923c" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" fill="none" />
        </svg>
      ),
    },
    {
      match: (t) => t.startsWith("video/"),
      render: () => (
        <svg width={size} height={size} viewBox="0 0 48 48" fill="none">
          <rect width="48" height="48" rx="8" fill="#2563eb" fillOpacity="0.15" />
          <rect x="8" y="14" width="24" height="20" rx="3" stroke="#60a5fa" strokeWidth="2" fill="none" />
          <path d="M32 19l8-4v18l-8-4V19z" stroke="#60a5fa" strokeWidth="2" strokeLinejoin="round" fill="none" />
          <path d="M18 22l6 4-6 4V22z" fill="#60a5fa" />
        </svg>
      ),
    },
    {
      match: (t) => t.startsWith("audio/"),
      render: () => (
        <svg width={size} height={size} viewBox="0 0 48 48" fill="none">
          <rect width="48" height="48" rx="8" fill="#db2777" fillOpacity="0.15" />
          <circle cx="24" cy="24" r="10" stroke="#f472b6" strokeWidth="2" fill="none" />
          <circle cx="24" cy="24" r="4" fill="#f472b6" />
          <path d="M24 14v-4M24 38v-4M14 24h-4M38 24h-4" stroke="#f472b6" strokeWidth="2" strokeLinecap="round" />
        </svg>
      ),
    },
    {
      match: (t) => t.includes("pdf"),
      render: () => (
        <svg width={size} height={size} viewBox="0 0 48 48" fill="none">
          <rect width="48" height="48" rx="8" fill="#dc2626" fillOpacity="0.15" />
          <path d="M14 8h14l10 10v24a2 2 0 01-2 2H14a2 2 0 01-2-2V10a2 2 0 012-2z" stroke="#f87171" strokeWidth="2" fill="none" />
          <path d="M28 8v10h10" stroke="#f87171" strokeWidth="2" strokeLinejoin="round" fill="none" />
          <text x="15" y="34" fontFamily="monospace" fontSize="9" fontWeight="bold" fill="#f87171">PDF</text>
        </svg>
      ),
    },
    {
      match: (t) => t.includes("spreadsheet") || t.includes("sheet"),
      render: () => (
        <svg width={size} height={size} viewBox="0 0 48 48" fill="none">
          <rect width="48" height="48" rx="8" fill="#059669" fillOpacity="0.15" />
          <rect x="10" y="10" width="28" height="28" rx="3" stroke="#34d399" strokeWidth="2" fill="none" />
          <line x1="10" y1="20" x2="38" y2="20" stroke="#34d399" strokeWidth="1.5" />
          <line x1="10" y1="30" x2="38" y2="30" stroke="#34d399" strokeWidth="1.5" />
          <line x1="24" y1="10" x2="24" y2="38" stroke="#34d399" strokeWidth="1.5" />
        </svg>
      ),
    },
    {
      match: (t) => t.includes("presentation") || t.includes("slide"),
      render: () => (
        <svg width={size} height={size} viewBox="0 0 48 48" fill="none">
          <rect width="48" height="48" rx="8" fill="#d97706" fillOpacity="0.15" />
          <rect x="8" y="12" width="32" height="20" rx="3" stroke="#fbbf24" strokeWidth="2" fill="none" />
          <line x1="24" y1="32" x2="24" y2="40" stroke="#fbbf24" strokeWidth="2" />
          <line x1="18" y1="40" x2="30" y2="40" stroke="#fbbf24" strokeWidth="2" strokeLinecap="round" />
          <rect x="14" y="17" width="14" height="2" rx="1" fill="#fbbf24" fillOpacity="0.6" />
          <rect x="14" y="22" width="10" height="2" rx="1" fill="#fbbf24" fillOpacity="0.4" />
        </svg>
      ),
    },
    {
      match: (t) => t.includes("zip") || t.includes("compressed") || t.includes("archive"),
      render: () => (
        <svg width={size} height={size} viewBox="0 0 48 48" fill="none">
          <rect width="48" height="48" rx="8" fill="#ea580c" fillOpacity="0.15" />
          <rect x="14" y="8" width="20" height="32" rx="3" stroke="#fb923c" strokeWidth="2" fill="none" />
          <line x1="20" y1="8" x2="28" y2="8" stroke="#fb923c" strokeWidth="2" />
          <line x1="20" y1="16" x2="28" y2="16" stroke="#fb923c" strokeWidth="2" />
          <line x1="20" y1="24" x2="28" y2="24" stroke="#fb923c" strokeWidth="2" />
          <rect x="20" y="28" width="8" height="6" rx="1" fill="#fb923c" fillOpacity="0.5" />
        </svg>
      ),
    },
    {
      match: (t) => t.includes("javascript") || t.includes("typescript") || t.includes("json") || t.includes("xml") || t.startsWith("text/x-"),
      render: () => (
        <svg width={size} height={size} viewBox="0 0 48 48" fill="none">
          <rect width="48" height="48" rx="8" fill="#16a34a" fillOpacity="0.15" />
          <path d="M16 20l-6 4 6 4" stroke="#4ade80" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          <path d="M32 20l6 4-6 4" stroke="#4ade80" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          <path d="M26 14l-4 20" stroke="#4ade80" strokeWidth="2" strokeLinecap="round" />
        </svg>
      ),
    },
    {
      match: (t) => t.includes("document") || t.startsWith("text/"),
      render: () => (
        <svg width={size} height={size} viewBox="0 0 48 48" fill="none">
          <rect width="48" height="48" rx="8" fill="#0284c7" fillOpacity="0.15" />
          <path d="M14 8h14l10 10v24a2 2 0 01-2 2H14a2 2 0 01-2-2V10a2 2 0 012-2z" stroke="#38bdf8" strokeWidth="2" fill="none" />
          <path d="M28 8v10h10" stroke="#38bdf8" strokeWidth="2" strokeLinejoin="round" fill="none" />
          <line x1="16" y1="24" x2="32" y2="24" stroke="#38bdf8" strokeWidth="1.5" strokeLinecap="round" />
          <line x1="16" y1="29" x2="28" y2="29" stroke="#38bdf8" strokeWidth="1.5" strokeLinecap="round" />
          <line x1="16" y1="34" x2="24" y2="34" stroke="#38bdf8" strokeWidth="1.5" strokeLinecap="round" />
        </svg>
      ),
    },
  ];

  for (const icon of icons) {
    if (icon.match(t)) return <>{icon.render()}</>;
  }

  return (
    <svg width={size} height={size} viewBox="0 0 48 48" fill="none">
      <rect width="48" height="48" rx="8" fill="#475569" fillOpacity="0.15" />
      <path d="M14 8h14l10 10v24a2 2 0 01-2 2H14a2 2 0 01-2-2V10a2 2 0 012-2z" stroke="#94a3b8" strokeWidth="2" fill="none" />
      <path d="M28 8v10h10" stroke="#94a3b8" strokeWidth="2" strokeLinejoin="round" fill="none" />
    </svg>
  );
}
