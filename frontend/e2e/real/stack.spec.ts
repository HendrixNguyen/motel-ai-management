import { expect, test } from "@playwright/test";
import {
	type LiveQaRunContext,
	redactLiveQaDiagnostic,
	runLiveQaMutationPreflight,
	validateLiveQaConfig,
} from "../../src/lib/real-qa-safety";

const configErrors = validateLiveQaConfig(process.env);
const authenticatedErrors = validateLiveQaConfig(process.env, "authenticated");

interface ManagerSetupRunArtifacts {
	run: LiveQaRunContext;
	room: { id: string; name: string; motelId: string };
	renter: {
		id: string;
		name: string;
		phone: string;
		motelId: string;
		roomId: string | null;
	};
}

test.beforeAll(async ({ request }) => {
  expect(
    configErrors,
    `Live QA preflight rejected configuration: ${configErrors.join("; ")}`,
  ).toEqual([]);
  const response = await request.get(`${process.env.E2E_FRONTEND_URL}/api/auth/me`);
  expect(
    response.status(),
    "A reachable QA frontend proxy must reject an anonymous identity read",
  ).toBe(401);
});

test("live manager login forwards httpOnly cookie, opens shell and logs out", async ({
  page,
  context,
}) => {
  test.skip(
    authenticatedErrors.length > 0,
    `Live QA authenticated preflight rejected configuration: ${authenticatedErrors.join("; ")}`,
  );
  const diagnostics = collectSafeDiagnostics(page);
  await page.goto("/login");
  await signIn(page);
  const cookie = (await context.cookies()).find((entry) => entry.name === "manager_session");
  expect(cookie?.httpOnly).toBe(true);
  const identity = await page.request.get("/api/auth/me");
  expect(identity.status()).toBe(200);
  const identityBody = (await identity.json()) as { id?: string };
  if (process.env.E2E_QA_MANAGER_ID) expect(identityBody.id).toBe(process.env.E2E_QA_MANAGER_ID);
  await page.getByLabel("Menu phụ, Tài khoản", { exact: true }).click();
  await page.getByRole("button", { name: "Đăng xuất", exact: true }).click();
  await expect(page).toHaveURL("/login");
  expect((await context.cookies()).some((entry) => entry.name === "manager_session")).toBe(false);
  expect((await page.request.get("/api/auth/me")).status()).toBe(401);
  await page.goto("/renters");
  await expect(page).toHaveURL("/login");
  expect(diagnostics).toEqual([]);
});

