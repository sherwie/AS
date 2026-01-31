FROM node:20-alpine AS builder

WORKDIR /app

# Install pnpm
RUN corepack enable && corepack prepare pnpm@latest --activate

# Copy workspace files
COPY package.json pnpm-workspace.yaml ./
COPY packages/shared/package.json ./packages/shared/
COPY packages/notifier/package.json ./packages/notifier/

# Install dependencies
RUN pnpm install --frozen-lockfile

# Copy source
COPY packages/shared ./packages/shared
COPY packages/notifier ./packages/notifier

# Build
RUN pnpm --filter @solana-signal/shared build
RUN pnpm --filter @solana-signal/notifier build

# Production image
FROM node:20-alpine

WORKDIR /app

# Install pnpm
RUN corepack enable && corepack prepare pnpm@latest --activate

# Copy built artifacts
COPY --from=builder /app/packages/shared/dist ./packages/shared/dist
COPY --from=builder /app/packages/shared/package.json ./packages/shared/
COPY --from=builder /app/packages/notifier/dist ./packages/notifier/dist
COPY --from=builder /app/packages/notifier/package.json ./packages/notifier/
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./

# Install curl for healthcheck
RUN apk add --no-cache curl

ENV NODE_ENV=production
ENV SERVICE_NAME=notifier

EXPOSE 9092

CMD ["node", "packages/notifier/dist/index.js"]
