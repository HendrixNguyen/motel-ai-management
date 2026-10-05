import type { Page } from "@playwright/test";

// Fixture payloads keyed by `"<METHOD> <pathname>"`, e.g. `"GET /api/manager/motels"`.
//
// `unknown` on purpose: `lib/api/types.ts` does not exist yet, so there is nothing honest to
// type a fixture against yet. Tighten this to those types once they land.
export type ApiFixtures = Record<string, unknown>;

// Answers every `/api/` request the page makes from `fixtures`, without touching the network.
//
// Fixtures are keyed by pathname, so a query string such as `?motel=<uuid>` does not change the
// lookup — M3 and M4 filter on the query, not the path.
//
// Nothing here reaches PostgreSQL or the Elysia backend, which is the reason the fixture-backed
// Playwright project can pass on a machine that has neither.
//
// A request with **no fixture throws**, inside the route handler, so the test fails naming the key
// it wanted. An earlier version answered 404 `NOT_FOUND` instead, which is indistinguishable from a
// legitimately empty resource: a spec with a forgotten fixture passed while asserting against a
// lie. A fixture that must return a non-2xx status is not expressible yet; a spec that needs one
// should extend this map to accept `{ status, body }` rather than turning the throw off.
//
// Returns the `"<METHOD> <pathname>"` keys requested so far — appended to as the page navigates —
// so a spec can assert that a call was made.
export async function mockApi(page: Page, fixtures: ApiFixtures = {}): Promise<string[]> {
  const requested: string[] = [];

  await page.route("**/api/**", async (route) => {
    const request = route.request();
    const key = `${request.method()} ${new URL(request.url()).pathname}`;
    requested.push(key);

    if (!(key in fixtures)) {
      throw new Error(
        `mockApi: no fixture for "${key}". ` +
          `Fixtures provided: ${Object.keys(fixtures).join(", ") || "(none)"}. ` +
          `Add it, or drop the request.`,
      );
    }

    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(fixtures[key]),
    });
  });

  return requested;
}
