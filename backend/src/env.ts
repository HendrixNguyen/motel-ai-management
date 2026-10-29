import { AppError } from "@/shared/errors";

type ZnsTemplateKey =
  "welcome" | "bill" | "paymentConfirmed" | "contract" | "otp" | "expiry" | "ticket";

export type RateLimitStore = "postgres" | "redis";

export interface Env {
  nodeEnv: string;
  rateLimitStore: RateLimitStore;
  port: number;
  databaseUrl: string;
  testDatabaseUrl: string;
  renterPortalUrl: string;
  frontendUrl: string;
  trustedProxyHeader: string | null;
  trustedProxyAssertionHeader: string | null;
  trustedProxyAssertionValue: string | null;
  webPush: { publicKey: string; privateKey: string; subject: string } | null;
  managerJwtSecret: string;
  adminJwtSecret: string;
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
  if (value.length < 32 || value === "PLACEHOLDER")
    throw new AppError("VALIDATION_ERROR", `${key} không hợp lệ`);
  return value;
}

function publicHttpsUrl(
  input: Record<string, string | undefined>,
  key: string,
  nodeEnv: string,
  fallback: string,
): string {
  const value = input[key] ?? fallback;
  if (nodeEnv === "production") {
    let url: URL;
    try {
      url = new URL(value);
    } catch {
      throw new AppError("VALIDATION_ERROR", `${key} phải là URL HTTPS`);
    }
    if (url.protocol !== "https:" || url.hostname === "localhost" || url.hostname === "127.0.0.1")
      throw new AppError("VALIDATION_ERROR", `${key} phải là URL HTTPS public`);
  }
  return value;
}

function publicUrl(
  input: Record<string, string | undefined>,
  key: string,
  fallback: string,
  production: boolean,
): string {
  const value = input[key] ?? fallback;
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new AppError("VALIDATION_ERROR", `${key} phải là URL hợp lệ`);
  }
  if (url.pathname !== "/" || url.search || url.hash)
    throw new AppError("VALIDATION_ERROR", `${key} không được chứa path, query hoặc fragment`);
  if (production && url.protocol !== "https:")
    throw new AppError("VALIDATION_ERROR", `${key} phải dùng HTTPS trong production`);
  return url.origin;
}

function validateProductionSecrets(
  input: Record<string, string | undefined>,
  keys: string[],
): void {
  const placeholders =
    /^(placeholder|change[-_ ]?me|secret|mock|test|dev|development|password|super_secret)/i;
  const values = keys.map((key) => {
    const value = required(input, key);
    if (placeholders.test(value) || value.length < 32)
      throw new AppError("VALIDATION_ERROR", `${key} phải là secret production thực`);
    return value;
  });
  if (new Set(values).size !== values.length)
    throw new AppError("VALIDATION_ERROR", "Secret production không được trùng nhau");
}

export function validateProductionConfig(input: Record<string, string | undefined>): void {
  required(input, "DATABASE_URL");
  validateProductionSecrets(input, [
    "MANAGER_JWT_SECRET",
    "ADMIN_JWT_SECRET",
    "RENTER_SESSION_SECRET",
    ...(input.ZALO_OA_ID ? ["ZALO_OA_SECRET", "ZALO_ACCESS_TOKEN", "ZALO_WEBHOOK_SECRET"] : []),
    ...(input.TEST_DATABASE_URL?.trim() && input.TEST_DATABASE_URL.trim() !== input.DATABASE_URL?.trim() ? ["TEST_DATABASE_URL"] : []),
    "R2_ACCESS_KEY_ID",
    "R2_SECRET_ACCESS_KEY",
  ]);
  const adminSecret = secret(input, "ADMIN_JWT_SECRET");
  if (new Set([input.MANAGER_JWT_SECRET, adminSecret, input.RENTER_SESSION_SECRET]).size !== 3)
    throw new AppError("VALIDATION_ERROR", "Production secrets phải khác nhau");
  publicUrl(input, "RENTER_PORTAL_URL", "", true);
  publicUrl(input, "FRONTEND_URL", "", true);
  if (input.R2_PUBLIC_URL) publicUrl(input, "R2_PUBLIC_URL", "", true);
}

