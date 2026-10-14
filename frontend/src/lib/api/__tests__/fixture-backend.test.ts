import type { AddressInfo } from "node:net";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createFixtureBackend } from "../../../../e2e/fixtures/backend-server";
import { MOTEL, ROOM, RENTER } from "./fixtures";
import type { CreateRenterInput, MotelResponse, RenterResponse, RoomResponse } from "../types";

let server: ReturnType<typeof createFixtureBackend>;
let baseUrl: string;
beforeEach(async () => {
  server = createFixtureBackend();
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});
afterEach(async () => {
  server.closeAllConnections();
  await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
});
function request(path: string, session = "session-a", method = "GET", body?: unknown) {
  return fetch(`${baseUrl}/api${path}`, { method, headers: { cookie: `manager_session=${session}`, "content-type": "application/json" }, body: body ? JSON.stringify(body) : undefined });
}
const renters = `/manager/motels/${MOTEL.id}/renters`;

describe("the fixture backend used by manager E2E", () => {
  it("persists renter creates/edits in RSC reads while isolating parallel sessions", async () => {
    const input: CreateRenterInput = { name: "Nguyễn An", phone: "84933333333", roomId: ROOM.id, idNumber: "00001234" };
    const created = await request(renters, "a", "POST", input);
    expect(created.status).toBe(201);
    const renter = await created.json() as RenterResponse;
    expect(renter).toMatchObject({ ...input, motelId: MOTEL.id, status: "active", isOaFollower: false, idCardFrontUrl: null, idCardBackUrl: null });
    expect((await (await request(renters, "a")).json() as RenterResponse[]).some((row) => row.id === renter.id)).toBe(true);
    expect((await (await request(renters, "b")).json() as RenterResponse[]).some((row) => row.id === renter.id)).toBe(false);
    await request(`${renters}/${renter.id}`, "a", "PATCH", { name: "Tên đã lưu", idNumber: null, roomId: null });
    expect(await (await request(`${renters}/${renter.id}`, "a")).json()).toMatchObject({ name: "Tên đã lưu", phone: "84933333333", idNumber: null, roomId: null, activeContract: null, invoices: [] });
  });
  it("returns honest duplicate and foreign assignment errors", async () => {
    expect((await request(renters, "a", "POST", { name: "Trùng", phone: RENTER.phone })).status).toBe(409);
    expect((await request(renters, "a", "POST", { name: "Ngoại", phone: "84933333333", roomId: "foreign" })).status).toBe(404);
    const missing = await request(`${renters}/missing`, "a");
    expect(missing.status).toBe(404);
    expect(await missing.json()).toEqual({ error: "Không tìm thấy khách thuê", code: "NOT_FOUND" });
  });
  it("persists motel and room creation before editing and filtering", async () => {
    const created = await request("/manager/motels", "no-motels-a", "POST", { name: "Nhà mới", electricityPrice: "3500", waterPrice: "25000" });
    const motel = await created.json() as MotelResponse;
    const rooms = `/manager/motels/${motel.id}/rooms`;
    const roomResponse = await request(rooms, "no-motels-a", "POST", { name: "P.0", floor: 0, basePrice: "99999999999999" });
    expect(roomResponse.status).toBe(201);
    const room = await roomResponse.json() as RoomResponse;
    await request(`${rooms}/${room.id}`, "no-motels-a", "PATCH", { name: "P.1", floor: null });
    expect(await (await request(`${rooms}?search=P.1`, "no-motels-a")).json()).toEqual([{ ...room, name: "P.1", floor: null }]);
    expect(await (await request("/manager/motels", "no-motels-b")).json()).toEqual([]);
  });
  it("sets a unique httpOnly session at login and expires it at logout", async () => {
    const login = await request("/auth/login", "a", "POST", { email: "minhanh@example.vn", password: "password123" });
    expect(login.status).toBe(200);
    expect(login.headers.get("set-cookie")).toMatch(/manager_session=login-[^;]+; Path=\/; HttpOnly; SameSite=Lax/);
    const logout = await request("/auth/logout", "a", "POST");
    expect(logout.status).toBe(204);
    expect(logout.headers.get("set-cookie")).toContain("Max-Age=0");
  });
  it("exposes the deterministic RSC 500 scenario rather than an empty list", async () => {
    const failed = await request(`/manager/motels/${MOTEL.id}/rooms`, "rooms-error-a");
    expect(failed.status).toBe(500);
    expect(await failed.json()).toEqual({ error: "private database host", code: "INTERNAL_ERROR" });
  });
  it("turns an omitted fixture into a harness failure instead of an application 5xx", async () => {
    await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
    const failures: Error[] = [];
    server = createFixtureBackend((failure) => failures.push(failure));
    await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
    baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;

    await expect(fetch(`${baseUrl}/api/manager/unsupported`, {
      headers: { cookie: "manager_session=session-a" },
    })).rejects.toThrow();
    expect(failures.map((failure) => failure.message)).toEqual([
      "fixtureBackend: no fixture for GET /api/manager/unsupported",
    ]);
  });
});
