"use client";

import Link from "next/link";
import { useTheme } from "@/contexts/ThemeContext";

const steps = [
  { id: "gcp",         num: "01", title: "Get Your Keys (Crucial)",          color: "text-rose-400",    accent: "border-rose-500/40" },
  { id: "signup",      num: "02", title: "Create Your Account",              color: "text-violet-400",  accent: "border-violet-500/40" },
  { id: "initialize",  num: "03", title: "Initialize the App",               color: "text-emerald-400", accent: "border-emerald-500/40" },
  { id: "connect",     num: "04", title: "Connect Google Accounts",          color: "text-sky-400",     accent: "border-sky-500/40" },
];

function Card({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={`rounded-2xl border border-sd-border bg-sd-s1 p-6 shadow-sm transition hover:shadow-md ${className}`}>
      {children}
    </div>
  );
}

function Code({ children }: { children: string }) {
  return <code className="rounded-lg bg-sd-s2 px-2 py-1 text-xs text-sd-accent font-mono font-bold">{children}</code>;
}

function Note({ type, children }: { type: "critical" | "info" | "tip"; children: React.ReactNode }) {
  const styles = {
    critical: { border: "border-rose-500/30", bg: "bg-rose-500/10", text: "text-rose-400", label: "URGENT" },
    info:     { border: "border-blue-500/20", bg: "bg-blue-500/5",  text: "text-blue-400", label: "STEP" },
    tip:      { border: "border-emerald-500/20", bg: "bg-emerald-500/5", text: "text-emerald-400", label: "PRO TIP" },
  }[type];
  return (
    <div className={`rounded-2xl border ${styles.border} ${styles.bg} p-5 my-4 relative overflow-hidden`}>
      {type === "critical" && <div className="absolute top-0 left-0 h-1 w-full bg-rose-500/50" />}
      <div className="flex items-center gap-2 mb-1">
        <span className={`text-[10px] font-black uppercase tracking-widest ${styles.text}`}>{styles.label}</span>
      </div>
      <div className="text-sm text-sd-text2 leading-relaxed font-medium">{children}</div>
    </div>
  );
}