test.describe("QA UI mutations", () => {
	let runContext: LiveQaRunContext | undefined;
	let managerSetupArtifacts: ManagerSetupRunArtifacts | undefined;

  test.beforeEach(async ({ page }) => {
    await page.goto("/login");
    await signIn(page);
    const response = await page.request.get("/api/auth/me");
    const identity = (await response.json()) as { id?: string };
    expect(identity.id, "Login must match dedicated E2E_QA_MANAGER_ID").toBe(
      process.env.E2E_QA_MANAGER_ID,
    );
    const motels = await page.request.get("/api/manager/motels");
    const motelRows = (await motels.json()) as Array<{ id: string }>;

    const mutationErrors = await runLiveQaMutationPreflight(
      process.env,
      {
        managerId: identity.id,
        motelIdsOwned: motelRows.map((motel) => motel.id),
      },
      async (context) => {
        runContext = context;
      },
    );

    test.skip(
      mutationErrors.length > 0,
      `Live QA mutation preflight rejected configuration: ${mutationErrors.join("; ")}`,
    );
  });

	test("creates run-scoped room and renter in dedicated QA motel, then persists after reload", async ({
		page,
	}) => {
		if (!runContext) test.fail(true, "Live QA mutation preflight must establish a run context");
		const context = runContext as LiveQaRunContext;

		const runId = context.runId;
		const roomName = `QA-${runId}`;
		const renterName = `QA Renter ${runId}`;
		const phone = `849${Math.floor(10000000 + Math.random() * 89999999)}`;
		const diagnostics = collectSafeDiagnostics(page);

		const motelId = context.motelId;
		await page.goto(`/rooms?motel=${encodeURIComponent(motelId)}`);
    await expect(
      page.getByRole("banner").getByRole("combobox", { name: "Nhà trọ", exact: true }),
    ).toHaveAttribute("data-value", motelId);
    await page.getByRole("button", { name: "Thêm phòng", exact: true }).click();
    const roomDialog = page.getByRole("dialog");
    await roomDialog.getByLabel("Tên phòng", { exact: true }).fill(roomName);
    await roomDialog.getByLabel("Giá thuê cơ bản (₫/tháng)", { exact: true }).fill("3500000");
    await roomDialog.getByLabel("Tầng (không bắt buộc)", { exact: true }).fill("1");
    await roomDialog.getByRole("button", { name: "Thêm phòng", exact: true }).click();
    await expect(page.getByRole("heading", { name: roomName, exact: true })).toBeVisible();
		await page.reload();
		await expect(page.getByRole("heading", { name: roomName, exact: true })).toBeVisible();

		await page.goto(`/renters?motel=${encodeURIComponent(motelId)}`);
		await page.getByRole("button", { name: "Thêm khách thuê", exact: true }).click();
    const renterDialog = page.getByRole("dialog");
    await renterDialog.getByLabel("Họ tên", { exact: true }).fill(renterName);
    await renterDialog.getByLabel("Số điện thoại", { exact: true }).fill(phone);
		await renterDialog
			.getByRole("combobox", { name: "Phòng (không bắt buộc)", exact: true })
			.selectOption({ label: roomName });
		await renterDialog.getByRole("button", { name: "Thêm khách thuê", exact: true }).click();
		await expect(page.getByText(renterName, { exact: true })).toBeVisible();
		await page.reload();
		await expect(page.getByText(renterName, { exact: true })).toBeVisible();

		// Record opaque room and renter identifiers for this run without logging PII.
		const roomsResponse = await page.request.get(
			`/api/manager/motels/${encodeURIComponent(motelId)}/rooms`,
		);
		expect(roomsResponse.status()).toBe(200);
		const rooms = (await roomsResponse.json()) as Array<{
			id: string;
			motelId: string;
			name: string;
		}>;
		const room = rooms.find((entry) => entry.name === roomName);
		expect(room, "Run-scoped room must exist in the dedicated QA motel").toBeDefined();
		expect(room!.motelId).toBe(motelId);

		const rentersResponse = await page.request.get(
			`/api/manager/motels/${encodeURIComponent(motelId)}/renters`,
		);
		expect(rentersResponse.status()).toBe(200);
		const renters = (await rentersResponse.json()) as Array<{
			id: string;
			motelId: string;
			name: string;
			phone: string;
			roomId: string | null;
		}>;
		const renter = renters.find(
			(entry) => entry.name === renterName && entry.phone === phone,
		);
		expect(renter, "Run-scoped renter must exist in the dedicated QA motel").toBeDefined();
		expect(renter!.motelId).toBe(motelId);
		expect(renter!.roomId).toBe(room!.id);

		managerSetupArtifacts = {
			run: context,
			room: { id: room!.id, name: room!.name, motelId: room!.motelId },
			renter: {
				id: renter!.id,
				name: renter!.name,
				phone: renter!.phone,
				motelId: renter!.motelId,
				roomId: renter!.roomId,
			},
		};
		expect(diagnostics).toEqual([]);
	});
});

function collectSafeDiagnostics(page: import("@playwright/test").Page): string[] {
  const diagnostics: string[] = [];
  page.on("console", (message) => {
    if (message.type() === "error")
      diagnostics.push(redactLiveQaDiagnostic(message.text(), "console"));
  });
  page.on("pageerror", (error) =>
    diagnostics.push(redactLiveQaDiagnostic(error.message, "pageerror")),
  );
  page.on("requestfailed", (request) => {
    const failure = request.failure();
    const url = request.url();
    // Ignore aborted RSC requests (Next.js App Router aborts in-flight RSC requests on navigation)
    if (failure?.errorText === "net::ERR_ABORTED" && url.includes("_rsc=")) return;
    diagnostics.push(redactLiveQaDiagnostic(url, "requestfailed"));
  });
  page.on("response", (response) => {
    if (response.status() >= 400)
      diagnostics.push(
        redactLiveQaDiagnostic(
          response.url(),
          "response",
          response.status(),
          response.request().method(),
        ),
      );
  });
  return diagnostics;
}

async function signIn(page: import("@playwright/test").Page) {
  await page.getByLabel("Email", { exact: true }).fill(process.env.E2E_LOGIN_EMAIL!);
  await page.getByLabel("Mật khẩu", { exact: true }).fill(process.env.E2E_LOGIN_PASSWORD!);
  await page.getByRole("button", { name: "Đăng nhập", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Tổng quan", exact: true })).toBeVisible();
}
