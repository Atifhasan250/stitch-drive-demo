# ── Stage 1: Build ─────────────────────────────────────────────────────────────
FROM node:20-slim AS builder

WORKDIR /app

# Only copy what's needed for installing dependencies
COPY package*.json ./
RUN npm ci --omit=dev

# ── Stage 2: Runtime ──────────────────────────────────────────────────────────
FROM node:20-slim

WORKDIR /app

# Ensure we have production environment set
ENV NODE_ENV=production

# Copy production node_modules from builder
COPY --from=builder /app/node_modules ./node_modules

# Copy source code
COPY . .

# Backend listens on 8000
EXPOSE 8000

CMD ["node", "src/index.js"]
