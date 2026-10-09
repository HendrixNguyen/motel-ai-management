/** Test-only backend: RSC reads and mutations share typed, per-session state. */
import { createServer } from "node:http";
import { fileURLToPath } from "node:url";
import { MANAGER_AUTH, MANAGER_ME, MOTEL, MOTEL_WITHOUT_EXTRAS, ROOMS, RENTERS, CAPTURE_PERIOD, CAPTURE_PERIOD_DETAIL } from "../../src/lib/api/__tests__/fixtures";
import type { ApiErrorBody, CreateMotelInput, CreateRenterInput, CreateRoomInput, MotelResponse, RenterDetailResponse, RenterResponse, RoomResponse, UpdateMotelInput, UpdateRenterInput, UpdateRoomInput } from "../../src/lib/api/types";

export function createFixtureBackend(onMissingFixture: (failure: Error) => void = (failure) => {
  queueMicrotask(() => { throw failure; });
}) {
  const states = new Map<string, { motels: MotelResponse[]; rooms: RoomResponse[]; renters: RenterResponse[] }>();
  const signedRenters = new Map<string, string>();
  const magicLinks = new Map([
    ["flow-token", { expiresAt: Date.now() + 60 * 60 * 1000 }],
    ["keyboard-token", { expiresAt: Date.now() + 60 * 60 * 1000 }],
    ["expired-token", { expiresAt: Date.now() - 60 * 60 * 1000 }],
  ]);
  const exchangedTokens = new Set<string>();
  const stateFor = (session: string) => {
    if (!states.has(session)) states.set(session, {
      motels: session.startsWith("no-motels") ? [] : structuredClone([MOTEL, MOTEL_WITHOUT_EXTRAS]),
      rooms: structuredClone(ROOMS), renters: structuredClone(RENTERS),
    });
    return states.get(session)!;
  };
  return createServer(async (request, response) => {
    const url = new URL(request.url ?? "/", "http://127.0.0.1:3002");
    const path = url.pathname;
    const method = request.method;
    const session = /(?:^|;\s*)(?:manager_session|renter_session)=([^;]+)/.exec(request.headers.cookie ?? "")?.[1] ?? "anonymous";
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
        return json(MANAGER_AUTH);
      }
      if (method === "POST" && path === "/api/auth/logout") {
        response.writeHead(204, { "set-cookie": "manager_session=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0" }); return response.end();
      }
      if (method === "POST" && path === "/api/renter/magic-links/exchange") {
        const body = await input<{ token: string }>();
        if (typeof body.token !== "string" || !/^[a-z0-9-]{8,64}$/.test(body.token)) return error(401, "UNAUTHORIZED", "Liên kết không hợp lệ");
        const link = magicLinks.get(body.token);
        if (!link || link.expiresAt <= Date.now() || exchangedTokens.has(body.token)) return error(401, "MAGIC_LINK_EXPIRED", "Liên kết đã hết hạn");
        exchangedTokens.add(body.token);
        response.setHeader("set-cookie", "renter_session=fixture; Path=/; HttpOnly; SameSite=Lax"); return json({ renterId: "renter", motelId: "motel" });
      }
      if (path.startsWith("/api/renter/")) {
        if (path === "/api/renter/logout" && method === "POST") { response.writeHead(204, { "set-cookie": "renter_session=; Path=/; Max-Age=0" }); return response.end(); }
        if (path === "/api/renter/me") return json({ id: "renter", name: "An", phone: "84901234567", room: { id: "room", name: "P.101", floor: 1 }, motel: { id: "motel", name: "Nhà trọ Minh Anh" }, activeContract: null });
        if (method === "GET" && path === "/api/renter/billing/periods") return json([{ id: "period", month: 10, year: 2026, status: "sent", createdAt: "2026-10-01T00:00:00.000Z" }]);
        if (method === "GET" && path.match(/^\/api\/renter\/billing\/periods\/[^/]+\/invoices$/)) return json([{ id: "invoice", billingPeriodId: "period", month: 10, year: 2026, roomId: "room", roomName: "P.101", rentAmount: "3500000", electricityUsage: "20.00", electricityCost: "70000", waterUsage: "3.00", waterCost: "45000", otherFees: [{ name: "Vệ sinh", amount: "50000" }], totalAmount: "3665000", qrCodeData: "000201010212", paymentStatus: "unpaid", paidAt: null, createdAt: "2026-10-01T00:00:00.000Z" }]);
        if (method === "GET" && path.match(/^\/api\/renter\/invoices\/[^/]+$/)) return json({ id: "invoice", billingPeriodId: "period", month: 10, year: 2026, roomId: "room", roomName: "P.101", rentAmount: "3500000", electricityUsage: "20.00", electricityCost: "70000", waterUsage: "3.00", waterCost: "45000", otherFees: [{ name: "Vệ sinh", amount: "50000" }], totalAmount: "3665000", qrCodeData: "000201010212", paymentStatus: "unpaid", paidAt: null, createdAt: "2026-10-01T00:00:00.000Z" });
        if (path === "/api/renter/contracts/contract/verify" && method === "POST") { const otpSignedAt = new Date().toISOString(); signedRenters.set(session, otpSignedAt); return json({ otpSignedAt, status: "active" }); }
        if (path === "/api/renter/contract" && method === "GET") { const otpSignedAt = signedRenters.get(session) ?? null; return json({ id: "contract", status: otpSignedAt ? "active" : "draft", monthlyRent: "3500000", deposit: "3500000", startDate: "2026-10-01", endDate: "2027-09-30", clauses: [{ title: "Điều khoản", content: "Nội dung" }], otpSignedAt }); }
        if (path === "/api/renter/tickets" && method === "GET") return json([]);
        if (path === "/api/renter/tickets" && method === "POST") return json({ id: "ticket", category: "water", description: "Nước bị rò rỉ trong phòng", status: "open", createdAt: new Date().toISOString() }, 201);
      }
      if (!session) return unauthorized();
      if (method === "GET" && path === "/api/auth/me") return session === "me-expired" ? unauthorized() : json(MANAGER_ME);
      const state = stateFor(session);
      if (method === "GET" && path.match(/^\/api\/manager\/motels\/[^/]+\/billing\/periods$/)) return json([CAPTURE_PERIOD]);
      if (method === "GET" && path.match(/^\/api\/manager\/motels\/[^/]+\/billing\/periods\/[^/]+$/)) return json(session === "sent-capture" ? { ...CAPTURE_PERIOD_DETAIL, status: "sent" } : CAPTURE_PERIOD_DETAIL);
      if (method === "GET" && path.match(/^\/api\/manager\/motels\/[^/]+\/billing\/periods\/[^/]+\/invoices$/)) return json([]);
      if (method === "PUT" && path.match(/^\/api\/manager\/motels\/[^/]+\/billing\/periods\/[^/]+\/readings$/)) return json({ ok: true });
      if (path === "/api/manager/motels") {
        if (method === "GET") return session === "motels-expired" ? unauthorized() : json(state.motels);
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
            if (session.startsWith("rooms-error")) return error(500, "INTERNAL_ERROR", "private database host");
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
              idNumber: create.idNumber ?? null, roomId: create.roomId ?? null, idCardFrontUrl: create.idCardFrontUrl ?? null, idCardBackUrl: create.idCardBackUrl ?? null,
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
  server.listen(3002, "127.0.0.1");
  process.on("SIGTERM", () => server.close(() => process.exit(0)));
  process.on("SIGINT", () => server.close(() => process.exit(0)));
}
