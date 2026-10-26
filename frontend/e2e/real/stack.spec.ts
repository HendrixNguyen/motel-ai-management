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

interface BillingRunArtifacts {
  periodId: string;
  readingIds: string[];
  invoiceIds: string[];
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
  let billingArtifacts: BillingRunArtifacts | undefined;

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
		if (!runContext) {
			throw new Error(
				"Live QA real-stack run context is missing; ensure the mutation preflight beforeEach has run for this suite.",
			);
		}
		const context = runContext;

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
		await roomDialog
			.getByLabel("Giá thuê cơ bản (₫/tháng)", { exact: true })
			.fill("3500000");
		await roomDialog.getByLabel("Tầng (không bắt buộc)", { exact: true }).fill("1");
		const roomCreateResponsePromise = page.waitForResponse(
			(response) =>
				response.url().endsWith(`/api/manager/motels/${motelId}/rooms`) &&
				response.request().method() === "POST",
		);
		await roomDialog.getByRole("button", { name: "Thêm phòng", exact: true }).click();
		const roomCreateResponse = await roomCreateResponsePromise;
		expect(roomCreateResponse.status()).toBe(201);
		const createdRoom = (await roomCreateResponse.json()) as {
			id: string;
			motelId: string;
		};
		await expect(page.getByRole("heading", { name: roomName, exact: true })).toBeVisible();
		await page.reload();
		await expect(page.getByRole("heading", { name: roomName, exact: true })).toBeVisible();

		await page.goto(`/renters?motel=${encodeURIComponent(motelId)}`);
		await page.getByRole("button", { name: "Thêm khách thuê", exact: true }).click();
		const renterDialog = page.getByRole("dialog");
		await renterDialog.getByLabel("Họ tên", { exact: true }).fill(renterName);
		await renterDialog.getByLabel("Số điện thoại", { exact: true }).fill(phone);
		const renterCreateResponsePromise = page.waitForResponse(
			(response) =>
				response.url().endsWith(`/api/manager/motels/${motelId}/renters`) &&
				response.request().method() === "POST",
		);
		await renterDialog
			.getByRole("combobox", { name: "Phòng (không bắt buộc)", exact: true })
			.selectOption({ label: roomName });
		await renterDialog.getByRole("button", { name: "Thêm khách thuê", exact: true }).click();
		const renterCreateResponse = await renterCreateResponsePromise;
		expect(renterCreateResponse.status()).toBe(201);
		const createdRenter = (await renterCreateResponse.json()) as {
			id: string;
			motelId: string;
			roomId: string | null;
		};
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
		// Link created room id to the listing result without exposing ids in logs.
		expect(createdRoom.id === room!.id && createdRoom.motelId === room!.motelId).toBe(true);

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
		// Link created renter id to the listing result without exposing ids in logs.
		expect(
			createdRenter.id === renter!.id &&
				createdRenter.motelId === renter!.motelId &&
				createdRenter.roomId === renter!.roomId,
		).toBe(true);

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

