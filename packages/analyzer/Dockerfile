FROM node:20-alpine AS builder

WORKDIR /app

# Install pnpm
RUN corepack enable && corepack prepare pnpm@latest --activate

# Copy workspace files
COPY package.json pnpm-workspace.yaml ./
COPY packages/shared/package.json ./packages/shared/
COPY packages/analyzer/package.json ./packages/analyzer/

# Install dependencies
RUN pnpm install --frozen-lockfile

# Copy source
COPY packages/shared ./packages/shared
COPY packages/analyzer ./packages/analyzer

# Build
RUN pnpm --filter @solana-signal/shared build
RUN pnpm --filter @solana-signal/analyzer build

# Production image
FROM node:20-alpine

WORKDIR /app

# Install pnpm
RUN corepack enable && corepack prepare pnpm@latest --activate

# Copy built artifacts
COPY --from=builder /app/packages/shared/dist ./packages/shared/dist
COPY --from=builder /app/packages/shared/package.json ./packages/shared/
COPY --from=builder /app/packages/analyzer/dist ./packages/analyzer/dist
COPY --from=builder /app/packages/analyzer/package.json ./packages/analyzer/
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./

# Install curl for healthcheck
RUN apk add --no-cache curl

ENV NODE_ENV=production
ENV SERVICE_NAME=analyzer

EXPOSE 9091

CMD ["node", "packages/analyzer/dist/index.js"]
