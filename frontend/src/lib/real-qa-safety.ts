export function redactLiveQaDiagnostic(value: string, event: "console" | "pageerror" | "requestfailed" | "response" = "console", status?: number, method?: string): string {
  if (event === "response") return `response ${method === "GET" || method === "POST" || method === "PUT" || method === "PATCH" || method === "DELETE" ? method : "HTTP"} ${Number.isInteger(status) && status! >= 100 && status! <= 599 ? status : "unknown"}`;
  return event === "console" ? "console error" : event === "pageerror" ? "page error" : "request failed";
}

export async function runLiveQaPreflight(env: Record<string, string | undefined>, mode: "anonymous" | "authenticated" | "mutating", request: () => Promise<unknown>): Promise<string[]> {
  const errors = validateLiveQaConfig(env, mode);
  if (errors.length) return errors;
  await request();
  return [];
}

export function validateLiveQaConfig(env: Record<string, string | undefined>, mode: "anonymous" | "authenticated" | "mutating" = "anonymous"): string[] {
  const mutating = mode === "mutating";
  const errors: string[] = [];
  const required = ["E2E_REAL", "E2E_FRONTEND_URL", "E2E_QA_ENVIRONMENT", "E2E_QA_ALLOWED_ORIGINS"];
  if (mode !== "anonymous") required.push("E2E_LOGIN_EMAIL", "E2E_LOGIN_PASSWORD", "E2E_QA_MANAGER_ID");
  if (mutating) required.push("E2E_QA_MUTATIONS", "E2E_QA_MOTEL_ID");
  if (mutating && env.E2E_QA_MOTEL_ID && !/^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i.test(env.E2E_QA_MOTEL_ID)) errors.push("E2E_QA_MOTEL_ID must be a UUID");
  for (const name of required) if (!env[name]) errors.push(`Set ${name} for the live QA suite`);
  if (env.E2E_REAL !== "1") errors.push("E2E_REAL must equal 1");
  if (env.E2E_QA_ENVIRONMENT !== "qa") errors.push("E2E_QA_ENVIRONMENT must equal qa");
  if (mutating && env.E2E_QA_MUTATIONS !== "1") errors.push("E2E_QA_MUTATIONS must equal 1");
  const urls = [env.E2E_FRONTEND_URL, ...(mutating && env.BACKEND_URL ? [env.BACKEND_URL] : [])].filter((url): url is string => Boolean(url));
  const allowedOrigins = (env.E2E_QA_ALLOWED_ORIGINS ?? "").split(",").map((item) => item.trim().toLowerCase());
  for (const origin of allowedOrigins) {
    try {
      const url = new URL(origin);
      if (url.protocol !== "https:" || url.origin.toLowerCase() !== origin || url.pathname !== "/" || url.search || url.hash || url.username || url.password || /production|prod(?:uction)?[_-]?(?:env|environment|stack)?|localhost|127(?:\.\d{1,3}){3}|\[::1\]/i.test(origin)) errors.push("E2E_QA_ALLOWED_ORIGINS must contain exact non-production HTTPS origins");
    } catch {
      errors.push("E2E_QA_ALLOWED_ORIGINS contains an invalid origin");
    }
  }
  for (const rawUrl of urls) {
    try {
      const url = new URL(rawUrl);
      if (url.protocol !== "https:" || url.username || url.password || url.pathname !== "/" || url.search || url.hash) errors.push("Configured QA URL must be a credential-free HTTPS origin");
      if (!allowedOrigins.includes(url.origin.toLowerCase())) errors.push("Configured QA origin is not in E2E_QA_ALLOWED_ORIGINS");
      const host = url.hostname.toLowerCase();
      if (host === "prod" || host.includes("production") || host.startsWith("prod-") || host.endsWith("-prod")) errors.push("Production host rejected");
      if (host === "localhost" || host === "::1" || /^127(?:\.\d{1,3}){3}$/.test(host)) errors.push("Loopback host rejected");
    } catch {
      errors.push("Configured QA URL is invalid");
    }
  }
  if (urls.some((url) => /production|prod(?:uction)?[_-]?(?:env|environment|stack)?/i.test(url))) errors.push("Production marker rejected");
  return errors;
}
