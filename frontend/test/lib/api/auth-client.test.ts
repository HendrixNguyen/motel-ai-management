import { afterEach, describe, expect, test, vi } from "vitest";

const mocks = vi.hoisted(() => ({ apiGet: vi.fn() }));

vi.mock("@/lib/api/client", () => ({
  apiGet: mocks.apiGet,
  apiSend: vi.fn(),
  setRememberedManagerSession: vi.fn(),
}));

import { listManagerAccounts } from "@/lib/api/auth.client";

afterEach(() => vi.clearAllMocks());

describe("listManagerAccounts", () => {
  test("fetches every page instead of silently truncating owners", async () => {
    const firstPage = Array.from({ length: 100 }, (_, index) => ({ id: `manager-${index}` }));
    const lastPage = [{ id: "manager-100" }];
    mocks.apiGet.mockResolvedValueOnce(firstPage).mockResolvedValueOnce(lastPage);

    await expect(listManagerAccounts()).resolves.toHaveLength(101);
    expect(mocks.apiGet).toHaveBeenNthCalledWith(1, "/api/admin/managers?limit=100&offset=0");
    expect(mocks.apiGet).toHaveBeenNthCalledWith(2, "/api/admin/managers?limit=100&offset=100");
  });
});
