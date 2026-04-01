import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";

function buildCsp() {
  const isDev = process.env.NODE_ENV !== "production";
  const scriptSrc = [
    "'self'",
    "'unsafe-inline'",
    "https://*.clerk.dev",
    "https://*.clerk.accounts.dev",
    "https://*.clerk.com",
    "https://js.clerk.com",
    "https://clerk.com",
    "https://challenges.cloudflare.com",
  ];

  const connectSrc = [
    "'self'",
    "https://api.clerk.com",
    "https://*.clerk.dev",
    "https://*.clerk.accounts.dev",
    "https://*.clerk.com",
    "https://clerk.com",
    "https://challenges.cloudflare.com",
    "https://www.googleapis.com",
  ];

  const frameSrc = [
    "'self'",
    "https://*.clerk.dev",
    "https://*.clerk.accounts.dev",
    "https://*.clerk.com",
    "https://clerk.com",
    "https://challenges.cloudflare.com",
  ];

  if (isDev) {
    scriptSrc.push("'unsafe-eval'");
  }

  return [
    "default-src 'self'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
    "object-src 'none'",
    `script-src ${scriptSrc.join(" ")}`,
    `script-src-elem ${scriptSrc.join(" ")}`,
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
    "img-src 'self' data: blob: https:",
    "font-src 'self' data: https://fonts.gstatic.com",
    `connect-src ${connectSrc.join(" ")}`,
    `frame-src ${frameSrc.join(" ")}`,
    "media-src 'self' blob: https:",
    "worker-src 'self' blob:",
  ].join("; ");
}

const isPublicRoute = createRouteMatcher([
  "/",
  "/login(.*)",
  "/sign-up(.*)",
  "/sso-callback(.*)",
  "/docs(.*)",
  "/user-guide(.*)",
  "/api/auth/callback",
  "/favicon.svg",
]);

export default clerkMiddleware(async (auth, request) => {
  if (!isPublicRoute(request)) {
    await auth.protect();
  }

  const response = NextResponse.next();
  response.headers.set("Content-Security-Policy", buildCsp());
  response.headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
  response.headers.set("X-Content-Type-Options", "nosniff");
  return response;
});

export const config = {
  matcher: [
    // Skip Next.js internals and all static files
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    // Always run for API routes
    "/(api|trpc)(.*)",
  ],
};
