import { defineConfig } from "drizzle-kit";

// Reads DATABASE_URL from the environment rather than `@/config`: drizzle-kit bundles this
// file without the `@/*` path alias, so the import would not resolve. `bun run` loads
// `backend/.env`, and `src/env.ts` validates the same variable at boot.
if (!process.env.DATABASE_URL)
  throw new Error("DATABASE_URL is required for drizzle-kit");

export default defineConfig({
  schema: "./src/db/schemas.ts",
  out: "./drizzle",
  dialect: "postgresql",
  dbCredentials: { url: process.env.DATABASE_URL },
});