"use client";

import { AuthenticateWithRedirectCallback } from '@clerk/nextjs';

export default function SSOCallbackPage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-sd-bg">
      <div className="flex flex-col items-center gap-4">
        <svg className="h-8 w-8 animate-spin text-sd-accent" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
        </svg>
        <p className="text-sm text-sd-text2 animate-pulse">Completing authentication...</p>
      </div>
      <AuthenticateWithRedirectCallback
        signInUrl="/login"
        signUpUrl="/sign-up"
        continueSignUpUrl="/dashboard"
        signInFallbackRedirectUrl="/dashboard"
        signUpFallbackRedirectUrl="/dashboard"
      />
    </main>
  );
}
