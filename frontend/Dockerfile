# ── Stage 1: Build ─────────────────────────────────────────────────────────────
FROM node:20-alpine AS builder

WORKDIR /app

# Only copy what's needed for installing dependencies
COPY package*.json ./
RUN npm ci

# Copy source code
COPY . .

# ARGs are required at BUILD TIME for Next.js (client-side bake-in)
ARG NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY
ARG NEXT_PUBLIC_API_URL
ARG CLERK_SECRET_KEY

# Convert ARGs to ENVs for the build process
ENV NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=$NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL
ENV CLERK_SECRET_KEY=$CLERK_SECRET_KEY

# Next.js build
RUN npm run build

# ── Stage 2: Runtime ──────────────────────────────────────────────────────────
FROM node:20-alpine AS runner

WORKDIR /app

# Ensure we have production environment set
ENV NODE_ENV=production

# Reinstall ONLY production dependencies to keep the runtime image lean
COPY --from=builder /app/package*.json ./
RUN npm ci --omit=dev

# Copy build output
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/public ./public
COPY --from=builder /app/next.config.ts ./next.config.ts

# Runtime port
EXPOSE 3000

# Start Next.js
CMD ["npx", "next", "start"]
