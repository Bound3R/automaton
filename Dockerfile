# ─── Stage 1: Build ─────────────────────────────────────────────────────────
FROM node:20-alpine AS builder

RUN corepack enable && corepack prepare pnpm@latest --activate

WORKDIR /app

# Copy manifests first for layer caching
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY packages ./packages

RUN pnpm install --frozen-lockfile

COPY . .

RUN pnpm run build

# ─── Stage 2: Runtime ────────────────────────────────────────────────────────
FROM node:20-alpine AS runtime

RUN corepack enable && corepack prepare pnpm@latest --activate

WORKDIR /app

# Copy manifests and install production deps only
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY packages ./packages

RUN pnpm install --frozen-lockfile --prod

# Copy compiled output from builder
COPY --from=builder /app/dist ./dist

# Automaton data directory (wallet, config, db, state)
VOLUME ["/app/data"]

EXPOSE 3000

ENV NODE_ENV=production
ENV AUTOMATON_DIR=/app/data
ENV PORT=3000

CMD ["node", "dist/index.js", "--run"]
