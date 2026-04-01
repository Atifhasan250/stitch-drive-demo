"use client";

import { useSignIn, useAuth } from "@clerk/nextjs";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import Link from "next/link";
import type { OAuthStrategy } from "@clerk/shared/types";

export default function LoginPage() {
  const { signIn, fetchStatus } = useSignIn();
  const { isSignedIn } = useAuth();
  const router = useRouter();

  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  useEffect(() => {
    if (isSignedIn) {
      router.push("/dashboard");
    }
  }, [isSignedIn, router]);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!signIn) return;
    setErrorMsg("");
    setLoading(true);

    const formData = new FormData(e.currentTarget);
    const emailAddress = formData.get("email") as string;
    const password = formData.get("password") as string;

    try {
      const { error } = await signIn.password({ identifier: emailAddress, password });

      if (error) {
        setLoading(false);
        setErrorMsg(error.longMessage || error.message || "Invalid email or password.");
        return;
      }

      if (signIn.status === "complete") {
        await signIn.finalize({
          navigate: () => router.push("/dashboard"),
        });
      } else {
        setLoading(false);
      }
    } catch (err: any) {
      setLoading(false);
      setErrorMsg(err.errors?.[0]?.longMessage || err.message || "Sign in failed.");
    }
  }

  async function handleSocialLogin(strategy: OAuthStrategy) {
    if (!signIn) return;
    setErrorMsg("");
    try {
      await signIn.sso({
        strategy,
        redirectCallbackUrl: "/sso-callback",
        redirectUrl: "/dashboard",
      });
    } catch (err) {
      setErrorMsg("Social login failed.");
    }
  }

  if (!signIn) return null;

  // Redirect if already signed in
  if (isSignedIn) {
    return null;
  }

  const isExecuting = fetchStatus === "fetching" || loading;

  return (
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden bg-sd-bg px-4">
      <div className="dot-bg pointer-events-none absolute inset-0 opacity-40" />
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 h-96 w-96 rounded-full bg-sd-accent/5 blur-3xl" />
        <div className="absolute bottom-1/4 left-1/3 h-64 w-64 rounded-full bg-sd-accent2/5 blur-3xl" />
      </div>

      <div className="relative w-full max-w-sm animate-fade-up">
        <div className="absolute -inset-px rounded-2xl bg-gradient-to-b from-sd-accent/20 to-transparent pointer-events-none" />

        <div className="relative rounded-2xl border border-sd-border bg-sd-s1 p-8 shadow-card">
          <div className="absolute top-0 left-8 right-8 h-px bg-gradient-to-r from-transparent via-sd-accent/60 to-transparent" />

          <div className="mb-6 text-center">
            <Link href="/" className="inline-flex items-center gap-2.5 mb-6 group">
              <div className="relative flex h-9 w-9 items-center justify-center rounded-xl overflow-hidden transition group-hover:scale-105">
                <div className="absolute inset-0 bg-gradient-accent" />
                <svg className="relative h-5 w-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <circle cx="9" cy="10" r="3.5" strokeLinecap="round" />
                  <circle cx="15" cy="14" r="3.5" strokeLinecap="round" />
                  <path d="M11.5 7.5 L12.5 16.5" strokeLinecap="round" strokeOpacity={0.5} />
                </svg>
              </div>
              <span className="text-sm font-semibold tracking-tight text-sd-text">StitchDrive</span>
            </Link>

            <h1 className="font-display text-2xl text-sd-text">Welcome back</h1>
            <p className="mt-1.5 text-sm text-sd-text2">Sign in to access your drive</p>
          </div>

          <div className="space-y-2.5 mb-5">
            <button
              type="button"
              onClick={() => handleSocialLogin("oauth_google")}
              className="flex w-full items-center justify-center gap-2.5 rounded-xl border border-sd-border bg-sd-bg px-4 py-3 text-sm font-medium text-sd-text hover:bg-sd-s2 hover:border-sd-accent/30 transition"
            >
              <svg className="h-4 w-4" viewBox="0 0 24 24">
                <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4" />
                <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
                <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
                <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
              </svg>
              Continue with Google
            </button>
            <button
              type="button"
              onClick={() => handleSocialLogin("oauth_github")}
              className="flex w-full items-center justify-center gap-2.5 rounded-xl border border-sd-border bg-sd-bg px-4 py-3 text-sm font-medium text-sd-text hover:bg-sd-s2 hover:border-sd-accent/30 transition"
            >
              <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 24 24">
                <path d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0 1 12 6.844a9.59 9.59 0 0 1 2.504.337c1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.02 10.02 0 0 0 22 12.017C22 6.484 17.522 2 12 2z" />
              </svg>
              Continue with GitHub
            </button>
          </div>

          <div className="relative mb-5">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-sd-border" />
            </div>
            <div className="relative flex justify-center text-xs">
              <span className="bg-sd-s1 px-3 text-sd-text3">or continue with email</span>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="space-y-3.5">
            <div>
              <label htmlFor="email" className="block text-xs font-medium text-sd-text2 mb-1.5">Email</label>
              <input
                id="email"
                name="email"
                type="email"
                placeholder="you@example.com"
                required
                autoFocus
                className="w-full rounded-xl border border-sd-border bg-sd-bg px-4 py-3 text-sm text-sd-text placeholder-sd-text3 outline-none transition focus:border-sd-accent/50 focus:ring-2 focus:ring-sd-accent/10"
              />
            </div>
            <div>
              <label htmlFor="password" className="block text-xs font-medium text-sd-text2 mb-1.5">Password</label>
              <input
                id="password"
                name="password"
                type="password"
                placeholder="••••••••"
                required
                className="w-full rounded-xl border border-sd-border bg-sd-bg px-4 py-3 text-sm text-sd-text placeholder-sd-text3 outline-none transition focus:border-sd-accent/50 focus:ring-2 focus:ring-sd-accent/10"
              />
            </div>

            {errorMsg && (
              <div className="flex items-center gap-2 rounded-xl border border-red-500/20 bg-red-500/5 px-3.5 py-3">
                <svg className="h-4 w-4 flex-shrink-0 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 1 1-18 0 9 9 0 0 1 18 0Zm-9 3.75h.008v.008H12v-.008Z" />
                </svg>
                <p className="text-sm text-red-400">{errorMsg}</p>
              </div>
            )}

            <button
              type="submit"
              disabled={isExecuting}
              className="btn-primary w-full rounded-xl py-3.5 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-40"
            >
              {isExecuting ? (
                <span className="flex items-center justify-center gap-2">
                  <svg className="h-4 w-4 animate-spin" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  Signing in…
                </span>
              ) : "Sign In"}
            </button>
          </form>

          <p className="mt-5 text-center text-xs text-sd-text3">
            Don&apos;t have an account?{" "}
            <Link href="/sign-up" className="text-sd-accent hover:text-sd-accent/80 transition font-medium">Sign up</Link>
          </p>
          <p className="mt-2 text-center text-xs text-sd-text3">
            <Link href="/" className="hover:text-sd-text transition">← Back to home</Link>
          </p>
        </div>
      </div>
    </main>
  );
}