export default function UserGuidePage() {
  const { theme, toggle } = useTheme();

  return (
    <div className="min-h-screen bg-sd-bg text-sd-text selection:bg-sd-accent/20 pb-20">
      {/* ── Header ─────────────────────────────────────────── */}
      <nav className="sticky top-0 z-50 border-b border-sd-border bg-sd-bg/80 backdrop-blur-xl">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-4">
          <Link href="/" className="flex items-center gap-3">
            <div className="relative flex h-8 w-8 items-center justify-center rounded-lg overflow-hidden shadow-lg shadow-sd-accent/10">
              <div className="absolute inset-0 bg-gradient-accent" />
              <svg className="relative h-4 w-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <circle cx="9" cy="10" r="3.5" strokeLinecap="round" />
                <circle cx="15" cy="14" r="3.5" strokeLinecap="round" />
                <path d="M11.5 7.5 L12.5 16.5" strokeLinecap="round" strokeOpacity={0.6} />
              </svg>
            </div>
            <span className="text-sm font-black tracking-tight text-sd-text">StitchDrive</span>
          </Link>
          <div className="flex items-center gap-3">
            <button onClick={toggle} className="flex h-8 w-8 items-center justify-center rounded-lg border border-sd-border text-sd-text3 hover:bg-sd-s2 hover:text-sd-text transition">
              {theme === "dark" ? (
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 3v2.25m6.364.386-1.591 1.591M21 12h-2.25m-.386 6.364-1.591-1.591M12 18.75V21m-4.773-4.227-1.591 1.591M5.25 12H3m4.227-4.773L5.636 5.636M15.75 12a3.75 3.75 0 1 1-7.5 0 3.75 3.75 0 0 1 7.5 0Z" /></svg>
              ) : (
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M21.752 15.002A9.72 9.72 0 0 1 18 15.75c-5.385 0-9.75-4.365-9.75-9.75 0-1.33.266-2.597.748-3.752A9.753 9.753 0 0 0 3 11.25C3 16.635 7.365 21 12.75 21a9.753 9.753 0 0 0 9.002-5.998Z" /></svg>
              )}
            </button>
            <Link href="/login" className="btn-primary rounded-xl px-4 py-1.5 text-xs font-bold">Open App</Link>
          </div>
        </div>
      </nav>

      {/* ── Hero ───────────────────────────────────────────── */}
      <header className="mx-auto max-w-4xl px-6 py-20 text-center">
        <h1 className="font-display mb-6 text-5xl text-sd-text md:text-6xl font-black tracking-tighter">
          Master the <span className="gradient-text">Stitch Flow</span>
        </h1>
        <p className="text-xl text-sd-text2 font-medium max-w-2xl mx-auto leading-relaxed">
          Getting started is easy once you have your keys. Follow this manual to turn your Gmail accounts into a massive storage pool.
        </p>
      </header>

      {/* ── Main Guide ─────────────────────────────────────── */}
      <main className="mx-auto max-w-3xl px-6 space-y-16">
        
        {/* Step 1: The Credentials (CRITICAL) */}
        <section id="gcp" className="scroll-mt-24">
          <div className="flex items-center gap-4 mb-8">
            <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-rose-500/10 text-rose-400 font-mono font-black text-lg shadow-inner ring-1 ring-rose-500/20 animate-pulse">01</span>
            <h2 className="text-3xl font-black tracking-tight text-sd-text">Obtain Your Credentials</h2>
          </div>
          
          <Card className="ring-2 ring-rose-500/10 scale-[1.02]">
            <Note type="critical">
              This is the MOST important step. The app WILL NOT work without this file. It acts as the "Passport" for StitchDrive to talk to Google.
            </Note>
            <div className="space-y-6 mt-6">
              <div className="space-y-3">
                <p className="text-sm font-bold text-sd-text flex items-center gap-2">
                  <span className="h-4 w-4 rounded-full bg-sd-accent2/20 flex items-center justify-center text-[10px]">A</span>
                  Go to the Google Cloud Console
                </p>
                <p className="text-sm text-sd-text2 pl-6">
                  Visit <a href="https://console.cloud.google.com" target="_blank" rel="noopener noreferrer" className="text-sd-accent font-bold hover:underline">console.cloud.google.com</a> and create a new project called "My Drive Pool".
                </p>
              </div>

              <div className="space-y-3">
                <p className="text-sm font-bold text-sd-text flex items-center gap-2">
                  <span className="h-4 w-4 rounded-full bg-sd-accent2/20 flex items-center justify-center text-[10px]">B</span>
                  Enable the Drive API
                </p>
                <p className="text-sm text-sd-text2 pl-6">
                  Search for **"Google Drive API"** in the top bar and click **Enable**.
                </p>
              </div>

              <div className="space-y-3">
                <p className="text-sm font-bold text-sd-text flex items-center gap-2">
                  <span className="h-4 w-4 rounded-full bg-sd-accent2/20 flex items-center justify-center text-[10px]">C</span>
                  Configure User Consent
                </p>
                <p className="text-sm text-sd-text2 pl-6">
                  Go to **OAuth Consent Screen**. Choose **External**. Add your own email as a **Test User** (Important!).
                </p>
              </div>

              <div className="space-y-3">
                <p className="text-sm font-bold text-sd-text flex items-center gap-2">
                  <span className="h-4 w-4 rounded-full bg-sd-accent2/20 flex items-center justify-center text-[10px]">D</span>
                  Create Your Client ID
                </p>
                <ul className="text-sm text-sd-text2 pl-6 space-y-2 list-disc list-inside">
                  <li>Go to **Credentials** &rarr; **Create Credentials** &rarr; **OAuth Client ID**.</li>
                  <li>Application type: **Web Application**.</li>
                  <li>In **Authorized Redirect URIs**, paste exactly: <Code>http://localhost:8000/api/accounts/oauth/callback</Code></li>
                </ul>
              </div>

              <div className="pt-4 border-t border-sd-border">
                <p className="text-sm text-sd-text font-black uppercase text-center tracking-widest text-rose-400">Download the JSON file</p>
                <p className="text-xs text-sd-text3 text-center mt-1">Keep this file—StitchDrive will ask for it in Step 03.</p>
              </div>
            </div>
          </Card>
        </section>

        {/* Step 2: Login */}
        <section id="signup">
          <div className="flex items-center gap-4 mb-8">
            <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-violet-500/10 text-violet-400 font-mono font-black text-lg shadow-inner ring-1 ring-violet-500/20">02</span>
            <h2 className="text-3xl font-black tracking-tight text-sd-text">Sign Up or Login</h2>
          </div>
          <Card>
            <p className="text-sm text-sd-text2 mb-4 leading-relaxed">
              Open the StitchDrive home page and click **Login** or **Get Started**. We use secure authentication so your storage pool remains personal and private.
            </p>
            <Note type="info">
              You can use your Google account, GitHub, or just your Email to log in.
            </Note>
          </Card>
        </section>

        {/* Step 3: Initialize */}
        <section id="initialize">
          <div className="flex items-center gap-4 mb-8">
            <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-emerald-500/10 text-emerald-400 font-mono font-black text-lg shadow-inner ring-1 ring-emerald-500/20">03</span>
            <h2 className="text-3xl font-black tracking-tight text-sd-text">Initialize the App</h2>
          </div>
          <Card>
            <p className="text-sm text-sd-text2 leading-relaxed mb-6">
              The first time you enter the dashboard, the app will ask for your **Credentials**. This is where you use the file from Step 01.
            </p>
            <div className="rounded-xl border-2 border-dashed border-sd-border p-8 text-center bg-sd-bg/50 group hover:border-sd-accent/40 transition-colors">
              <svg className="h-8 w-8 text-sd-text3 mx-auto mb-3 group-hover:scale-110 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
              </svg>
              <p className="text-xs font-bold text-sd-text3 uppercase">Drag & Drop your <span className="text-sd-text">credentials.json</span> here</p>
            </div>
            <Note type="tip">
              This initialization only happens once. The uploaded credentials are encrypted and stored server-side for your account.
            </Note>
          </Card>
        </section>

        {/* Step 4: Connect */}
        <section id="connect">
          <div className="flex items-center gap-4 mb-8">
            <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-sky-500/10 text-sky-400 font-mono font-black text-lg shadow-inner ring-1 ring-sky-500/20">04</span>
            <h2 className="text-3xl font-black tracking-tight text-sd-text">Stitch Your Drives</h2>
          </div>
          <Card>
            <p className="text-sm text-sd-text2 leading-relaxed mb-6">
              Now the fun part. Go to **Settings** and start connecting your Google accounts. 
            </p>
            <div className="space-y-4">
              <div className="flex gap-4 items-start">
                <div className="h-6 w-6 rounded-lg bg-sd-accent/20 flex items-center justify-center text-sd-accent text-[10px] font-black shrink-0">1</div>
                <p className="text-sm text-sd-text2">Connect your main primary account.</p>
              </div>
              <div className="flex gap-4 items-start">
                <div className="h-6 w-6 rounded-lg bg-sd-accent/20 flex items-center justify-center text-sd-accent text-[10px] font-black shrink-0">2</div>
                <p className="text-sm text-sd-text2">Connect secondary, backup, or burner accounts.</p>
              </div>
              <div className="flex gap-4 items-start">
                <div className="h-6 w-6 rounded-lg bg-sd-accent/20 flex items-center justify-center text-sd-accent text-[10px] font-black shrink-0">3</div>
                <p className="text-sm text-sd-text2">Watch your total storage pool grow! (10 accounts = 150GB).</p>
              </div>
            </div>
          </Card>
        </section>

        {/* Final CTA */}
        <section className="pt-10 text-center">
            <h3 className="text-2xl font-black text-sd-text mb-4 tracking-tight">Ready to begin?</h3>
            <Link href="/login" className="btn-primary inline-flex items-center gap-2 rounded-2xl px-10 py-5 font-black shadow-xl shadow-sd-accent/30 hover:scale-105 transition-transform">
                Go to the Dashboard
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5 21 12m0 0-7.5 7.5M21 12H3" />
                </svg>
            </Link>
            <p className="text-xs text-sd-text3 mt-6">Open source. Free. Private.</p>
        </section>

      </main>
    </div>
  );
}
