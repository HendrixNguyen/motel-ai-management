FROM oven/bun:1.4.2-alpine AS deps
WORKDIR /app
COPY backend/package.json backend/bun.lock* ./
RUN bun install --frozen-lockfile

FROM deps AS build
COPY backend/tsconfig.json ./
COPY backend/src ./src
RUN bun run typecheck

FROM deps AS runner
WORKDIR /app
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/tsconfig.json ./tsconfig.json
COPY --from=build /app/src ./src
COPY backend/drizzle ./drizzle
COPY backend/package.json ./
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
  CMD wget --quiet --spider http://127.0.0.1:3000/health || exit 1
CMD ["bun", "run", "start"]
