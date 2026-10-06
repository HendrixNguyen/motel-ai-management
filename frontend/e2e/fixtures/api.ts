import type { Page } from "@playwright/test";
import type { ApiErrorBody, MagicLinkResponse, ManagerAuthResponse, ManagerMeResponse, MotelResponse, RenterDetailResponse, RenterResponse, RoomResponse } from "../../src/lib/api/types";

type Fixture<T> = T | { status: number; body: T | ApiErrorBody };
/** Route-keyed DTOs: assigning a motel to a rooms fixture is a compile error. */
export type ApiFixtures = Partial<{
  "GET /api/auth/me": Fixture<ManagerMeResponse>;
  "POST /api/auth/login": Fixture<ManagerAuthResponse>;
  "POST /api/auth/logout": Fixture<void>;
  "GET /api/manager/motels": Fixture<MotelResponse[]>;
  "POST /api/manager/motels": Fixture<MotelResponse>;
} & { [path: `PATCH /api/manager/motels/${string}`]: Fixture<MotelResponse | RoomResponse | RenterResponse> }
  & { [path: `GET /api/manager/motels/${string}/rooms`]: Fixture<RoomResponse[]> }
  & { [path: `POST /api/manager/motels/${string}/rooms`]: Fixture<RoomResponse> }
  & { [path: `GET /api/manager/motels/${string}/renters`]: Fixture<RenterResponse[]> }
  & { [path: `POST /api/manager/motels/${string}/renters`]: Fixture<RenterResponse> }
  & { [path: `GET /api/manager/motels/${string}/renters/${string}`]: Fixture<RenterDetailResponse> }
  & { [path: `POST /api/manager/motels/${string}/renters/${string}/magic-link`]: Fixture<MagicLinkResponse> }>;

/** Browser reads/mutations only; RSC reads use backend-server.ts. */
export async function mockApi(page: Page, fixtures: ApiFixtures = {}): Promise<string[]> {
  const requested: string[] = [];
  await page.route("**/api/**", async (route) => {
    const request = route.request();
    const key = `${request.method()} ${new URL(request.url()).pathname}`;
    requested.push(key);
    if (!(key in fixtures)) throw new Error(`mockApi: no fixture for "${key}". Add it, or drop the request.`);
    const fixture = fixtures[key as keyof ApiFixtures];
    const envelope = fixture && typeof fixture === "object" && "body" in fixture && typeof fixture.status === "number" ? fixture : undefined;
    await route.fulfill({ status: envelope?.status ?? 200, contentType: "application/json", body: JSON.stringify(envelope ? envelope.body : fixture) });
  });
  return requested;
}
