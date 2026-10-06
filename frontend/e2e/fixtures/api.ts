import type { Page } from "@playwright/test";
import type { ApiErrorBody, MagicLinkResponse, ManagerAuthResponse, ManagerMeResponse, MotelResponse, RenterDetailResponse, RenterResponse, RoomResponse } from "../../src/lib/api/types";

type Fixture<T> = T | { status: number; body: T | ApiErrorBody };
type ApiFixturePath =
  | "GET /api/auth/me"
  | "POST /api/auth/login"
  | "POST /api/auth/logout"
  | "GET /api/manager/motels"
  | "POST /api/manager/motels"
  | `PATCH /api/manager/motels/${string}`
  | `GET /api/manager/motels/${string}/rooms`
  | `POST /api/manager/motels/${string}/rooms`
  | `PATCH /api/manager/motels/${string}/rooms/${string}`
  | `GET /api/manager/motels/${string}/renters`
  | `POST /api/manager/motels/${string}/renters`
  | `PATCH /api/manager/motels/${string}/renters/${string}`
  | `GET /api/manager/motels/${string}/renters/${string}`
  | `POST /api/manager/motels/${string}/renters/${string}/magic-link`;
type FixtureForPath<Path extends ApiFixturePath> =
  Path extends "GET /api/auth/me" ? Fixture<ManagerMeResponse> :
  Path extends "POST /api/auth/login" ? Fixture<ManagerAuthResponse> :
  Path extends "POST /api/auth/logout" ? Fixture<void> :
  Path extends "GET /api/manager/motels" ? Fixture<MotelResponse[]> :
  Path extends "POST /api/manager/motels" ? Fixture<MotelResponse> :
  Path extends `PATCH /api/manager/motels/${string}/rooms/${string}` ? Fixture<RoomResponse> :
  Path extends `PATCH /api/manager/motels/${string}/renters/${string}` ? Fixture<RenterResponse> :
  Path extends `GET /api/manager/motels/${string}/rooms` ? Fixture<RoomResponse[]> :
  Path extends `POST /api/manager/motels/${string}/rooms` ? Fixture<RoomResponse> :
  Path extends `GET /api/manager/motels/${string}/renters/${string}` ? Fixture<RenterDetailResponse> :
  Path extends `GET /api/manager/motels/${string}/renters` ? Fixture<RenterResponse[]> :
  Path extends `POST /api/manager/motels/${string}/renters/${string}/magic-link` ? Fixture<MagicLinkResponse> :
  Path extends `POST /api/manager/motels/${string}/renters` ? Fixture<RenterResponse> :
  Path extends `PATCH /api/manager/motels/${string}` ? Fixture<MotelResponse> : never;
/** Route-keyed DTOs: assigning a motel to a rooms fixture is a compile error. */
export type ApiFixtures = Partial<{ [Path in ApiFixturePath]: FixtureForPath<Path> }>;

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