		// Assert that the captured artifacts mirror the created entities and their source
		// responses without emitting IDs or PII in failure output.
		expect(managerSetupArtifacts).toBeDefined();
		const artifacts = managerSetupArtifacts as ManagerSetupRunArtifacts;
		expect(artifacts.run).toBe(context);
		const roomGraphMatches =
			artifacts.room.id === createdRoom.id &&
				artifacts.room.motelId === createdRoom.motelId;
		const renterGraphMatches =
			artifacts.renter.id === createdRenter.id &&
				artifacts.renter.motelId === createdRenter.motelId &&
				artifacts.renter.roomId === createdRenter.roomId;
		expect(roomGraphMatches).toBe(true);
		expect(renterGraphMatches).toBe(true);
		expect(diagnostics).toEqual([]);
	});

	test("creates a run-scoped draft contract and records a send request in the dedicated QA motel", async ({
		page,
	}) => {
		if (!runContext || !managerSetupArtifacts) {
			throw new Error(
				"Live QA real-stack manager setup artifacts are missing; run the room and renter setup test in this suite first.",
			);
		}

		const context = runContext;
		const artifacts = managerSetupArtifacts;
		const motelId = context.motelId;
		const diagnostics = collectSafeDiagnostics(page);

		await page.goto(`/contracts?motel=${encodeURIComponent(motelId)}`);
		await expect(page.getByRole("heading", { name: "H\u1ee3p \u0111\u1ed3ng", exact: true })).toBeVisible();
		await expect(
			page
				.getByRole("banner")
				.getByRole("combobox", { name: "Nh\u00e0 tr\u1ecd", exact: true }),
		).toHaveAttribute("data-value", motelId);

		await page.getByRole("button", { name: "T\u1ea1o h\u1ee3p \u0111\u1ed3ng", exact: true }).click();
		const dialog = page.getByRole("dialog", { name: "T\u1ea1o h\u1ee3p \u0111\u1ed3ng nh\u00e1p" });
		await expect(dialog).toBeVisible();
		await dialog.getByLabel("Kh\u00e1ch thu\u00ea").selectOption(artifacts.renter.id);
		await dialog.getByLabel("Ph\u00f2ng").selectOption(artifacts.room.id);
		await dialog.getByLabel("Ng\u00e0y b\u1eaft \u0111\u1ea7u").fill("2026-11-01");
		await dialog.getByLabel("Ng\u00e0y k\u1ebft th\u00fac").fill("2027-10-31");
		await dialog.getByLabel("Ti\u1ec1n thu\u00ea/th\u00e1ng").fill("3.500.000");
		await dialog.getByLabel("Ti\u1ec1n c\u1ecdc").fill("1.000.000");

		const createResponsePromise = page.waitForResponse((response) => {
			const url = new URL(response.url());
			return (
				response.request().method() === "POST" &&
				url.pathname === `/api/manager/motels/${encodeURIComponent(motelId)}/contracts`
			);
		});

		await dialog
			.getByRole("button", { name: "T\u1ea1o h\u1ee3p \u0111\u1ed3ng nh\u00e1p", exact: true })
			.click();
		const createResponse = await createResponsePromise;
		expect(createResponse.status()).toBe(201);
		const created = (await createResponse.json()) as {
			id: string;
			motelId: string;
			renterId: string;
			roomId: string;
			managerSentAt: string | null;
			consentAcceptedAt: string | null;
		};
		expect(created.motelId).toBe(motelId);
		expect(created.renterId).toBe(artifacts.renter.id);
		expect(created.roomId).toBe(artifacts.room.id);
		expect(created.managerSentAt).toBeNull();
		expect(created.consentAcceptedAt).toBeNull();

		await expect(page.getByText("Ch\u01b0a g\u1eedi li\u00ean k\u1ebft", { exact: true })).toBeVisible();

		const sendResponsePromise = page.waitForResponse((response) => {
			const url = new URL(response.url());
			return (
				response.request().method() === "POST" &&
				url.pathname ===
					`/api/manager/motels/${encodeURIComponent(motelId)}/contracts/${created.id}/send`
			);
		});

		await page.getByRole("button", { name: "Y\u00eau c\u1ea7u g\u1eedi", exact: true }).click();
		const sendResponse = await sendResponsePromise;
		expect(sendResponse.status()).toBe(200);
		const updated = (await sendResponse.json()) as typeof created;
		expect(updated.motelId).toBe(motelId);
		expect(updated.renterId).toBe(artifacts.renter.id);
		expect(updated.roomId).toBe(artifacts.room.id);
		expect(updated.managerSentAt).not.toBeNull();
		expect(updated.consentAcceptedAt).toBeNull();

		await expect(
			page.getByText("\u0110\u00e3 g\u1eedi li\u00ean k\u1ebft \u00b7 ch\u1edd x\u00e1c nh\u1eadn", {
				exact: true,
			}),
		).toBeVisible();
		await page.reload();
		await expect(
			page.getByText("\u0110\u00e3 g\u1eedi li\u00ean k\u1ebft \u00b7 ch\u1edd x\u00e1c nh\u1eadn", {
				exact: true,
			}),
		).toBeVisible();
		expect(diagnostics).toEqual([]);
	});

	test(
		"records meter readings and invoices for the run-scoped room [BLOCKED: live QA not exercised in Task 4]",
		async ({ page }) => {
			// Task 4 only implements the local fixture-backed RED for billing and invoice arithmetic.
			// Live QA mutations remain gated and are not executed in this task; this stage will be
			// wired to the real stack when QA operators explicitly opt into E2E_QA_MUTATIONS=1.
			test.skip(
				true,
				"BLOCKED: QA meter capture and invoice generation not exercised; covered by local fixture suite in e2e/billing-meter.spec.ts.",
			);

			if (!runContext || !managerSetupArtifacts) {
				throw new Error(
					"Live QA real-stack manager setup artifacts are missing; run the room and renter setup test in this suite first.",
				);
			}

			// Skeleton for the future QA journey, kept close to the live stack but not invoked yet.
			const context = runContext;
			const artifacts = managerSetupArtifacts;
			const motelId = context.motelId;
			const diagnostics = collectSafeDiagnostics(page);

			await page.goto(`/billing?motel=${encodeURIComponent(motelId)}`);
			await expect(
				page.getByRole("heading", { name: "Tính tiền & Hóa đơn", exact: true }),
			).toBeVisible();

			// Persist opaque identifiers for Task 5 without logging IDs or PII.
			billingArtifacts = {
				periodId: "",
				readingIds: [],
				invoiceIds: [],
			};
			expect(diagnostics).toEqual([]);
		},
	);
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
