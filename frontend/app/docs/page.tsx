"use client";

import Link from "next/link";
import { useTheme } from "@/contexts/ThemeContext";

const steps = [
  { id: "clone",       num: "01", title: "Clone the Repository",             color: "text-blue-400",    accent: "border-blue-500/40" },
  { id: "clerk",       num: "02", title: "Clerk Authentication Setup",       color: "text-violet-400",  accent: "border-violet-500/40" },
  { id: "gcp",         num: "03", title: "Google Cloud Platform Setup",      color: "text-emerald-400", accent: "border-emerald-500/40" },
  { id: "env",         num: "04", title: "Environment Configuration",       color: "text-sky-400",     accent: "border-sky-500/40" },
  { id: "backend",     num: "05", title: "Start the Backend",                color: "text-teal-400",    accent: "border-teal-500/40" },
  { id: "frontend",    num: "06", title: "Start the Frontend",               color: "text-pink-400",    accent: "border-pink-500/40" },
  { id: "initialize",  num: "07", title: "Initialize via Dashboard",         color: "text-amber-400",   accent: "border-amber-500/40" },
  { id: "connect",     num: "08", title: "Connect Drive Accounts",           color: "text-emerald-400", accent: "border-emerald-500/40" },
];

function Code({ children }: { children: string }) {
  return <code className="rounded-lg bg-sd-s2 px-1.5 py-0.5 text-xs text-sd-accent font-mono">{children}</code>;
}

function Block({ label, children }: { label?: string; children: string }) {
  return (
    <div className="rounded-xl border border-sd-border bg-sd-bg overflow-hidden shadow-sm">
      {label && <div className="border-b border-sd-border px-4 py-2 text-[10px] font-semibold uppercase tracking-wider text-sd-text3 bg-sd-s1">{label}</div>}
      <pre className="overflow-x-auto px-4 py-4 text-sm text-emerald-400 font-mono leading-relaxed"><code>{children}</code></pre>
    </div>
  );
}

function Note({ type, children }: { type: "info" | "warn" | "tip"; children: React.ReactNode }) {
  const styles = {
    info: { border: "border-blue-500/20", bg: "bg-blue-500/5",    text: "text-blue-400",    label: "Note" },
    warn: { border: "border-amber-500/20", bg: "bg-amber-500/5",  text: "text-amber-400",   label: "Important" },
    tip:  { border: "border-emerald-500/20", bg: "bg-emerald-500/5", text: "text-emerald-400", label: "Tip" },
  }[type];
  return (
    <div className={`rounded-xl border ${styles.border} ${styles.bg} p-4`}>
      <span className={`text-xs font-bold ${styles.text}`}>{styles.label} — </span>
      <span className="text-xs text-sd-text2 leading-relaxed">{children}</span>
    </div>
  );
}

function NumberedList({ items }: { items: React.ReactNode[] }) {
  return (
    <ol className="space-y-4">
      {items.map((item, i) => (
        <li key={i} className="flex gap-4 text-sm text-sd-text2 group">
          <span className="mt-1 flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-sd-s3 text-[10px] font-bold text-sd-text3 group-hover:bg-sd-accent group-hover:text-white transition-colors duration-300">{i + 1}</span>
          <span className="leading-7">{item}</span>
        </li>
      ))}
    </ol>
  );
}

function StepHeader({ num, color, accent, title }: { num: string; color: string; accent: string; title: string }) {
  return (
    <div className={`mb-8 flex items-center gap-5 border-l-4 ${accent} pl-6 py-1`}>
      <span className={`font-mono text-sm font-bold tabular-nums ${color}`}>{num}</span>
      <h2 className="text-2xl font-bold text-sd-text tracking-tight">{title}</h2>
    </div>
  );
}

