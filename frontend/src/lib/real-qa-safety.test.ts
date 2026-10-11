import { describe, expect, it } from "vitest";
import { redactLiveQaDiagnostic, validateLiveQaConfig } from "./real-qa-safety";

const validQaEnv: Record<string, string | undefined> = {
  E2E_REAL: "1",
  E2E_QA_MUTATIONS: "1",
  E2E_FRONTEND_URL: "https://qa-app.example.test",
  BACKEND_URL: "https://api.qa.example.test",
  E2E_LOGIN_EMAIL: "qa@example.test",
  E2E_LOGIN_PASSWORD: "never-printed",
  E2E_QA_ENVIRONMENT: "qa",
  E2E_QA_ALLOWED_ORIGINS: "https://qa-app.example.test, https://api.qa.example.test",
  E2E_QA_MANAGER_ID: "00000000-0000-4000-8000-000000000001",
  E2E_QA_MOTEL_ID: "00000000-0000-4000-8000-000000000002",
};

const readOnlyQaEnv = {
  E2E_REAL: "1",
  E2E_FRONTEND_URL: "https://qa-app.example.test",
  E2E_QA_ENVIRONMENT: "qa",
  E2E_QA_ALLOWED_ORIGINS: "https://qa-app.example.test",
};

describe("live QA safety", () => {
  it("allows allowlisted read-only QA without manager credentials", () => {
    expect(validateLiveQaConfig(readOnlyQaEnv)).toEqual([]);
  });

  it("requires explicit mutation confirmation and dedicated manager before writes", () => {
    expect(validateLiveQaConfig({ ...validQaEnv, E2E_QA_MUTATIONS: undefined }, "mutating")).toContain("Set E2E_QA_MUTATIONS for the live QA suite");
    expect(validateLiveQaConfig({ ...validQaEnv, E2E_QA_MANAGER_ID: undefined }, "mutating")).toContain("Set E2E_QA_MANAGER_ID for the live QA suite");
  });

  it("rejects production URLs and environment markers", () => {
    expect(validateLiveQaConfig({ ...validQaEnv, E2E_FRONTEND_URL: "https://app.example.com", BACKEND_URL: "https://api.production.example.com", E2E_QA_ENVIRONMENT: "production" }, "mutating")).toEqual(expect.arrayContaining(["Configured QA origin is not in E2E_QA_ALLOWED_ORIGINS", "E2E_QA_ENVIRONMENT must equal qa"]));
    expect(validateLiveQaConfig({ ...validQaEnv, E2E_QA_ALLOWED_ORIGINS: "https://production.example.test" }, "mutating")).toContain("E2E_QA_ALLOWED_ORIGINS must contain exact non-production HTTPS origins");
    expect(validateLiveQaConfig({ ...validQaEnv, E2E_FRONTEND_URL: "https://qa.example.test", E2E_QA_ALLOWED_ORIGINS: "https://qa.example.test", E2E_QA_ENVIRONMENT: "preproduction" }, "mutating")).toContain("E2E_QA_ENVIRONMENT must equal qa");
  });

  it("rejects localhost and loopback origins for live-stack mode", () => {
    expect(validateLiveQaConfig({ ...validQaEnv, E2E_FRONTEND_URL: "http://localhost:3001", E2E_QA_ALLOWED_ORIGINS: "http://localhost:3001" })).not.toEqual([]);
    expect(validateLiveQaConfig({ ...validQaEnv, E2E_FRONTEND_URL: "https://127.0.0.1", E2E_QA_ALLOWED_ORIGINS: "https://127.0.0.1" })).not.toEqual([]);
  });

  it("requires the mutation confirmation before live mutation specs can collect", () => {
    expect(validateLiveQaConfig({ ...validQaEnv, E2E_QA_MUTATIONS: "true" }, "mutating")).toContain("E2E_QA_MUTATIONS must equal 1");
  });

  it("rejects relative and credential-bearing configured URLs", () => {
    expect(validateLiveQaConfig({ ...validQaEnv, E2E_FRONTEND_URL: "/" })).toContain("Configured QA URL is invalid");
    expect(validateLiveQaConfig({ ...validQaEnv, BACKEND_URL: "https://user:pass@api.qa.example.test" }, "mutating")).toContain("Configured QA URL must be a credential-free HTTPS origin");
  });

  it("redacts credentials embedded in URL path and query signed-link parameters", () => {
    expect(redactLiveQaDiagnostic("https://qa.test/renter/magic-secret?X-Amz-Credential=abc&X-Amz-Signature=def&Authorization=secret&signature=xyz")).not.toContain("abc");
    expect(redactLiveQaDiagnostic("https://qa.test/renter/magic-secret?X-Amz-Credential=abc&X-Amz-Signature=def&Authorization=secret&signature=xyz")).not.toContain("magic-secret");
  });

  it("allows motel creation when no existing dedicated motel ID is provided", () => {
    expect(validateLiveQaConfig({ ...validQaEnv, E2E_QA_MOTEL_ID: undefined }, "mutating")).toEqual([]);
  });

  it("rejects malformed dedicated motel IDs before mutation", () => {
    expect(validateLiveQaConfig({ ...validQaEnv, E2E_QA_MOTEL_ID: "not-a-uuid" }, "mutating")).toContain("E2E_QA_MOTEL_ID must be a UUID");
  });

  it("accepts only explicitly allowlisted QA origins", () => {
    expect(validateLiveQaConfig(validQaEnv, "mutating")).toEqual([]);
    expect(validateLiveQaConfig({ ...validQaEnv, E2E_FRONTEND_URL: "https://other.qa.example.test" })).toContain("Configured QA origin is not in E2E_QA_ALLOWED_ORIGINS");
    expect(validateLiveQaConfig({ ...validQaEnv, E2E_FRONTEND_URL: "https://qa-app.example.test/login" })).toContain("Configured QA URL must be a credential-free HTTPS origin");
    expect(validateLiveQaConfig({ ...validQaEnv, BACKEND_URL: "https://api.qa.example.test:8443" }, "mutating")).toContain("Configured QA origin is not in E2E_QA_ALLOWED_ORIGINS");
    expect(validateLiveQaConfig({ ...validQaEnv, E2E_QA_ALLOWED_ORIGINS: "https://qa-app.example.test, https://app.production.test" })).toContain("E2E_QA_ALLOWED_ORIGINS must contain exact non-production HTTPS origins");
  });

  it("requires a dedicated test manager before mutation", () => {
    expect(validateLiveQaConfig({ ...validQaEnv, E2E_QA_MANAGER_ID: undefined }, "mutating")).toContain("Set E2E_QA_MANAGER_ID for the live QA suite");
  });

  it("redacts tokens, phone numbers, emails and bearer credentials", () => {
    expect(redactLiveQaDiagnostic("https://qa.test/r?token=abc123&phone=84901234567 qa.person@example.test Bearer sensitive-token")).toBe("https://qa.test/r?token=[REDACTED]&phone=[REDACTED] [REDACTED_EMAIL] Bearer [REDACTED]");
  });
});
