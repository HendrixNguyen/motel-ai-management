FROM oven/bun:1.4.2-alpine AS deps
WORKDIR /app
COPY frontend/package.json frontend/bun.lock* ./
RUN bun install --frozen-lockfile

FROM deps AS build
ARG BACKEND_URL
ENV BACKEND_URL=$BACKEND_URL
COPY frontend/tsconfig.json ./
COPY frontend/next.config.ts ./
COPY frontend/src ./src
COPY frontend/public ./public
RUN bun run build

FROM deps AS runner
WORKDIR /app
COPY --from=build /app/.next/standalone ./
COPY --from=build /app/.next/static ./.next/static
COPY --from=build /app/public ./public
EXPOSE 3000
CMD ["node", "server.js"]
