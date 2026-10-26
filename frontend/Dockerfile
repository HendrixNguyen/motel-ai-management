FROM oven/bun:1.4.2-alpine AS deps
# QA deploys this image automatically from the qa branch using Dokploy's GitHub integration.
WORKDIR /app
COPY frontend/package.json frontend/bun.lock* ./
RUN bun install --frozen-lockfile

FROM deps AS build
RUN apk add --no-cache git
ARG BACKEND_URL
ENV BACKEND_URL=$BACKEND_URL
COPY .git ./.git
COPY frontend/tsconfig.json ./
COPY frontend/next.config.ts ./
COPY frontend/postcss.config.mjs ./
COPY frontend/src ./src
COPY frontend/e2e ./e2e
COPY frontend/test ./test
COPY frontend/public ./public
RUN BUILD_SHA="$(git -C /app rev-parse HEAD)" && BUILD_TIMESTAMP="$(git -C /app show -s --format=%cI HEAD)" && test "${#BUILD_SHA}" -eq 40 && test -n "$BUILD_TIMESTAMP" && NEXT_PUBLIC_BUILD_SHA="$BUILD_SHA" BUILD_TIMESTAMP="$BUILD_TIMESTAMP" bun run build && rm -rf /app/.git

FROM deps AS runner
WORKDIR /app
ENV HOSTNAME=0.0.0.0
COPY --from=build /app/.next/standalone ./
COPY --from=build /app/.next/static ./.next/static
COPY --from=build /app/public ./public
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget --quiet --spider http://127.0.0.1:3000/health || exit 1
CMD ["node", "server.js"]
