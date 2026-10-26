FROM oven/bun:1.4.2-alpine AS deps
# QA deploys this image automatically from the qa branch using Dokploy's GitHub integration.
WORKDIR /app
COPY frontend/package.json frontend/bun.lock* ./
RUN bun install --frozen-lockfile

FROM deps AS build
ARG BACKEND_URL
ARG APP_CHANNEL=production
ENV BACKEND_URL=$BACKEND_URL
ENV APP_CHANNEL=$APP_CHANNEL
COPY frontend/tsconfig.json ./
COPY frontend/next.config.ts ./
COPY frontend/postcss.config.mjs ./
COPY frontend/src ./src
COPY frontend/e2e ./e2e
COPY frontend/test ./test
COPY frontend/public ./public
RUN PACKAGE_VERSION="$(node -p "require('./package.json').version")" && BASE_VERSION="${PACKAGE_VERSION%-qa}" && if [ "$APP_CHANNEL" = "qa" ]; then BUILD_VERSION="${BASE_VERSION}-qa"; else BUILD_VERSION="$BASE_VERSION"; fi && NEXT_PUBLIC_BUILD_VERSION="$BUILD_VERSION" bun run build

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
