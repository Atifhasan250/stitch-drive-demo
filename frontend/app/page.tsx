"use client";

import Link from "next/link";
import { useTheme } from "@/contexts/ThemeContext";

const features = [
    {
        icon: (
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M20.25 6.375c0 2.278-3.694 4.125-8.25 4.125S3.75 8.653 3.75 6.375m16.5 0c0-2.278-3.694-4.125-8.25-4.125S3.75 4.097 3.75 6.375m16.5 0v11.25c0 2.278-3.694 4.125-8.25 4.125s-8.25-1.847-8.25-4.125V6.375" />
            </svg>
        ),
        color: "text-blue-400", bg: "bg-blue-500/10", border: "border-blue-500/20",
        title: "Unified Storage Pool",
        desc: "Combine unlimited Google Drive accounts into a single dashboard. N accounts × 15 GB = effectively unlimited free storage.",
    },
    {
        icon: (
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 13.5l10.5-11.25L12 10.5h8.25L9.75 21.75 12 13.5H3.75z" />
            </svg>
        ),
        color: "text-violet-400", bg: "bg-violet-500/10", border: "border-violet-500/20",
        title: "Smart Upload Routing",
        desc: "Least-Used-Space strategy automatically routes every upload to the account with the most free space.",
    },
    {
        icon: (
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
            </svg>
        ),
        color: "text-sky-400", bg: "bg-sky-500/10", border: "border-sky-500/20",
        title: "Folder Navigation",
        desc: "Full folder hierarchy with breadcrumb, grid & list views, search, sort, and type filters across all accounts.",
    },
    {
        icon: (
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 9.776c.112-.017.227-.026.344-.026h15.812c.117 0 .232.009.344.026m-16.5 0a2.25 2.25 0 0 0-1.883 2.542l.857 6a2.25 2.25 0 0 0 2.227 1.932H19.05a2.25 2.25 0 0 0 2.227-1.932l.857-6a2.25 2.25 0 0 0-1.883-2.542m-16.5 0V6A2.25 2.25 0 0 1 6 3.75h3.879a1.5 1.5 0 0 1 1.06.44l2.122 2.12a1.5 1.5 0 0 0 1.06.44H18A2.25 2.25 0 0 1 20.25 9v.776" />
            </svg>
        ),
        color: "text-indigo-400", bg: "bg-indigo-500/10", border: "border-indigo-500/20",
        title: "Drag-to-Folder Panel",
        desc: "Start dragging any file and a panel slides in showing every folder. Drop to move instantly with auto-scroll.",
    },
    {
        icon: (
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M7.217 10.907a2.25 2.25 0 1 0 0 2.186m0-2.186c.18.324.283.696.283 1.093s-.103.77-.283 1.093m0-2.186 9.566-5.314m-9.566 7.5 9.566 5.314m0 0a2.25 2.25 0 1 0 3.935 2.186 2.25 2.25 0 0 0-3.935-2.186Zm0-12.814a2.25 2.25 0 1 0 3.933-2.185 2.25 2.25 0 0 0-3.933 2.185Z" />
            </svg>
        ),
        color: "text-purple-400", bg: "bg-purple-500/10", border: "border-purple-500/20",
        title: "Shared with Me",
        desc: "Browse files and folders others have shared with your Drive accounts. Download directly.",
    },
    {
        icon: (
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z" />
            </svg>
        ),
        color: "text-emerald-400", bg: "bg-emerald-500/10", border: "border-emerald-500/20",
        title: "Multi-User Identity",
        desc: "Secure authentication with Google, GitHub, or email. Each user gets isolated storage pools — your files stay private.",
    },
    {
        icon: (
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
                <path strokeLinecap="round" strokeLinejoin="round" d="m14.74 9-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 0 1-2.244 2.077H8.084a2.25 2.25 0 0 1-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 0 0-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 0 1 3.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 0 0-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 0 0-7.5 0" />
            </svg>
        ),
        color: "text-rose-400", bg: "bg-rose-500/10", border: "border-rose-500/20",
        title: "Trash Management",
        desc: "Delete sends files to Drive trash. Restore any file or permanently delete from the Trash page.",
    },
    {
        icon: (
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z" />
            </svg>
        ),
        color: "text-amber-400", bg: "bg-amber-500/10", border: "border-amber-500/20",
        title: "Rich Analytics",
        desc: "Storage breakdown, file type distribution, weekly upload activity — all computed client-side.",
    },
    {
        icon: (
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M17.25 6.75L22.5 12l-5.25 5.25m-10.5 0L1.5 12l5.25-5.25m7.5-3l-4.5 16.5" />
            </svg>
        ),
        color: "text-teal-400", bg: "bg-teal-500/10", border: "border-teal-500/20",
        title: "Open Source",
        desc: "100% free and open source. Self-hosted, privacy-first. Inspect every line, contribute, or fork it.",
    },
];