export function parseEnv(input: Record<string, string | undefined>): Env {
  const nodeEnv = input.NODE_ENV ?? "development";
  const rateLimitStore = input.RATE_LIMIT_STORE ?? "postgres";
  if (rateLimitStore !== "postgres" && rateLimitStore !== "redis")
    throw new AppError("VALIDATION_ERROR", `RATE_LIMIT_STORE không hợp lệ: ${rateLimitStore}`);
  const production = nodeEnv === "production";
  if (production) {
    validateProductionConfig(input);
    if (input.DATABASE_URL?.includes("localhost") || input.DATABASE_URL?.includes("127.0.0.1"))
      throw new AppError("VALIDATION_ERROR", "DATABASE_URL production không được dùng localhost");
    if (
      input.TRUSTED_PROXY_HEADER &&
      (!input.TRUSTED_PROXY_ASSERTION_HEADER ||
        !input.TRUSTED_PROXY_ASSERTION_VALUE ||
        input.TRUSTED_PROXY_ASSERTION_VALUE.length < 32)
    )
      throw new AppError(
        "VALIDATION_ERROR",
        "Trusted proxy phải có assertion header và secret tối thiểu 32 ký tự",
      );
  }
  const port = input.PORT === undefined ? 3000 : Number(input.PORT);
  if (!Number.isInteger(port) || port <= 0)
    throw new AppError("VALIDATION_ERROR", `PORT không hợp lệ: ${input.PORT}`);

  const r2Bucket = required(input, "R2_BUCKET");
  if (r2Bucket === "public" || /placeholder|replace-me/i.test(r2Bucket))
    throw new AppError("VALIDATION_ERROR", "R2_BUCKET phải là bucket riêng tư đã cấu hình");
  return {
    nodeEnv,
    rateLimitStore,
    port,
    databaseUrl: required(input, "DATABASE_URL"),
    testDatabaseUrl: input.TEST_DATABASE_URL ?? "",
    renterPortalUrl: publicUrl(input, "RENTER_PORTAL_URL", "http://localhost:3000", production),
    frontendUrl: publicUrl(input, "FRONTEND_URL", "http://localhost:3001", production),
    trustedProxyHeader: input.TRUSTED_PROXY_HEADER?.trim() || null,
    trustedProxyAssertionHeader: input.TRUSTED_PROXY_ASSERTION_HEADER?.trim() || null,
    trustedProxyAssertionValue: input.TRUSTED_PROXY_ASSERTION_VALUE || null,
    managerJwtSecret: secret(input, "MANAGER_JWT_SECRET"),
    adminJwtSecret: required(input, "ADMIN_JWT_SECRET"),
    renterSessionSecret: secret(input, "RENTER_SESSION_SECRET"),
    r2: {
      accountId: required(input, "R2_ACCOUNT_ID"),
      accessKeyId: required(input, "R2_ACCESS_KEY_ID"),
      secretAccessKey: required(input, "R2_SECRET_ACCESS_KEY"),
      bucket: input.R2_BUCKET ?? required(input, "R2_BUCKET"),
      publicUrl: input.R2_PUBLIC_URL ?? "",
    },
    webPush:
      input.VAPID_PUBLIC_KEY && input.VAPID_PRIVATE_KEY
        ? {
            publicKey: input.VAPID_PUBLIC_KEY,
            privateKey: input.VAPID_PRIVATE_KEY,
            subject:
              input.VAPID_SUBJECT ??
              `mailto:admin@${new URL(publicHttpsUrl(input, "FRONTEND_URL", nodeEnv, "http://localhost:3001")).hostname}`,
          }
        : null,
    zalo: {
      oaId: input.ZALO_OA_ID ?? "",
      oaSecret: input.ZALO_OA_ID ? required(input, "ZALO_OA_SECRET") : "",
      accessToken: input.ZALO_OA_ID ? required(input, "ZALO_ACCESS_TOKEN") : "",
      webhookSecret: input.ZALO_OA_ID ? required(input, "ZALO_WEBHOOK_SECRET") : "",
      templates: Object.fromEntries(
        Object.entries(ZNS_KEYS).map(([key, variable]) => [key, input[variable] ?? "PLACEHOLDER"]),
      ) as Record<ZnsTemplateKey, string>,
    },
  };
}
