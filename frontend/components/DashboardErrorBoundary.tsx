"use client";

import React from "react";

interface State {
  hasError: boolean;
  errorMessage: string;
}

export class DashboardErrorBoundary extends React.Component<
  { children: React.ReactNode },
  State
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false, errorMessage: "" };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, errorMessage: error.message };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error("[ErrorBoundary] Caught error:", error, info);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex h-full flex-col items-center justify-center gap-4 p-8 text-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl border border-rose-500/20 bg-rose-500/10">
            <svg className="h-8 w-8 text-rose-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z" />
            </svg>
          </div>
          <div>
            <h2 className="text-lg font-bold text-sd-text">Something went wrong</h2>
            <p className="mt-1 max-w-sm text-sm text-sd-text3">
              An unexpected error occurred. Please refresh the page.
            </p>
            {this.state.errorMessage && (
              <p className="mt-2 max-w-sm rounded-lg bg-rose-500/5 px-3 py-2 font-mono text-xs text-rose-400">
                {this.state.errorMessage}
              </p>
            )}
          </div>
          <button
            onClick={() => window.location.reload()}
            className="btn-primary rounded-xl px-6 py-2.5 text-sm font-semibold"
          >
            Reload Page
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}
