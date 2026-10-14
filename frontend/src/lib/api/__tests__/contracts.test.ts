import { beforeEach, describe, expect, it, vi } from "vitest";
import { createContract, listContracts, listContractTemplates } from "../contracts.client";

const fetchMock = vi.fn();
vi.stubGlobal("fetch", fetchMock);

const response = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });

describe("manager contract API", () => {
  beforeEach(() => fetchMock.mockReset());

  it("lists contracts with optional status filter", async () => {
    fetchMock.mockResolvedValue(response([]));
    await listContracts("motel", "draft");
    expect(fetchMock.mock.calls[0]?.[0]).toBe("/api/manager/motels/motel/contracts?status=draft");
  });

  it("creates contract using exact VND strings and calendar dates", async () => {
    fetchMock.mockResolvedValue(response({ id: "contract" }, 201));
    await createContract("motel", { renterId: "renter", roomId: "room", startDate: "2026-10-01", endDate: "2027-09-30", monthlyRent: "3500000", deposit: "3500000", clauses: [] });
    expect(JSON.parse(String(fetchMock.mock.calls[0]?.[1]?.body))).toMatchObject({ monthlyRent: "3500000", startDate: "2026-10-01" });
  });

  it("lists templates through motel-scoped route", async () => {
    fetchMock.mockResolvedValue(response([]));
    await listContractTemplates("motel");
    expect(fetchMock.mock.calls[0]?.[0]).toBe("/api/manager/motels/motel/contract-templates");
  });
});
