/**
 * Test-only backend for Server Component reads and real same-origin Set-Cookie forwarding.
 * page.route() continues to cover browser API fixtures; it cannot intercept Next's server fetch.
 * Started only by the fixture-backed Playwright webServer, never by the application.
 */
import { createServer } from "node:http";
import { MANAGER_AUTH, MANAGER_ME, MOTEL, MOTEL_WITHOUT_EXTRAS, ROOMS, RENTERS } from "../../src/lib/api/__tests__/fixtures";
import type { MotelResponse, RoomResponse, UpdateMotelInput, UpdateRoomInput } from "../../src/lib/api/types";

// Each test session owns its motel state, so refresh assertions cannot affect parallel specs.
const motelsBySession = new Map<string, MotelResponse[]>();
function sessionMotels(session: string) {
  if (!motelsBySession.has(session)) motelsBySession.set(session, session === "no-motels" ? [] : structuredClone([MOTEL, MOTEL_WITHOUT_EXTRAS]));
  return motelsBySession.get(session)!;
}
const roomsBySession = new Map<string, RoomResponse[]>();
function sessionRooms(session: string) {
  if (!roomsBySession.has(session)) roomsBySession.set(session, structuredClone(ROOMS));
  return roomsBySession.get(session)!;
}

const server = createServer(async (request, response) => {
  const url = new URL(request.url ?? "/", "http://127.0.0.1:3002");
  const path = url.pathname;
  const session = /(?:^|;\s*)manager_session=([^;]+)/.exec(request.headers.cookie ?? "")?.[1];
  const json = (body: unknown, status = 200) => {
    response.writeHead(status, { "content-type": "application/json" });
    response.end(JSON.stringify(body));
  };
  const unauthorized = () => json({ error: "Chưa đăng nhập", code: "UNAUTHORIZED" }, 401);

  if (path === "/health") return json({ ok: true });
  if (request.method === "POST" && path === "/api/auth/login") {
    let raw = "";
    for await (const chunk of request) raw += String(chunk);
    let input: { email?: string; password?: string };
    try { input = JSON.parse(raw) as typeof input; }
    catch { return json({ error: "Dữ liệu không hợp lệ", code: "VALIDATION_ERROR" }, 400); }
    if (input.email !== MANAGER_ME.email || input.password !== "password123") {
      return json({ error: "Email hoặc mật khẩu không đúng", code: "VALIDATION_ERROR" }, 400);
    }
    response.setHeader("set-cookie", "manager_session=valid; Path=/; HttpOnly; SameSite=Lax");
    return json(MANAGER_AUTH);
  }
  if (request.method === "POST" && path === "/api/auth/logout") {
    response.writeHead(204, { "set-cookie": "manager_session=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0" });
    return response.end();
  }
  if (request.method === "GET" && path === "/api/auth/me") {
    if (!session || session === "me-expired") return unauthorized();
    return json(MANAGER_ME);
  }
  if (request.method === "GET" && path === "/api/manager/motels") {
    if (!session || session === "motels-expired") return unauthorized();
    return json(sessionMotels(session));
  }
  if (request.method === "PATCH" && path === `/api/manager/motels/${MOTEL.id}`) {
    if (!session) return unauthorized();
    const motel = sessionMotels(session).find((row) => row.id === MOTEL.id);
    if (!motel) return json({ error: "Không tìm thấy nhà trọ", code: "NOT_FOUND" }, 404);
    let raw = "";
    for await (const chunk of request) raw += String(chunk);
    let input: UpdateMotelInput;
    try { input = JSON.parse(raw) as UpdateMotelInput; }
    catch { return json({ error: "Dữ liệu không hợp lệ", code: "VALIDATION_ERROR" }, 400); }
    Object.assign(motel, input);
    return json(motel);
  }
  if (request.method === "GET" && path === `/api/manager/motels/${MOTEL.id}/rooms`) {
    if (!session) return unauthorized();
    return json(sessionRooms(session).filter((room) =>
      (!url.searchParams.has("floor") || room.floor === Number(url.searchParams.get("floor"))) &&
      (!url.searchParams.has("status") || room.status === url.searchParams.get("status")) &&
      (!url.searchParams.get("search") || room.name.toLowerCase().includes(url.searchParams.get("search")!.toLowerCase()))));
  }
  if (request.method === "GET" && path === `/api/manager/motels/${MOTEL_WITHOUT_EXTRAS.id}/rooms`) {
    if (!session) return unauthorized();
    return json([]);
  }
  if (request.method === "GET" && path === `/api/manager/motels/${MOTEL.id}/renters`) {
    if (!session) return unauthorized();
    return json(RENTERS);
  }
  if (request.method === "GET" && path === `/api/manager/motels/${MOTEL_WITHOUT_EXTRAS.id}/renters`) {
    if (!session) return unauthorized();
    return json([]);
  }
  if (request.method === "PATCH" && path.startsWith(`/api/manager/motels/${MOTEL.id}/rooms/`)) {
    if (!session) return unauthorized();
    const room = sessionRooms(session).find((row) => row.id === path.split("/").at(-1));
    if (!room) return json({ error: "Không tìm thấy phòng", code: "NOT_FOUND" }, 404);
    let raw = "";
    for await (const chunk of request) raw += String(chunk);
    let input: UpdateRoomInput;
    try { input = JSON.parse(raw) as UpdateRoomInput; }
    catch { return json({ error: "Dữ liệu không hợp lệ", code: "VALIDATION_ERROR" }, 400); }
    Object.assign(room, input);
    return json(room);
  }
  // An omitted fixture must fail the run, never masquerade as a legitimate resource 404.
  throw new Error(`fixtureBackend: no fixture for ${request.method} ${path}`);
});

server.listen(3002, "127.0.0.1");
process.on("SIGTERM", () => server.close(() => process.exit(0)));
process.on("SIGINT", () => server.close(() => process.exit(0)));
