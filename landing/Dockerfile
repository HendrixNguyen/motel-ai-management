FROM oven/bun:1.4.2-alpine AS build
WORKDIR /app
ARG VITE_FORMSPREE_ENDPOINT
ENV VITE_FORMSPREE_ENDPOINT=$VITE_FORMSPREE_ENDPOINT
COPY package.json bun.lock* ./
RUN bun install --frozen-lockfile
COPY . .
RUN bun run build

FROM nginx:alpine
COPY --from=build /app/dist /usr/share/nginx/html/
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]