const stats = [
    { label: "Free Storage/Account", value: "15 GB" },
    { label: "Max Accounts", value: "∞" },
    { label: "Leaves Your Network", value: "Never" },
    { label: "Monthly Cost", value: "$0" },
];

export default function LandingPage() {
    const { theme, toggle } = useTheme();

    return (
        <div className="min-h-screen bg-sd-bg text-sd-text">
            {/* ── Navbar ─────────────────────────────────────────── */}
            <nav className="sticky top-0 z-50 border-b border-sd-border bg-sd-bg/80 backdrop-blur-xl">
                <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3.5 sm:px-6">
                    <div className="flex items-center gap-2.5">
                        <Link href="/" className="relative flex h-8 w-8 items-center justify-center rounded-lg overflow-hidden transition hover:scale-105">
                            <div className="absolute inset-0 bg-gradient-accent" />
                            <svg className="relative h-4 w-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                <circle cx="9" cy="10" r="3.5" strokeLinecap="round" />
                                <circle cx="15" cy="14" r="3.5" strokeLinecap="round" />
                                <path d="M11.5 7.5 L12.5 16.5" strokeLinecap="round" strokeOpacity={0.5} />
                            </svg>
                        </Link>
                        <Link href="/" className="text-base font-bold tracking-tight text-sd-text hover:text-sd-accent transition">
                            StitchDrive
                        </Link>
                    </div>

                    <div className="flex items-center gap-2">
                        <Link href="/docs" className="hidden text-xs text-sd-text2 hover:text-sd-text transition sm:inline px-3 py-1.5">
                            Docs
                        </Link>
                        <button
                            onClick={toggle}
                            className="flex h-8 w-8 items-center justify-center rounded-lg border border-sd-border text-sd-text2 hover:bg-sd-s2 hover:text-sd-text transition"
                            title="Toggle theme"
                        >
                            {theme === "dark" ? (
                                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 3v2.25m6.364.386-1.591 1.591M21 12h-2.25m-.386 6.364-1.591-1.591M12 18.75V21m-4.773-4.227-1.591 1.591M5.25 12H3m4.227-4.773L5.636 5.636M15.75 12a3.75 3.75 0 1 1-7.5 0 3.75 3.75 0 0 1 7.5 0Z" />
                                </svg>
                            ) : (
                                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M21.752 15.002A9.72 9.72 0 0 1 18 15.75c-5.385 0-9.75-4.365-9.75-9.75 0-1.33.266-2.597.748-3.752A9.753 9.753 0 0 0 3 11.25C3 16.635 7.365 21 12.75 21a9.753 9.753 0 0 0 9.002-5.998Z" />
                                </svg>
                            )}
                        </button>
                        <Link href="/login" className="flex items-center gap-1.5 rounded-lg border border-sd-border px-3 py-1.5 text-xs text-sd-text2 hover:border-sd-accent/40 hover:text-sd-text transition">
                            <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 9V5.25A2.25 2.25 0 0 0 13.5 3h-6a2.25 2.25 0 0 0-2.25 2.25v13.5A2.25 2.25 0 0 0 7.5 21h6a2.25 2.25 0 0 0 2.25-2.25V15m0 0-3 3m3-3 3 3m-3-3H12.75" />
                            </svg>
                            Login
                        </Link>
                        <Link href="/sign-up" className="btn-primary rounded-lg px-4 py-1.5 text-xs font-semibold">
                            Get Started
                        </Link>
                    </div>
                </div>
            </nav>

            {/* ── Hero ───────────────────────────────────────────── */}
            <section className="relative overflow-hidden">
                <div className="dot-bg absolute inset-0 opacity-50" />
                <div className="pointer-events-none absolute inset-0">
                    <div className="absolute top-0 left-1/2 -translate-x-1/2 h-[500px] w-[800px] rounded-full bg-sd-accent/5 blur-3xl" />
                    <div className="absolute top-32 right-1/4 h-64 w-64 rounded-full bg-sd-accent2/5 blur-3xl" />
                </div>
                <div className="absolute inset-0 bg-gradient-to-b from-transparent via-transparent to-sd-bg pointer-events-none" />

                <div className="relative mx-auto max-w-6xl px-4 sm:px-6 py-28 text-center md:py-36">
                    <div className="animate-fade-up mb-6 inline-flex items-center gap-2 rounded-full border border-sd-accent/20 bg-sd-accent/5 px-4 py-1.5">
                        <span className="h-1.5 w-1.5 rounded-full bg-sd-accent animate-pulse" />
                        <span className="text-xs font-medium text-sd-accent">Open Source · Free Forever · Self-Hosted</span>
                    </div>

                    <h1 className="animate-fade-up-d1 font-display mb-6 text-5xl leading-[1.1] text-sd-text md:text-7xl">
                        Your Storage,{" "}
                        <span className="gradient-text">Stitched Together</span>
                    </h1>

                    <p className="animate-fade-up-d2 mx-auto mb-10 max-w-2xl text-lg leading-relaxed text-sd-text2">
                        StitchDrive aggregates multiple Google Drive accounts into a single unified dashboard.
                        Get up to <strong className="text-sd-text">N × 15 GB</strong> free cloud storage with
                        smart routing, drag-to-folder moves, trash management, and rich analytics — all self-hosted.
                    </p>

                    <div className="animate-fade-up-d3 flex flex-wrap items-center justify-center gap-3">
                        <Link href="/sign-up" className="btn-primary flex items-center gap-2 rounded-xl px-7 py-3.5 font-semibold">
                            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5 21 12m0 0-7.5 7.5M21 12H3" />
                            </svg>
                            Get Started Free
                        </Link>
                        <Link
                            href="/user-guide"
                            className="flex items-center gap-2 rounded-xl border border-sd-border bg-sd-s1 px-7 py-3.5 font-semibold text-sd-text hover:border-sd-accent/40 transition shadow-sm"
                        >
                            <svg className="h-4 w-4 text-sd-accent" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.042A8.967 8.967 0 006 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 016 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 016-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0018 18a8.967 8.967 0 00-6 2.292m0-14.25v14.25" />
                            </svg>
                            User Guide
                        </Link>
                    </div>

                    {/* Stats */}
                    <div className="animate-fade-up-d4 mt-16 grid grid-cols-2 gap-4 sm:grid-cols-4 max-w-3xl mx-auto">
                        {stats.map((s) => (
                            <div key={s.label} className="rounded-xl border border-sd-border bg-sd-s1/60 backdrop-blur-sm px-4 py-4 text-center">
                                <div className="font-display text-2xl text-sd-text">{s.value}</div>
                                <div className="mt-0.5 text-xs text-sd-text3">{s.label}</div>
                            </div>
                        ))}
                    </div>
                </div>
            </section>

            {/* ── Features ───────────────────────────────────────── */}
            <section className="mx-auto max-w-6xl px-4 sm:px-6 py-20">
                <div className="mb-12 text-center">
                    <h2 className="font-display text-3xl text-sd-text md:text-4xl">
                        Everything you need,{" "}
                        <span className="gradient-text">nothing you don&apos;t</span>
                    </h2>
                    <p className="mt-4 text-sd-text2">
                        A focused set of features built for power users who want more from free cloud storage.
                    </p>
                </div>

                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                    {features.map((f) => (
                        <div
                            key={f.title}
                            className={`group rounded-2xl border ${f.border} bg-sd-s1 p-5 transition hover:border-opacity-50 hover:bg-sd-s2`}
                        >
                            <div className={`mb-4 inline-flex rounded-xl p-2.5 ${f.bg}`}>
                                <span className={f.color}>{f.icon}</span>
                            </div>
                            <h3 className="mb-2 text-sm font-semibold text-sd-text">{f.title}</h3>
                            <p className="text-sm leading-relaxed text-sd-text2">{f.desc}</p>
                        </div>
                    ))}
                </div>
            </section>

            {/* ── Pages showcase ──────────────────────────────────── */}
            <section className="border-t border-sd-border bg-sd-s1 py-20">
                <div className="mx-auto max-w-6xl px-4 sm:px-6">
                    <div className="mb-12 text-center">
                        <h2 className="font-display text-3xl text-sd-text md:text-4xl">
                            Six views, <span className="gradient-text">one coherent app</span>
                        </h2>
                    </div>
                    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                        {[
                            { label: "Overview", color: "text-blue-400", bg: "bg-blue-500/10", border: "border-blue-500/20", desc: "Stats cards, per-account storage bars, file type breakdown, and recent files." },
                            { label: "Files", color: "text-sky-400", bg: "bg-sky-500/10", border: "border-sky-500/20", desc: "Upload, browse, rename, move (drag panel), download, and trash files across accounts." },
                            { label: "Shared", color: "text-violet-400", bg: "bg-violet-500/10", border: "border-violet-500/20", desc: "Browse files and folders shared with your Drive accounts." },
                            { label: "Trash", color: "text-rose-400", bg: "bg-rose-500/10", border: "border-rose-500/20", desc: "See all trashed files, restore them, or permanently delete." },
                            { label: "Analytics", color: "text-emerald-400", bg: "bg-emerald-500/10", border: "border-emerald-500/20", desc: "Upload activity, storage by account, file type distribution." },
                            { label: "Settings", color: "text-amber-400", bg: "bg-amber-500/10", border: "border-amber-500/20", desc: "Connect or disconnect Drive accounts, view quotas, manage profile." },
                        ].map((page) => (
                            <div key={page.label} className={`rounded-2xl border ${page.border} bg-sd-bg p-5 hover:bg-sd-s2 transition`}>
                                <div className={`mb-3 inline-flex rounded-lg px-2.5 py-1 text-xs font-semibold ${page.color} ${page.bg}`}>
                                    {page.label}
                                </div>
                                <p className="text-sm leading-relaxed text-sd-text2">{page.desc}</p>
                            </div>
                        ))}
                    </div>
                </div>
            </section>

            {/* ── Get Started ────────────────────────────────────── */}
            <section className="py-20">
                <div className="mx-auto max-w-4xl px-6">
                    <div className="mb-10 text-center">
                        <h2 className="font-display text-3xl text-sd-text md:text-4xl">Get started in minutes</h2>
                        <p className="mt-4 text-sd-text2">Our step-by-step guide walks you from cloning the repo to a working storage pool.</p>
                    </div>
                    <div className="mb-10 grid gap-3 sm:grid-cols-3">
                        {[
                            { n: "01", label: "Create Google Cloud credentials", color: "text-blue-400", bg: "bg-blue-500/10" },
                            { n: "02", label: "Login and upload credentials.json via Dashboard", color: "text-violet-400", bg: "bg-violet-500/10" },
                            { n: "03", label: "Connect your Google Drive accounts via OAuth", color: "text-emerald-400", bg: "bg-emerald-500/10" },
                        ].map((step) => (
                            <div key={step.n} className="flex items-center gap-3 rounded-xl border border-sd-border bg-sd-s1 p-4">
                                <span className={`flex-shrink-0 font-mono-code text-xs font-bold ${step.color} ${step.bg} rounded-lg px-2 py-1`}>{step.n}</span>
                                <span className="text-sm text-sd-text2">{step.label}</span>
                            </div>
                        ))}
                    </div>
                    <div className="text-center">
                        <Link href="/user-guide" className="btn-primary inline-flex items-center gap-2 rounded-xl px-8 py-3.5 font-semibold shadow-lg shadow-sd-accent/20">
                            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.042A8.967 8.967 0 006 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 016 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 016-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0018 18a8.967 8.967 0 00-6 2.292m0-14.25v14.25" />
                            </svg>
                            User Guide
                        </Link>
                        <p className="mt-3 text-xs text-sd-text3">Takes about 15 minutes end-to-end</p>
                    </div>
                </div>
            </section>

            {/* ── CTA ────────────────────────────────────────────── */}
            <section className="mx-auto max-w-6xl px-4 sm:px-6 py-20 text-center">
                <div className="relative overflow-hidden rounded-3xl border border-sd-accent/20 bg-sd-s1 p-12">
                    <div className="absolute inset-0 dot-bg opacity-20" />
                    <div className="absolute top-0 left-1/2 -translate-x-1/2 h-40 w-96 bg-sd-accent/10 blur-3xl" />
                    <div className="absolute top-0 left-8 right-8 h-px bg-gradient-to-r from-transparent via-sd-accent/40 to-transparent" />
                    <div className="relative">
                        <h2 className="font-display mb-4 text-3xl text-sd-text md:text-4xl">
                            Built in the open, for everyone
                        </h2>
                        <p className="mx-auto mb-8 max-w-xl text-sd-text2">
                            StitchDrive is free software. Inspect every line, contribute improvements, or fork it. No lock-in. No subscription. No data harvesting.
                        </p>
                        <div className="flex flex-wrap items-center justify-center gap-3">
                            <a
                                href="https://github.com/Atifhasan250/Stitch-Drive"
                                target="_blank"
                                rel="noopener noreferrer"
                                className="flex items-center gap-2 rounded-xl border border-sd-accent/30 bg-sd-accent/10 px-6 py-3 font-semibold text-sd-accent hover:bg-sd-accent/20 transition"
                            >
                                <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 24 24">
                                    <path d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0 1 12 6.844a9.59 9.59 0 0 1 2.504.337c1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.02 10.02 0 0 0 22 12.017C22 6.484 17.522 2 12 2z" />
                                </svg>
                                View on GitHub
                            </a>
                            <Link href="/user-guide" className="btn-primary rounded-xl px-6 py-3 font-semibold shadow-lg shadow-sd-accent/20">
                                User Guide
                            </Link>
                        </div>
                    </div>
                </div>
            </section>

            {/* ── Footer ─────────────────────────────────────────── */}
            <footer className="border-t border-sd-border bg-sd-s1 py-8">
                <div className="mx-auto max-w-6xl px-6">
                    <div className="flex flex-col gap-6 sm:flex-row sm:items-center sm:justify-between">
                        <div className="flex items-center gap-2.5">
                            <div className="relative flex h-7 w-7 items-center justify-center rounded-lg overflow-hidden">
                                <div className="absolute inset-0 bg-gradient-accent" />
                                <svg className="relative h-3.5 w-3.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                    <circle cx="9" cy="10" r="3.5" strokeLinecap="round" />
                                    <circle cx="15" cy="14" r="3.5" strokeLinecap="round" />
                                    <path d="M11.5 7.5 L12.5 16.5" strokeLinecap="round" strokeOpacity={0.5} />
                                </svg>
                            </div>
                            <div>
                                <span className="text-sm font-medium text-sd-text">StitchDrive</span>
                                <p className="text-xs text-sd-text3">Free &amp; open source · Self-hosted Google Drive aggregator</p>
                            </div>
                        </div>

                        <div className="flex items-center gap-3">
                            {/* GitHub */}
                            <a href="https://github.com/Atifhasan250" target="_blank" rel="noopener noreferrer" className="flex h-8 w-8 items-center justify-center rounded-lg border border-sd-border text-sd-text3 hover:text-sd-text hover:border-sd-accent/40 transition" title="GitHub">
                                <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 24 24"><path d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844a9.59 9.59 0 012.504.337c1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.02 10.02 0 0022 12.017C22 6.484 17.522 2 12 2z" /></svg>
                            </a>
                            {/* X / Twitter */}
                            <a href="https://x.com/_atifhasan_" target="_blank" rel="noopener noreferrer" className="flex h-8 w-8 items-center justify-center rounded-lg border border-sd-border text-sd-text3 hover:text-sd-text hover:border-sd-accent/40 transition" title="X (Twitter)">
                                <svg className="h-3.5 w-3.5" fill="currentColor" viewBox="0 0 24 24"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" /></svg>
                            </a>
                            {/* LinkedIn */}
                            <a href="https://www.linkedin.com/in/atifhasan250/" target="_blank" rel="noopener noreferrer" className="flex h-8 w-8 items-center justify-center rounded-lg border border-sd-border text-sd-text3 hover:text-sd-text hover:border-sd-accent/40 transition" title="LinkedIn">
                                <svg className="h-3.5 w-3.5" fill="currentColor" viewBox="0 0 24 24"><path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 01-2.063-2.065 2.064 2.064 0 112.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z" /></svg>
                            </a>
                            {/* Instagram */}
                            <a href="https://www.instagram.com/_atif_hasan_" target="_blank" rel="noopener noreferrer" className="flex h-8 w-8 items-center justify-center rounded-lg border border-sd-border text-sd-text3 hover:text-sd-text hover:border-sd-accent/40 transition" title="Instagram">
                                <svg className="h-3.5 w-3.5" fill="currentColor" viewBox="0 0 24 24"><path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.052.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98C8.333 23.986 8.741 24 12 24c3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 100 12.324 6.162 6.162 0 000-12.324zM12 16a4 4 0 110-8 4 4 0 010 8zm6.406-11.845a1.44 1.44 0 100 2.881 1.44 1.44 0 000-2.881z" /></svg>
                            </a>
                            {/* Facebook */}
                            <a href="https://www.facebook.com/atifhasan250" target="_blank" rel="noopener noreferrer" className="flex h-8 w-8 items-center justify-center rounded-lg border border-sd-border text-sd-text3 hover:text-sd-text hover:border-sd-accent/40 transition" title="Facebook">
                                <svg className="h-3.5 w-3.5" fill="currentColor" viewBox="0 0 24 24"><path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" /></svg>
                            </a>
                        </div>
                    </div>
                    <div className="mt-6 border-t border-sd-border pt-6 text-center">
                        <p className="text-xs text-sd-text3">Built by <a href="https://atifs-info.vercel.app/" target="_blank" rel="noopener noreferrer" className="text-sd-text2 hover:text-sd-accent transition">Atif Hasan</a> · © {new Date().getFullYear()} StitchDrive</p>
                    </div>
                </div>
            </footer>
        </div>
    );
}
