/** Test-only backend: RSC reads and mutations share typed, per-session state. */
import { createServer } from "node:http";
import { fileURLToPath } from "node:url";
import { MANAGER_AUTH, MANAGER_ME, MOTEL, MOTEL_WITHOUT_EXTRAS, ROOMS, RENTERS, CAPTURE_PERIOD, CAPTURE_PERIOD_DETAIL, INVOICE_ID, BILLING_PERIOD_ID, RENTER_ID } from "../../src/lib/api/__tests__/fixtures";
import type { ApiErrorBody, CreateMotelInput, CreateRenterInput, CreateRoomInput, InvoiceResponse, MotelResponse, RenterDetailResponse, RenterResponse, RoomResponse, UpdateMotelInput, UpdateRenterInput, UpdateRoomInput } from "../../src/lib/api/types";

export function createFixtureBackend(onMissingFixture: (failure: Error) => void = (failure) => {
  queueMicrotask(() => { throw failure; });
}) {
  const states = new Map<string, { motels: MotelResponse[]; rooms: RoomResponse[]; renters: RenterResponse[]; invoices: InvoiceResponse[]; proofs: Map<string, { id: string; invoiceId: string; renterId: string; status: "pending" | "approved" | "rejected"; contentType: "image/jpeg"; size: number; submittedAt: string; reviewedAt: string | null; reviewedByManagerId: string | null; rejectionReason: string | null; signedUrl: string }> }>();
  const templateStore = new Map<string, { id: string; motelId: string; name: string; clauses: { title: string; content: string }[]; isDefault: boolean; createdAt: string }>();
  const signedRenters = new Map<string, string>();
  const magicLinks = new Map([
    ["flow-token", { expiresAt: Date.now() + 24 * 60 * 60 * 1000 }],
    ["keyboard-token", { expiresAt: Date.now() + 24 * 60 * 60 * 1000 }],
    ["expired-token", { expiresAt: Date.now() - 60 * 60 * 1000 }],
  ]);
  const exchangedTokens = new Set<string>();
  const stateFor = (session: string) => {
    if (!states.has(session)) states.set(session, {
      motels: session.startsWith("no-motels") ? [] : structuredClone([MOTEL, MOTEL_WITHOUT_EXTRAS]),
      rooms: structuredClone(ROOMS), renters: structuredClone(RENTERS),
      invoices: session.startsWith("payment-review") ? [{ id: INVOICE_ID, billingPeriodId: BILLING_PERIOD_ID, roomId: ROOMS[0]!.id, roomName: ROOMS[0]!.name, renterId: RENTER_ID, motelId: MOTEL.id, rentAmount: "3500000", electricityUsage: "20.00", electricityCost: "70000", waterUsage: "3.00", waterCost: "45000", otherFees: [], totalAmount: "3615000", qrCodeData: null, paymentStatus: "unpaid", paymentMethod: null, paidAt: null, createdAt: "2026-10-01T00:00:00.000Z" }, { id: "invoice-approve", billingPeriodId: BILLING_PERIOD_ID, roomId: "room-approve", roomName: "P.102", renterId: RENTER_ID, motelId: MOTEL.id, rentAmount: "3500000", electricityUsage: "20.00", electricityCost: "70000", waterUsage: "3.00", waterCost: "45000", otherFees: [], totalAmount: "3615000", qrCodeData: null, paymentStatus: "unpaid", paymentMethod: null, paidAt: null, createdAt: "2026-10-01T00:00:00.000Z" }, { id: "invoice-cash", billingPeriodId: BILLING_PERIOD_ID, roomId: "room-cash", roomName: "P.103", renterId: RENTER_ID, motelId: MOTEL.id, rentAmount: "3500000", electricityUsage: "20.00", electricityCost: "70000", waterUsage: "3.00", waterCost: "45000", otherFees: [], totalAmount: "3615000", qrCodeData: null, paymentStatus: "unpaid", paymentMethod: null, paidAt: null, createdAt: "2026-10-01T00:00:00.000Z" }] : [],
      proofs: new Map(session.startsWith("payment-review") ? [[INVOICE_ID, { id: "proof-fixture", invoiceId: INVOICE_ID, renterId: RENTER_ID, status: "pending", contentType: "image/jpeg", size: 100, submittedAt: "2026-10-01T00:00:00.000Z", reviewedAt: null, reviewedByManagerId: null, rejectionReason: null, signedUrl: "data:image/jpeg;base64,/9j/2Q==" }], ["invoice-approve", { id: "proof-approve", invoiceId: "invoice-approve", renterId: RENTER_ID, status: "pending", contentType: "image/jpeg", size: 100, submittedAt: "2026-10-01T00:00:00.000Z", reviewedAt: null, reviewedByManagerId: null, rejectionReason: null, signedUrl: "data:image/jpeg;base64,/9j/2Q==" }]] : []),
    });
    return states.get(session)!;
  };
  return createServer(async (request, response) => {
    const url = new URL(request.url ?? "/", "http://127.0.0.1:3002");
    const path = url.pathname;
    const method = request.method;
    const cookieValue = (name: string) => new RegExp(`(?:^|;\\s*)${name}=([^;]*)`).exec(request.headers.cookie ?? "")?.[1] ?? "";
    const managerSession = cookieValue("manager_session");
    const renterSession = cookieValue("renter_session");
    const json = (body: unknown, status = 200) => {
      response.writeHead(status, { "content-type": "application/json" }); response.end(JSON.stringify(body));
    };
    const error = (status: number, code: ApiErrorBody["code"], message: string) => json({ error: message, code } satisfies ApiErrorBody, status);
    const unauthorized = () => error(401, "UNAUTHORIZED", "Chưa đăng nhập");
    async function input<T>(): Promise<T> {
      let raw = "";
      for await (const chunk of request) raw += String(chunk);
      return JSON.parse(raw) as T;
    }
    try {
      if (path === "/health") return json({ ok: true });
      if (method === "POST" && path === "/api/auth/login") {
        const body = await input<{ email: string; password: string }>();
        if (body.email !== MANAGER_ME.email || body.password !== "password123") return error(400, "VALIDATION_ERROR", "Email hoặc mật khẩu không đúng");
        response.setHeader("set-cookie", `manager_session=login-${crypto.randomUUID()}; Path=/; HttpOnly; SameSite=Lax`);
        return json({ ...MANAGER_AUTH, id: "manager-a" });
      }
      if (method === "POST" && path === "/api/auth/logout") {
        response.writeHead(204, { "set-cookie": "manager_session=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0" }); return response.end();
      }
      if (method === "POST" && path === "/api/renter/magic-links/exchange") {
        const body = await input<{ token: string }>();
        if (typeof body.token !== "string") return error(400, "VALIDATION_ERROR", "Mã liên kết không hợp lệ");
        const link = magicLinks.get(body.token);
        if (!link || link.expiresAt <= Date.now() || exchangedTokens.has(body.token)) return error(401, "MAGIC_LINK_EXPIRED", "Liên kết đã hết hạn");
        exchangedTokens.add(body.token);
        response.setHeader("set-cookie", "renter_session=fixture; Path=/; HttpOnly; SameSite=Lax"); return json({ renterId: "renter", motelId: "motel" });
      }
      if (path.startsWith("/api/renter/")) {
        if (renterSession !== "fixture") return unauthorized();
        if (path === "/api/renter/logout" && method === "POST") { response.writeHead(204, { "set-cookie": "renter_session=; Path=/; Max-Age=0" }); return response.end(); }
        if (path === "/api/renter/push/key" && method === "GET") return json({ enabled: false, publicKey: null });
        if (path === "/api/renter/push/subscription" && method === "GET") return json({ subscription: null });
        if (path === "/api/renter/push/subscription" && method === "POST") return json({ registered: true, subscriptionId: "push-subscription" });
        if (path === "/api/renter/push/subscription" && method === "DELETE") return json({ removed: true });
        if (path === "/api/renter/me") return json({ id: "renter", name: "An", phone: "84901234567", room: { id: "room", name: "P.101", floor: 1 }, motel: { id: "motel", name: "Nhà trọ Minh Anh" }, activeContract: null });
        if (method === "GET" && path === "/api/renter/billing/periods") return json([{ id: "period", month: 10, year: 2026, status: "sent", createdAt: "2026-10-01T00:00:00.000Z" }]);
        if (method === "GET" && path.match(/^\/api\/renter\/billing\/periods\/[^/]+\/invoices$/)) return json([{ id: "invoice", billingPeriodId: "period", month: 10, year: 2026, roomId: "room", roomName: "P.101", rentAmount: "3500000", electricityUsage: "20.00", electricityCost: "70000", waterUsage: "3.00", waterCost: "45000", otherFees: [{ name: "Vệ sinh", amount: "50000" }], totalAmount: "3665000", qrCodeData: "000201010212", paymentStatus: "unpaid", paidAt: null, createdAt: "2026-10-01T00:00:00.000Z" }]);
        if (method === "GET" && path.match(/^\/api\/renter\/invoices\/[^/]+$/)) return json({ id: "invoice", billingPeriodId: "period", month: 10, year: 2026, roomId: "room", roomName: "P.101", rentAmount: "3500000", electricityUsage: "20.00", electricityCost: "70000", waterUsage: "3.00", waterCost: "45000", otherFees: [{ name: "Vệ sinh", amount: "50000" }], totalAmount: "3665000", qrCodeData: "000201010212", paymentStatus: "unpaid", paidAt: null, createdAt: "2026-10-01T00:00:00.000Z" });
        if (path === "/api/renter/contracts/contract/consent" && method === "POST") {
          const body = await input<{ consent: boolean; termsVersion: string }>();
          if (body.consent !== true || body.termsVersion !== "a".repeat(64)) return error(409, "CONFLICT", "Điều khoản đã thay đổi");
          const consentAcceptedAt = new Date().toISOString(); signedRenters.set(renterSession, consentAcceptedAt);
          return json({ id: "contract", status: "active", consentAcceptedAt, consentMethod: "session_consent", consentEvidence: { termsVersion: body.termsVersion, acceptedTermsSnapshot: { termsVersion: body.termsVersion } } });
        }
        if (path === "/api/renter/contract" && method === "GET") { const consentAcceptedAt = signedRenters.get(renterSession) ?? null; return json({ id: "contract", status: consentAcceptedAt ? "active" : "draft", motelId: "motel", renterId: "renter", roomId: "room", monthlyRent: "3500000", deposit: "3500000", startDate: "2026-10-01", endDate: "2027-09-30", clauses: [{ title: "Điều khoản", content: "Nội dung" }], termsVersion: "a".repeat(64), consentAcceptedAt, consentMethod: consentAcceptedAt ? "session_consent" : null, consentEvidence: consentAcceptedAt ? { termsVersion: "a".repeat(64), acceptedTermsSnapshot: { termsVersion: "a".repeat(64) } } : null, otpSentAt: null, otpSignedAt: null, createdAt: "2026-10-01T00:00:00.000Z" }); }
        if (method === "GET" && path.match(/^\/api\/renter\/invoices\/[^/]+\/payment-proof$/)) return json(null);
        if (method === "GET" && path === "/api/renter/tickets") return json([]);
        if (path === "/api/renter/tickets" && method === "POST") { const body = await input<{ category: string; description: string }>(); return json({ id: "ticket", category: body.category, description: body.description, status: "open", createdAt: new Date().toISOString() }, 201); }
      }
      if (!managerSession) return unauthorized();
      if (method === "GET" && path === "/api/auth/me") return managerSession === "me-expired" ? unauthorized() : json(MANAGER_ME);
      if (method === "GET" && path.match(/^\/api\/manager\/motels\/[^/]+\/contracts$/)) return json(managerSession.startsWith("contract-") ? [{ id: managerSession === "contract-active" ? "contract-active" : "contract-draft", motelId: MOTEL.id, renterId: RENTERS[0]!.id, roomId: ROOMS[0]!.id, startDate: "2026-01-01", endDate: "2027-01-01", monthlyRent: "3500000", deposit: "1000000", clauses: [{ title: "Tiền thuê", content: "Đúng hạn" }], otpSentAt: null, otpSignedAt: null, status: managerSession === "contract-active" ? "active" : "draft", createdAt: "2026-01-01T00:00:00.000Z" }] : []);
      if (method === "GET" && path.match(/^\/api\/manager\/motels\/[^/]+\/contracts\/contract-draft$/) && managerSession === "contract-draft") return json({ id: "contract-draft", motelId: MOTEL.id, renterId: RENTERS[0]!.id, roomId: ROOMS[0]!.id, startDate: "2026-01-01", endDate: "2027-01-01", monthlyRent: "3500000", deposit: "1000000", clauses: [{ title: "Tiền thuê", content: "Đúng hạn" }], otpSentAt: null, otpSignedAt: null, status: "draft", createdAt: "2026-01-01T00:00:00.000Z" });
      if (method === "GET" && path.match(/^\/api\/manager\/motels\/[^/]+\/contract-templates$/)) { const created = templateStore.get(managerSession); return json([{ id: "contract-template", motelId: MOTEL.id, name: "Chuẩn", clauses: [{ title: "Tiền thuê", content: "Đúng hạn" }], isDefault: true, createdAt: "2026-01-01T00:00:00.000Z" }, ...(created ? [created] : [])]); }
      if (method === "PATCH" && path.match(/^\/api\/manager\/motels\/[^/]+\/contracts\/contract-draft$/) && managerSession === "contract-draft") { const body = await input<Record<string, unknown>>(); return json({ id: "contract-draft", motelId: MOTEL.id, renterId: RENTERS[0]!.id, roomId: ROOMS[0]!.id, startDate: "2026-01-01", endDate: "2027-01-01", monthlyRent: "3500000", deposit: "1000000", clauses: [{ title: "Tiền thuê", content: "Đúng hạn" }], otpSentAt: null, otpSignedAt: null, status: "draft", createdAt: "2026-01-01T00:00:00.000Z", ...body }); }
      if (method === "POST" && path.match(/^\/api\/manager\/motels\/[^/]+\/contracts\/contract-active\/terminate$/) && managerSession === "contract-active") return json({ id: "contract-active", motelId: MOTEL.id, renterId: RENTERS[0]!.id, roomId: ROOMS[0]!.id, startDate: "2026-01-01", endDate: "2027-01-01", monthlyRent: "3500000", deposit: "1000000", clauses: [{ title: "Tiền thuê", content: "Đúng hạn" }], otpSentAt: null, otpSignedAt: null, status: "terminated", createdAt: "2026-01-01T00:00:00.000Z" });
      if (method === "POST" && path.match(/^\/api\/manager\/motels\/[^/]+\/contracts$/)) { const body = await input<Record<string, unknown>>(); return json({ id: "contract-created", motelId: MOTEL.id, ...body, otpSentAt: null, otpSignedAt: null, status: "draft", createdAt: new Date().toISOString() }, 201); }
      if (method === "POST" && path.match(/^\/api\/manager\/motels\/[^/]+\/contract-templates$/)) { const body = await input<{ name: string; clauses: { title: string; content: string }[] }>(); const created = { id: "contract-template-created", motelId: MOTEL.id, ...body, isDefault: false, createdAt: new Date().toISOString() }; templateStore.set(managerSession, created); return json(created, 201); }
      if (method === "PATCH" && path.match(/^\/api\/manager\/motels\/[^/]+\/contract-templates\/contract-template-created$/)) { const body = await input<{ name: string; clauses?: { title: string; content: string }[] }>(); const updated = { ...(templateStore.get(managerSession) ?? { id: "contract-template-created", motelId: MOTEL.id, name: "Hợp đồng mới", clauses: [{ title: "Tiền cọc", content: "Hoàn lại khi bàn giao phòng" }], isDefault: false, createdAt: "2026-01-01T00:00:00.000Z" }), ...body }; templateStore.set(managerSession, updated); return json(updated); }
      if (method === "DELETE" && path.match(/^\/api\/manager\/motels\/[^/]+\/contract-templates\/contract-template-created$/)) { templateStore.delete(managerSession); return json({ deleted: true }); }
      const state = stateFor(managerSession);
      if (method === "GET" && path.match(/^\/api\/manager\/motels\/[^/]+\/billing\/periods$/)) return json([CAPTURE_PERIOD]);
      if (method === "GET" && path.match(/^\/api\/manager\/motels\/[^/]+\/billing\/periods\/[^/]+$/)) return json(managerSession === "sent-capture" ? { ...CAPTURE_PERIOD_DETAIL, status: "sent" } : CAPTURE_PERIOD_DETAIL);
      const invoiceList = /^\/api\/manager\/motels\/([^/]+)\/billing\/periods\/([^/]+)\/invoices$/.exec(path);
      if (method === "GET" && invoiceList) return json(state.invoices.filter((invoice) => invoice.motelId === invoiceList[1] && invoice.billingPeriodId === invoiceList[2]));
      const paymentRoute = /^\/api\/manager\/motels\/([^/]+)\/billing\/invoices\/([^/]+)\/(payment-proof(?:\/(?:approve|reject))?|cash-confirmation)$/.exec(path);
      if (paymentRoute) {
        const [, motelId, invoiceId, action] = paymentRoute;
        if (!motelId || !invoiceId || !action) return error(404, "NOT_FOUND", "Không tìm thấy hóa đơn");
        const invoice = state.invoices.find((item) => item.id === invoiceId && item.motelId === motelId);
        if (!invoice) return error(404, "NOT_FOUND", "Không tìm thấy hóa đơn");
        const proof = state.proofs.get(invoiceId);
        if (method === "GET" && action === "payment-proof") return json(proof ?? null);
        if (method === "POST" && action === "payment-proof/reject") {
          const body = await input<{ reason: string }>();
          const reason = body.reason.trim();
          if (!reason || reason.length > 500) return error(400, "VALIDATION_ERROR", "Lý do từ chối phải dài từ 1 đến 500 ký tự");
          if (!proof || proof.status !== "pending") return error(409, "CONFLICT", "Không có chứng từ chờ duyệt");
          proof.status = "rejected"; proof.rejectionReason = reason; proof.reviewedAt = new Date().toISOString(); proof.reviewedByManagerId = MANAGER_ME.id;
          return json({ id: proof.id, invoiceId, status: proof.status, rejectionReason: reason });
        }
        if (method === "POST" && action === "payment-proof/approve") {
          if (!proof || proof.status !== "pending") return error(409, "CONFLICT", "Không có chứng từ chờ duyệt");
          proof.status = "approved"; proof.reviewedAt = new Date().toISOString(); proof.reviewedByManagerId = MANAGER_ME.id;
          invoice.paymentStatus = "paid"; invoice.paymentMethod = "bank_transfer"; invoice.paidAt = proof.reviewedAt;
          return json({ invoiceId, paymentStatus: "paid", paidAt: invoice.paidAt, paymentMethod: "bank_transfer" });
        }
        if (method === "POST" && action === "cash-confirmation") {
          invoice.paymentStatus = "paid"; invoice.paymentMethod = "cash"; invoice.paidAt = new Date().toISOString();
          return json({ invoiceId, paymentStatus: "paid", paidAt: invoice.paidAt, paymentMethod: "cash" });
        }
      }
      if (method === "GET" && path.match(/^\/api\/manager\/motels\/[^/]+\/billing\/periods\/[^/]+\/invoices$/)) return json([]);
      if (method === "PUT" && path.match(/^\/api\/manager\/motels\/[^/]+\/billing\/periods\/[^/]+\/readings$/)) return json({ ok: true });
      if (path === "/api/manager/motels") {
        if (method === "GET") return managerSession === "motels-expired" ? unauthorized() : json(state.motels);
        if (method === "POST") {
          const body = await input<CreateMotelInput>();
          const motel: MotelResponse = { id: crypto.randomUUID(), managerId: MANAGER_ME.id, name: body.name, address: body.address ?? null,
            electricityPrice: body.electricityPrice, waterPrice: body.waterPrice, otherFees: body.otherFees ?? [], bankAccount: body.bankAccount ?? null, createdAt: new Date().toISOString() };
          state.motels.push(motel); return json(motel, 201);
        }
      }
      const scope = /^\/api\/manager\/motels\/([^/]+)(?:\/(rooms|renters)(?:\/([^/]+))?)?$/.exec(path);
      if (scope) {
        const [, motelId, collection, id] = scope;
        const motel = state.motels.find((row) => row.id === motelId);
        if (!motel) return error(404, "NOT_FOUND", "Không tìm thấy nhà trọ");
        if (!collection && method === "GET") return json(motel);
        if (!collection && method === "PATCH") { Object.assign(motel, await input<UpdateMotelInput>()); return json(motel); }
        if (collection === "rooms") {
          const rooms = state.rooms.filter((room) => room.motelId === motelId);
          if (method === "GET" && !id) {
            if (managerSession.startsWith("rooms-error")) return error(500, "INTERNAL_ERROR", "private database host");
            return json(rooms.filter((room) =>
              (!url.searchParams.has("floor") || room.floor === Number(url.searchParams.get("floor"))) &&
              (!url.searchParams.has("status") || room.status === url.searchParams.get("status")) &&
              (!url.searchParams.get("search") || room.name.toLowerCase().includes(url.searchParams.get("search")!.toLowerCase()))));
          }
          if (method === "POST" && !id) {
            const body = await input<CreateRoomInput>();
            if (rooms.some((room) => room.name === body.name)) return error(409, "CONFLICT", "Tên phòng đã tồn tại trong nhà trọ này");
            const room: RoomResponse = { id: crypto.randomUUID(), motelId: motel.id, name: body.name, basePrice: body.basePrice, floor: body.floor ?? null, status: body.status ?? "available", createdAt: new Date().toISOString() };
            state.rooms.push(room); return json(room, 201);
          }
          if (method === "PATCH" && id) {
            const room = rooms.find((row) => row.id === id);
            if (!room) return error(404, "NOT_FOUND", "Không tìm thấy phòng");
            const body = await input<UpdateRoomInput>();
            if (body.name && rooms.some((row) => row.id !== id && row.name === body.name)) return error(409, "CONFLICT", "Tên phòng đã tồn tại trong nhà trọ này");
            Object.assign(room, body); return json(room);
          }
        }
        if (collection === "renters") {
          const renters = state.renters.filter((renter) => renter.motelId === motelId);
          if (method === "GET" && !id) return json(renters.filter((renter) =>
            (!url.searchParams.has("roomId") || renter.roomId === url.searchParams.get("roomId")) &&
            (!url.searchParams.has("status") || renter.status === url.searchParams.get("status")) &&
            (!url.searchParams.get("search") || `${renter.name} ${renter.phone}`.toLowerCase().includes(url.searchParams.get("search")!.toLowerCase()))));
          if (method === "GET" && id) {
            const renter = renters.find((row) => row.id === id);
            if (!renter) return error(404, "NOT_FOUND", "Không tìm thấy khách thuê");
            const detail: RenterDetailResponse = { ...renter, activeContract: null, invoices: [] };
            return json(detail);
          }
          if ((method === "POST" && !id) || (method === "PATCH" && id)) {
            const body = await input<CreateRenterInput | UpdateRenterInput>();
            if (body.roomId && !state.rooms.some((room) => room.id === body.roomId && room.motelId === motelId)) return error(404, "NOT_FOUND", "Không tìm thấy phòng");
            if (body.phone && renters.some((row) => row.id !== id && row.phone === body.phone)) return error(409, "CONFLICT", "Số điện thoại đã tồn tại trong nhà trọ này");
            if (id) {
              const renter = renters.find((row) => row.id === id);
              if (!renter) return error(404, "NOT_FOUND", "Không tìm thấy khách thuê");
              Object.assign(renter, body); return json(renter);
            }
            const create = body as CreateRenterInput;
            const renter: RenterResponse = { id: crypto.randomUUID(), motelId: motel.id, name: create.name, phone: create.phone,
              idNumber: create.idNumber ?? null, roomId: create.roomId ?? null, idCardFrontUploaded: false, idCardBackUploaded: false,
              zaloOaId: null, isOaFollower: false, status: "active", createdAt: new Date().toISOString() };
            state.renters.push(renter); return json(renter, 201);
          }
        }
      }
      // A missing fixture is a broken test harness, not an application response. Destroy the
      // request and crash the test-only server so ordinary 5xx UI cannot accidentally satisfy
      // an error-state assertion.
      const missingFixture = new Error(`fixtureBackend: no fixture for ${method} ${path}`);
      response.destroy(missingFixture);
      onMissingFixture(missingFixture);
      return;
    } catch (failure) {
      if (failure instanceof SyntaxError) return error(400, "VALIDATION_ERROR", "Dữ liệu không hợp lệ");
      console.error(failure); return error(500, "INTERNAL_ERROR", "Fixture backend failed");
    }
  });
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const server = createFixtureBackend();
  server.listen(Number(process.env.E2E_FIXTURE_PORT ?? 3002), "127.0.0.1");
  process.on("SIGTERM", () => server.close(() => process.exit(0)));
  process.on("SIGINT", () => server.close(() => process.exit(0)));
}