export default function DocsPage() {
  const { theme, toggle } = useTheme();

  return (
    <div className="min-h-screen bg-sd-bg text-sd-text selection:bg-sd-accent/20">
      {/* Navbar */}
      <nav className="sticky top-0 z-50 border-b border-sd-border bg-sd-bg/85 backdrop-blur-xl">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3 sm:px-6">
          <Link href="/" className="flex items-center gap-3 transition hover:opacity-80">
            <div className="relative flex h-8 w-8 items-center justify-center rounded-lg overflow-hidden shadow-lg shadow-sd-accent/10">
              <div className="absolute inset-0 bg-gradient-accent" />
              <svg className="relative h-4 w-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <circle cx="9" cy="10" r="3.5" strokeLinecap="round" />
                <circle cx="15" cy="14" r="3.5" strokeLinecap="round" />
                <path d="M11.5 7.5 L12.5 16.5" strokeLinecap="round" strokeOpacity={0.6} />
              </svg>
            </div>
            <span className="text-sm font-bold tracking-tight text-sd-text lg:inline hidden">StitchDrive</span>
            <span className="rounded-full border border-sd-border bg-sd-s1 px-2.5 py-0.5 text-[10px] font-bold text-sd-accent">v1.2</span>
          </Link>
          <div className="flex items-center gap-4">
            <button onClick={toggle} className="flex h-8 w-8 items-center justify-center rounded-lg border border-sd-border text-sd-text3 hover:bg-sd-s2 hover:text-sd-text transition shadow-sm">
              {theme === "dark"
                ? <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 3v2.25m6.364.386-1.591 1.591M21 12h-2.25m-.386 6.364-1.591-1.591M12 18.75V21m-4.773-4.227-1.591 1.591M5.25 12H3m4.227-4.773L5.636 5.636M15.75 12a3.75 3.75 0 1 1-7.5 0 3.75 3.75 0 0 1 7.5 0Z" /></svg>
                : <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M21.752 15.002A9.72 9.72 0 0 1 18 15.75c-5.385 0-9.75-4.365-9.75-9.75 0-1.33.266-2.597.748-3.752A9.753 9.753 0 0 0 3 11.25C3 16.635 7.365 21 12.75 21a9.753 9.753 0 0 0 9.002-5.998Z" /></svg>
              }
            </button>
            <Link href="/login" className="btn-primary rounded-lg px-4 py-1.5 text-xs font-bold shadow-lg shadow-sd-accent/20">Dashboard</Link>
          </div>
        </div>
      </nav>

      <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6">
        {/* Hero Section */}
        <div className="mb-20 max-w-3xl">
          <div className="mb-6 inline-flex items-center gap-2.5 rounded-full border border-sd-accent/30 bg-sd-accent/5 px-4 py-1.5">
            <span className="h-2 w-2 animate-pulse rounded-full bg-sd-accent" />
            <span className="text-xs font-bold uppercase tracking-widest text-sd-accent">Modernized Setup</span>
          </div>
          <h1 className="font-display mb-6 text-5xl text-sd-text md:text-7xl font-extrabold leading-tight tracking-tighter">
            Seamlessly Pooled.<br />
            <span className="gradient-text">Developer Ready.</span>
          </h1>
          <p className="text-xl leading-relaxed text-sd-text2 font-medium max-w-2xl">
            Everything you need to set up <strong className="text-sd-text">StitchDrive</strong> on your local machine. From Clerk authentication to Google Drive API pooling.
          </p>
          <div className="mt-10 flex flex-wrap gap-3">
            {["Node.js 18+", "MongoDB Atlas", "Clerk App", "Google Account"].map(p => (
              <span key={p} className="rounded-xl border border-sd-border bg-sd-s1 px-4 py-2 text-xs font-bold text-sd-text2 shadow-sm">{p}</span>
            ))}
          </div>
        </div>

        <div className="flex flex-col lg:flex-row gap-16">
          {/* Sidebar Navigation */}
          <aside className="hidden lg:block w-64 flex-shrink-0">
            <div className="sticky top-24 border-l border-sd-border pl-6 space-y-8">
              <div>
                <p className="mb-4 text-[10px] font-black uppercase tracking-[0.2em] text-sd-text3">The Workflow</p>
                <nav className="space-y-2">
                  {steps.map(s => (
                    <a key={s.id} href={`#${s.id}`} className="group flex items-center justify-between rounded-xl px-3 py-2 text-sm text-sd-text2 hover:bg-sd-s1 transition-all duration-300">
                      <span className="group-hover:text-sd-text">{s.title}</span>
                      <span className={`font-mono text-[10px] font-bold tabular-nums ${s.color}`}>{s.num}</span>
                    </a>
                  ))}
                </nav>
              </div>
              <div className="space-y-4">
                <p className="text-[10px] font-black uppercase tracking-[0.2em] text-sd-text3">Resources</p>
                <div className="space-y-2">
                  <a href="#faq" className="block text-sm text-sd-text3 hover:text-sd-accent transition">FAQ</a>
                  <a href="#troubleshooting" className="block text-sm text-sd-text3 hover:text-sd-accent transition">Common Issues</a>
                  <a href="https://github.com/Atifhasan250/stitch-drive" target="_blank" className="block text-sm text-sd-text3 hover:text-sd-accent transition">GitHub Repo</a>
                </div>
              </div>
            </div>
          </aside>

          {/* Setup Documentation Content */}
          <div className="min-w-0 flex-1 space-y-24">
            {/* Step 01 */}
            <section id="clone">
              <StepHeader num="01" color="text-blue-400" accent="border-blue-500/40" title="Clone the Repository" />
              <div className="space-y-6">
                <p className="text-base leading-relaxed text-sd-text2">Begin by cloning the <strong className="text-sd-text">stitch-drive</strong> repository to your local development environment.</p>
                <Block label="Shell">{`git clone https://github.com/Atifhasan250/stitch-drive.git\ncd stitch-drive`}</Block>
                <Note type="info">Ensure you have <strong className="text-sd-text">Git</strong> installed and configured on your system.</Note>
              </div>
            </section>

            {/* Step 02 */}
            <section id="clerk">
              <StepHeader num="02" color="text-violet-400" accent="border-violet-500/40" title="Clerk Authentication Setup" />
              <div className="space-y-6">
                <p className="text-base leading-relaxed text-sd-text2">StitchDrive uses <strong className="text-sd-text">Clerk</strong> for enterprise-grade authentication. It's free for individual developers.</p>
                <NumberedList items={[
                  <>Sign up at <a href="https://clerk.com" className="text-sd-accent font-bold hover:underline">clerk.com</a> and create a new application.</>,
                  <>Enable <strong className="text-sd-text">Email</strong> and <strong className="text-sd-text">Google</strong> (OAuth) as authentication providers.</>,
                  <>Go to <strong className="text-sd-text">API Keys</strong> in your Clerk Dashboard and copy the <Code>Publishable Key</Code> and <Code>Secret Key</Code>.</>,
                ]} />
                <Note type="warn">Keep your <Code>CLERK_SECRET_KEY</Code> strictly confidential.</Note>
              </div>
            </section>

            {/* Step 03 */}
            <section id="gcp">
              <StepHeader num="03" color="text-emerald-400" accent="border-emerald-500/40" title="Google Cloud Platform Setup" />
              <div className="space-y-6">
                <p className="text-base leading-relaxed text-sd-text2">You need a <strong className="text-sd-text">Google Cloud Project</strong> to interface with the Drive API. One project is enough for infinite accounts.</p>
                <NumberedList items={[
                  <>Visit <a href="https://console.cloud.google.com" className="text-sd-accent font-bold hover:underline">Google Cloud Console</a> and create a project named <strong className="text-sd-text">StitchDrive</strong>.</>,
                  <>Enable the <strong className="text-sd-text">Google Drive API</strong> from the API Library.</>,
                  <>Configure the <strong className="text-sd-text">OAuth Consent Screen</strong> as "External" and add your Gmail accounts as **Test Users**.</>,
                  <>Create an **OAuth Client ID** (Web App). Add <Code>http://localhost:8000/api/auth/callback</Code> as an **Authorized Redirect URI**.</>,
                  <>Download the resulting JSON file. You will upload this in Step 07.</>,
                ]} />
                <Note type="tip">Adding accounts as Test Users prevents OAuth tokens from expiring every 7 days during development.</Note>
              </div>
            </section>

            {/* Step 04 */}
            <section id="env">
              <StepHeader num="04" color="text-sky-400" accent="border-sky-500/40" title="Environment Configuration" />
              <div className="space-y-6">
                <p className="text-base leading-relaxed text-sd-text2">StitchDrive relies on environment variables for secure connectivity. Configure both the <Code>frontend</Code> and <Code>backend</Code> directories.</p>
                
                <div className="grid gap-6 md:grid-cols-2">
                  <div className="space-y-3">
                    <p className="text-xs font-black uppercase text-sd-text3">backend/.env</p>
                    <Block>{`MONGO_URI=mongodb://.../stitchdrive\nCLERK_SECRET_KEY=sk_test_...\nBACKEND_URL=http://localhost:8000\nFRONTEND_URL=http://localhost:3000`}</Block>
                  </div>
                  <div className="space-y-3">
                    <p className="text-xs font-black uppercase text-sd-text3">frontend/.env</p>
                    <Block>{`NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_...\nCLERK_SECRET_KEY=sk_test_...\nNEXT_PUBLIC_API_URL=http://localhost:8000`}</Block>
                  </div>
                </div>
                <Note type="info">For the <Code>MONGO_URI</Code>, you can use a local MongoDB instance or a free cluster on MongoDB Atlas.</Note>
              </div>
            </section>

            {/* Step 05 */}
            <section id="backend">
              <StepHeader num="05" color="text-teal-400" accent="border-teal-500/40" title="Start the Backend" />
              <div className="space-y-6">
                <p className="text-base leading-relaxed text-sd-text2">Initialize the Node.js/Express server. This handles the API requests, pooling logic, and metadata synchronization.</p>
                <Block label="Terminal 1">{`cd backend\nnpm install\nnpm run dev`}</Block>
              </div>
            </section>

            {/* Step 06 */}
            <section id="frontend">
              <StepHeader num="06" color="text-pink-400" accent="border-pink-500/40" title="Start the Frontend" />
              <div className="space-y-6">
                <p className="text-base leading-relaxed text-sd-text2">Run the Next.js development server. It communicates with the backend via the <Code>NEXT_PUBLIC_API_URL</Code> configuration.</p>
                <Block label="Terminal 2">{`cd frontend\nnpm install\nnpm run dev`}</Block>
                <Note type="info">The dashboard will be accessible at <span className="text-sd-accent font-bold">http://localhost:3000</span>.</Note>
              </div>
            </section>

            {/* Step 07 */}
            <section id="initialize">
              <StepHeader num="07" color="text-amber-400" accent="border-amber-500/40" title="Initialize via Dashboard" />
              <div className="space-y-6">
                <p className="text-base leading-relaxed text-sd-text2">Once you log in via Clerk, you'll need to provide the app with your Google Client secrets.</p>
                <NumberedList items={[
                  <>Log in at <span className="text-sd-accent font-bold">http://localhost:3000/login</span>.</>,
                  <>You will be automatically prompted to **Upload Credentials**.</>,
                  <>Drag the JSON file you downloaded from Google Cloud (Step 03) into the box.</>,
                ]} />
                <Note type="tip">These credentials are stored in your browser's <strong className="text-sd-text">LocalStorage</strong> and passed securely to the backend for OAuth flows. They never leave your environment.</Note>
              </div>
            </section>

            {/* Step 08 */}
            <section id="connect">
              <StepHeader num="08" color="text-emerald-400" accent="border-emerald-500/40" title="Connect Drive Accounts" />
              <div className="space-y-6">
                <p className="text-base leading-relaxed text-sd-text2">With credentials initialized, you can now start pooling storage accounts.</p>
                <NumberedList items={[
                  <>Navigate to **Settings** → **Account Management**.</>,
                  <>Click **"Connect another account"**.</>,
                  <>Choose any Google account from the popup and approve the permissions.</>,
                  <>Repeat for as many accounts as you want!</>,
                ]} />
                <div className="rounded-3xl border-2 border-dashed border-emerald-500/20 bg-emerald-500/5 p-10 text-center">
                  <p className="font-display text-5xl font-black text-sd-text tracking-tighter">10 × 15 GB = 150 GB</p>
                  <p className="mt-2 text-sm font-bold text-sd-text2 uppercase tracking-widest opacity-60">The Storage Pool Math</p>
                </div>
              </div>
            </section>

            {/* FAQ Section */}
            <section id="faq" className="pt-24 border-t border-sd-border">
              <h2 className="font-display mb-12 text-4xl text-sd-text font-black tracking-tighter text-center">Questions? Answers.</h2>
              <div className="grid gap-4 md:grid-cols-2">
                {[
                  { q: "How is my data secured?", a: "OAuth refresh tokens are encrypted using AES-128-CBC (Fernet compatible) before MongoDB storage. Clerk manages identity, and Google handles the physical files." },
                  { q: "Is there a limit on accounts?", a: "No. You can add as many Google accounts as you need. StitchDrive will automatically use the account with the most free space for every upload." },
                  { q: "What is the 'Sync' feature for?", a: "Since StitchDrive is a layer over Drive, clicking Sync pulls metadata for files you've uploaded directly to Drive via other devices." },
                  { q: "Can I use it for collaboration?", a: "Yes. Files shared with your connected accounts appear in the 'Shared with me' section and can be managed just like local files." },
                ].map(faq => (
                  <div key={faq.q} className="rounded-2xl border border-sd-border bg-sd-s1 p-8 hover:border-sd-accent/30 transition shadow-sm">
                    <p className="mb-3 text-lg font-bold text-sd-text">{faq.q}</p>
                    <p className="text-sm leading-relaxed text-sd-text2">{faq.a}</p>
                  </div>
                ))}
              </div>
            </section>

            {/* Troubleshooting */}
            <section id="troubleshooting" className="pt-12">
              <h2 className="font-display mb-10 text-3xl font-black text-sd-text tracking-tight">Troubleshooting</h2>
              <div className="space-y-4">
                {[
                  { q: "CORS issues in the browser", a: "Ensure the FRONTEND_URL and BACKEND_URL are correctly set in the .env files. The frontend must be on :3000 and backend on :8000 by default." },
                  { q: "Clerk 'User Not Found' or Redirect loop", a: "Verify that your Redirect URLs in the Clerk Dashboard include http://localhost:3000 and matches the env URLs." },
                  { q: "Google 'Access Blocked: Project is in Testing'", a: "Ensure the Gmail account you are trying to connect is added as a 'Test User' in the Google Cloud Console OAuth consent screen." },
                ].map(item => (
                  <div key={item.q} className="rounded-2xl border-l-4 border-amber-500/40 bg-sd-s1/50 p-6">
                    <p className="mb-2 text-sm font-black text-sd-text uppercase tracking-wider flex items-center gap-2">
                      <span className="text-amber-500 text-lg">!</span> {item.q}
                    </p>
                    <p className="text-sm leading-relaxed text-sd-text2 opacity-80">{item.a}</p>
                  </div>
                ))}
              </div>
            </section>

            {/* Footer CTA */}
            <section className="pt-24">
              <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-sd-accent/10 to-transparent p-16 text-center border border-sd-accent/20">
                <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-sd-accent to-transparent shadow-[0_0_20px_rgba(var(--accent),0.3)]" />
                <h2 className="font-display text-4xl text-sd-text font-black tracking-tighter">Everything clear?</h2>
                <p className="mt-4 text-sd-text2 text-lg font-medium opacity-70">Join the dashboard and build your storage empire today.</p>
                <div className="mt-10 flex flex-wrap justify-center gap-4">
                  <Link href="/login" className="btn-primary rounded-2xl px-10 py-5 text-sm font-black shadow-2xl shadow-sd-accent/40 hover:scale-105 transition-transform">Launch Dashboard</Link>
                  <Link href="/" className="rounded-2xl border border-sd-border bg-sd-s1 px-10 py-5 text-sm font-black hover:bg-sd-s2 transition">Return Home</Link>
                </div>
              </div>
            </section>
          </div>
        </div>
      </div>
    </div>
  );
}
