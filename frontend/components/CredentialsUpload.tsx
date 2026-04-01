"use client";

import { useState, useEffect, useRef } from "react";
import { useAuth } from "@clerk/nextjs";

import { authenticatedFetch } from "@/lib/api";

type CredentialStatus = "none" | "valid" | "invalid" | "checking";

export function CredentialsUpload() {
  const { getToken } = useAuth();
  const [status, setStatus] = useState<CredentialStatus>("none");
  const [isHovered, setIsHovered] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const saved = localStorage.getItem("credentials");
    if (saved) {
      validateStoredCredentials(saved);
    }
  }, []);

  const validateStoredCredentials = async (credString: string) => {
    setStatus("checking");
    try {
      const token = await getToken();
      const res = await authenticatedFetch("/api/accounts/verify-credentials", token, {
        method: "POST"
      });

      if (res.ok) {
        setStatus("valid");
      } else {
        setStatus("invalid");
      }
    } catch (err) {
      console.error("[Credentials] Validation failed:", err);
      setStatus("invalid");
    }
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (event) => {
      const content = event.target?.result as string;
      try {
        const json = JSON.parse(content);
        const config = json.web || json.installed || json;
        
        if (!config.client_id || !config.client_secret) {
          throw new Error("Missing client_id or client_secret");
        }

        // Store exactly what was uploaded, but the backend handles the mapping
        const credString = JSON.stringify(json);
        localStorage.setItem("credentials", credString);
        await validateStoredCredentials(credString);
      } catch (err) {
        console.error("[Credentials] Invalid JSON file:", err);
        setStatus("invalid");
        // Clear broken credentials
        localStorage.removeItem("credentials");
      }
    };
    reader.readAsText(file);
    // Reset input so the same file can be uploaded again if needed
    e.target.value = "";
  };

  const triggerUpload = () => {
    fileInputRef.current?.click();
  };

  return (
    <div className="flex items-center gap-3">
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleFileChange}
        className="hidden"
        accept=".json"
      />
      
      <button
        onClick={triggerUpload}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
        className={`relative flex items-center gap-2 rounded-xl border px-4 py-2 text-sm font-medium transition-all duration-300 shadow-sm
          ${status === "valid" 
            ? "border-emerald-500/30 bg-emerald-500/5 text-emerald-400 hover:bg-emerald-500/10" 
            : status === "invalid"
            ? "border-rose-500/30 bg-rose-500/5 text-rose-400 hover:bg-rose-500/10"
            : "border-sd-border bg-sd-s1 text-sd-text2 hover:border-sd-accent/40 hover:text-sd-text"
          }`}
      >
        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5m-13.5-9L12 3m0 0 4.5 4.5M12 3v13.5" />
        </svg>
        <span>{status === "valid" ? "Credentials Linked" : "Upload Credentials"}</span>
        
        {/* Status Icon */}
        <div className="ml-1 flex h-5 w-5 items-center justify-center">
          {status === "checking" ? (
            <svg className="h-4 w-4 animate-spin text-sd-accent" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
          ) : status === "valid" ? (
            <div className="flex h-5 w-5 items-center justify-center rounded-full bg-emerald-500 text-white shadow-glow-sm">
              <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
              </svg>
            </div>
          ) : status === "invalid" ? (
            <div className="flex h-5 w-5 items-center justify-center rounded-full bg-rose-500 text-white shadow-glow-sm">
              <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
              </svg>
            </div>
          ) : null}
        </div>

        {/* Hover info for invalid state */}
        {isHovered && status === "invalid" && (
          <div className="absolute top-full right-0 mt-2 w-64 rounded-xl border border-rose-500/20 bg-sd-s2 p-3 text-xs text-rose-400 shadow-xl z-50 animate-in fade-in slide-in-from-top-1">
            <p className="font-semibold mb-1">Invalid Credentials</p>
            <p className="text-sd-text3 leading-relaxed">The JSON file provided is either malformed or missing required Google Drive API fields (client_id, client_secret). Please try again.</p>
          </div>
        )}
      </button>
    </div>
  );
}
