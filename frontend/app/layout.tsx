import type { Metadata } from "next";
import { ClerkProvider } from "@clerk/nextjs";
import "./globals.css";
import { ThemeProvider } from "@/contexts/ThemeContext";

export const metadata: Metadata = {
  title: {
    default: "StitchDrive — Unified Multi-Cloud Storage Pool",
    template: "%s | StitchDrive"
  },
  description: "Combine multiple Google Drive accounts into one giant pool of storage with StitchDrive. Built by Atif Hasan.",
  keywords: ["stitchdrive", "atifhasan", "atif hasan bogura", "stitchdrive atif", "cloud storage", "google drive pool", "multi-cloud storage", "unified storage"],
  authors: [{ name: "Atif Hasan" }],
  creator: "Atif Hasan",
  publisher: "Atif Hasan",
  robots: "index, follow",
  icons: { icon: "/favicon.svg" },
  openGraph: {
    type: "website",
    locale: "en_US",
    url: "https://stitchdrive.example.com", // Placeholder URL
    title: "StitchDrive — Unified Multi-Cloud Storage Pool",
    description: "Combine multiple Google Drive accounts into one giant pool of storage with StitchDrive. Built by Atif Hasan.",
    siteName: "StitchDrive",
  },
  twitter: {
    card: "summary_large_image",
    title: "StitchDrive — Unified Multi-Cloud Storage Pool",
    description: "Combine multiple Google Drive accounts into one giant pool of storage with StitchDrive. Built by Atif Hasan.",
    creator: "@atifhasan",
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <ClerkProvider
      signInUrl="/login"
      signUpUrl="/sign-up"
      signInFallbackRedirectUrl="/dashboard"
      signUpFallbackRedirectUrl="/dashboard"
    >
      <html lang="en" suppressHydrationWarning>
        <head>
          <script
            dangerouslySetInnerHTML={{
              __html: `
                try {
                  const stored = localStorage.getItem("sd_theme");
                  const preferred = window.matchMedia("(prefers-color-scheme: light)").matches ? "light" : "dark";
                  if ((stored || preferred) === "light") {
                    document.documentElement.classList.add("light");
                  }
                } catch (e) {}
              `,
            }}
          />
        </head>
        <body className="min-h-screen antialiased font-sans">
          <ThemeProvider>{children}</ThemeProvider>
        </body>
      </html>
    </ClerkProvider>
  );
}
