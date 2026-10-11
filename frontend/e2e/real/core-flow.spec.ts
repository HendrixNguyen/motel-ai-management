import { expect, test } from "@playwright/test";
import { redactLiveQaDiagnostic, validateLiveQaConfig } from "../../src/lib/real-qa-safety";

const mutationErrors = validateLiveQaConfig(process.env, "mutating");
const motelId = process.env.E2E_QA_MOTEL_ID ?? "";

test.describe("dedicated QA billing and payment journey", () => {
  test.beforeEach(async ({ page }) => {
    test.skip(mutationErrors.length > 0, `Live QA mutation preflight rejected configuration: ${mutationErrors.join("; ")}`);
    await page.goto("/login");
    await page.getByLabel("Email", { exact: true }).fill(process.env.E2E_LOGIN_EMAIL!);
    await page.getByLabel("Mật khẩu", { exact: true }).fill(process.env.E2E_LOGIN_PASSWORD!);
    await page.getByRole("button", { name: "Đăng nhập", exact: true }).click();
    await expect(page.getByRole("heading", { name: "Tổng quan", exact: true })).toBeVisible();
    const identity = await page.request.get("/api/auth/me").then((response) => response.json()) as { id?: string };
    expect(identity.id, "Login must match dedicated E2E_QA_MANAGER_ID").toBe(process.env.E2E_QA_MANAGER_ID);
    const motels = await page.request.get("/api/manager/motels").then((response) => response.json()) as Array<{ id: string }>;
    expect(motels.some((motel) => motel.id === motelId), "Dedicated QA motel must be owned by authenticated QA manager").toBe(true);
  });

  test("reports contract create/send blocker without mutating QA", async ({ page }) => {
    const diagnostics = collectSafeDiagnostics(page);
    await page.goto(`/contracts?motel=${encodeURIComponent(motelId)}`);
    await expect(page.getByRole("heading", { name: "Hợp đồng", exact: true })).toBeVisible();
    await expect(page.getByRole("button", { name: /Tạo hợp đồng|Gửi hợp đồng/ }), "Contract create/send UI must remain absent until separately designed").toHaveCount(0);
    test.info().annotations.push({ type: "blocked", description: "Contract create/send UI absent; billing/payment journey remains unverified." });
    expect(diagnostics).toEqual([]);
  });

  test("billing and payment branches require supported contract and isolated invoice setup", async () => {
    test.skip(true, "Blocked: supported contract create/send UI absent; distinct approve/reject/cash invoices not yet provisionable safely. No QA writes permitted until blockers are resolved.");
  });
});

function collectSafeDiagnostics(page: import("@playwright/test").Page): string[] {
  const diagnostics: string[] = [];
  page.on("console", (message) => { if (message.type() === "error") diagnostics.push(redactLiveQaDiagnostic(message.text(), "console")); });
  page.on("pageerror", (error) => diagnostics.push(redactLiveQaDiagnostic(error.message, "pageerror")));
  page.on("requestfailed", (request) => diagnostics.push(redactLiveQaDiagnostic(request.url(), "requestfailed")));
  page.on("response", (response) => {
    if (response.status() >= 400) diagnostics.push(redactLiveQaDiagnostic(response.url(), "response", response.status(), response.request().method()));
  });
  return diagnostics;
}
