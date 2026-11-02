import { afterEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ role: "superadmin", hasCookie: true, redirect: vi.fn() }));
vi.mock("next/headers", () => ({
  cookies: async () => ({ get: () => (mocks.hasCookie ? { value: "session" } : undefined) }),
}));
vi.mock("next/navigation", () => ({
  redirect: (path: string) => {
    mocks.redirect(path);
    throw new Error(`redirect:${path}`);
  },
}));
vi.mock("@/lib/api/auth", () => ({ getMe: async () => ({ role: mocks.role }) }));

import Page from "../../src/app/(manager)/admin/managers/page";

afterEach(() => {
  mocks.role = "superadmin";
  mocks.hasCookie = true;
  mocks.redirect.mockReset();
});

describe("account manager route guard", () => {
  it("renders account tools only for authenticated superadmins", async () => {
    expect(await Page()).toBeTruthy();
    mocks.role = "manager";
    await expect(Page()).rejects.toThrow("redirect:/");
  });

  it("redirects missing sessions to login before fetching identity", async () => {
    mocks.hasCookie = false;
    await expect(Page()).rejects.toThrow("redirect:/login");
    expect(mocks.redirect).toHaveBeenCalledWith("/login");
  });
});
