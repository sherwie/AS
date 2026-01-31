FROM node:20-alpine AS builder

WORKDIR /app

# Install pnpm
RUN corepack enable && corepack prepare pnpm@latest --activate

# Copy workspace files
COPY package.json pnpm-workspace.yaml ./
COPY packages/shared/package.json ./packages/shared/
COPY packages/dashboard/package.json ./packages/dashboard/

# Install dependencies
RUN pnpm install --frozen-lockfile

# Copy source
COPY packages/shared ./packages/shared
COPY packages/dashboard ./packages/dashboard

# Build shared first
RUN pnpm --filter @solana-signal/shared build

# Build dashboard
RUN pnpm --filter @solana-signal/dashboard build

# Production image
FROM node:20-alpine

WORKDIR /app

# Install pnpm
RUN corepack enable && corepack prepare pnpm@latest --activate

# Copy standalone output
COPY --from=builder /app/packages/dashboard/.next/standalone ./
COPY --from=builder /app/packages/dashboard/.next/static ./packages/dashboard/.next/static
COPY --from=builder /app/packages/dashboard/public ./packages/dashboard/public

ENV NODE_ENV=production
ENV PORT=3000

EXPOSE 3000

CMD ["node", "packages/dashboard/server.js"]
