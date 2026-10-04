import { parseEnv } from "@/env";

export const env = Object.freeze(
  parseEnv(process.env as Record<string, string | undefined>),
);
