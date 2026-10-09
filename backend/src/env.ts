import { AppError } from "@/shared/errors";

type ZnsTemplateKey =
  | "welcome"
  | "bill"
  | "paymentConfirmed"
  | "contract"
  | "otp"
  | "expiry"
  | "ticket";

export type RateLimitStore = "postgres" | "redis";

export interface Env {
  nodeEnv: string;
  rateLimitStore: RateLimitStore;
  port: number;
  databaseUrl: string;
  testDatabaseUrl: string;
  renterPortalUrl: string;
  frontendUrl: string;
  managerJwtSecret: string;
  renterSessionSecret: string;
  r2: {
    accountId: string;
    accessKeyId: string;
    secretAccessKey: string;
    bucket: string;
    publicUrl: string;
  };
  zalo: {
    oaId: string;
    oaSecret: string;
    accessToken: string;
    webhookSecret: string;
    templates: Record<ZnsTemplateKey, string>;
  };
}

const ZNS_KEYS: Record<ZnsTemplateKey, string> = {
  welcome: "ZNS_TEMPLATE_WELCOME",
  bill: "ZNS_TEMPLATE_BILL",
  paymentConfirmed: "ZNS_TEMPLATE_PAYMENT_CONFIRMED",
  contract: "ZNS_TEMPLATE_CONTRACT",
  otp: "ZNS_TEMPLATE_OTP",
  expiry: "ZNS_TEMPLATE_EXPIRY",
  ticket: "ZNS_TEMPLATE_TICKET",
};

function required(input: Record<string, string | undefined>, key: string): string {
  const value = input[key];
  if (!value) throw new AppError("VALIDATION_ERROR", `Thiếu biến môi trường: ${key}`);
  return value;
}

function secret(input: Record<string, string | undefined>, key: string): string {
  const value = required(input, key);
  if (value.length < 32 || value === "PLACEHOLDER") throw new AppError("VALIDATION_ERROR", `${key} không hợp lệ`);
  return value;
}

function publicHttpsUrl(input: Record<string, string | undefined>, key: string, nodeEnv: string, fallback: string): string {
  const value = input[key] ?? fallback;
  if (nodeEnv === "production") {
    let url: URL;
    try { url = new URL(value); } catch { throw new AppError("VALIDATION_ERROR", `${key} phải là URL HTTPS`); }
    if (url.protocol !== "https:" || url.hostname === "localhost" || url.hostname === "127.0.0.1") throw new AppError("VALIDATION_ERROR", `${key} phải là URL HTTPS public`);
  }
  return value;
}

export function parseEnv(input: Record<string, string | undefined>): Env {
  const nodeEnv = input.NODE_ENV ?? "development";
  const rateLimitStore = input.RATE_LIMIT_STORE ?? "postgres";
  if (rateLimitStore !== "postgres" && rateLimitStore !== "redis") throw new AppError("VALIDATION_ERROR", `RATE_LIMIT_STORE không hợp lệ: ${rateLimitStore}`);
  if (nodeEnv === "production" && rateLimitStore !== "postgres" && rateLimitStore !== "redis") throw new AppError("VALIDATION_ERROR", "Production phải dùng PostgreSQL hoặc Redis cho rate limit");
  if (nodeEnv === "production" && (input.DATABASE_URL?.includes("localhost") || input.DATABASE_URL?.includes("127.0.0.1"))) throw new AppError("VALIDATION_ERROR", "DATABASE_URL production không được dùng localhost");
  if (nodeEnv === "production" && input.MANAGER_JWT_SECRET === input.RENTER_SESSION_SECRET) throw new AppError("VALIDATION_ERROR", "Production secrets phải khác nhau");
  const port = input.PORT === undefined ? 3000 : Number(input.PORT);
  if (!Number.isInteger(port) || port <= 0)
    throw new AppError("VALIDATION_ERROR", `PORT không hợp lệ: ${input.PORT}`);

  return {
    nodeEnv,
    rateLimitStore,
    port,
    databaseUrl: required(input, "DATABASE_URL"),
    testDatabaseUrl: required(input, "TEST_DATABASE_URL"),
    renterPortalUrl: publicHttpsUrl(input, "RENTER_PORTAL_URL", nodeEnv, "http://localhost:3000"),
    frontendUrl: publicHttpsUrl(input, "FRONTEND_URL", nodeEnv, "http://localhost:3001"),
    managerJwtSecret: secret(input, "MANAGER_JWT_SECRET"),
    renterSessionSecret: secret(input, "RENTER_SESSION_SECRET"),
    r2: {
      accountId: required(input, "R2_ACCOUNT_ID"),
      accessKeyId: required(input, "R2_ACCESS_KEY_ID"),
      secretAccessKey: required(input, "R2_SECRET_ACCESS_KEY"),
      bucket: input.R2_BUCKET ?? "motel-uploads",
      publicUrl: input.R2_PUBLIC_URL ?? "",
    },
    zalo: {
      oaId: required(input, "ZALO_OA_ID"),
      oaSecret: required(input, "ZALO_OA_SECRET"),
      accessToken: required(input, "ZALO_ACCESS_TOKEN"),
      webhookSecret: required(input, "ZALO_WEBHOOK_SECRET"),
      templates: Object.fromEntries(
        Object.entries(ZNS_KEYS).map(([key, variable]) => [
          key,
          input[variable] ?? "PLACEHOLDER",
        ]),
      ) as Record<ZnsTemplateKey, string>,
    },
  };
}
