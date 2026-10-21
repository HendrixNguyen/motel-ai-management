import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  createContract,
  listContracts,
  listContractTemplates,
  getContract,
  updateContract,
  sendContract,
  terminateContract,
  createContractTemplate,
  updateContractTemplate,
  deleteContractTemplate,
} from "@/lib/api/contracts.client";

const fetchMock = vi.fn();
vi.stubGlobal("fetch", fetchMock);

const response = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });

describe("manager contract API", () => {
  beforeEach(() => fetchMock.mockReset());

  it("lists contracts with optional status filter", async () => {
    fetchMock.mockResolvedValue(response([]));
    await listContracts("motel", "draft");
    expect(fetchMock.mock.calls[0]?.[0]).toBe("/api/manager/motels/motel/contracts?status=draft");
  });

  it("creates contract using exact VND strings and calendar dates", async () => {
    fetchMock.mockResolvedValue(response({ id: "contract" }, 201));
    await createContract("motel", {
      renterId: "renter",
      roomId: "room",
      startDate: "2026-10-01",
      endDate: "2027-09-30",
      monthlyRent: "3500000",
      deposit: "3500000",
      clauses: [],
    });
    expect(JSON.parse(String(fetchMock.mock.calls[0]?.[1]?.body))).toMatchObject({
      monthlyRent: "3500000",
      startDate: "2026-10-01",
    });
  });

  it("encodes contract IDs and sends bodyless lifecycle actions", async () => {
    fetchMock.mockImplementation(() => Promise.resolve(response({ id: "contract" })));
    await getContract("motel / one", "contract/id");
    expect(fetchMock.mock.calls.at(-1)?.[0]).toBe(
      "/api/manager/motels/motel%20%2F%20one/contracts/contract%2Fid",
    );
    await updateContract("motel", "contract", { monthlyRent: "3500000" });
    expect(fetchMock.mock.calls.at(-1)?.[1]?.method).toBe("PATCH");
    await sendContract("motel", "contract");
    expect(fetchMock.mock.calls.at(-1)?.[1]?.body).toBeUndefined();
    await terminateContract("motel", "contract");
    expect(fetchMock.mock.calls.at(-1)?.[0]).toBe(
      "/api/manager/motels/motel/contracts/contract/terminate",
    );
    expect(fetchMock.mock.calls.at(-1)?.[1]?.body).toBeUndefined();
  });

  it("creates, updates, and deletes templates through scoped route", async () => {
    fetchMock.mockImplementation(() => Promise.resolve(response({ id: "template" }, 201)));
    await createContractTemplate("motel", { name: "Basic", clauses: [] });
    expect(fetchMock.mock.calls.at(-1)?.[1]?.method).toBe("POST");
    await updateContractTemplate("motel", "template/id", { name: "Updated" });
    expect(fetchMock.mock.calls.at(-1)?.[0]).toBe(
      "/api/manager/motels/motel/contract-templates/template%2Fid",
    );
    expect(fetchMock.mock.calls.at(-1)?.[1]?.method).toBe("PATCH");
    fetchMock.mockResolvedValue(new Response(null, { status: 204 }));
    await deleteContractTemplate("motel", "template");
    expect(fetchMock.mock.calls.at(-1)?.[1]?.method).toBe("DELETE");
    expect(fetchMock.mock.calls.at(-1)?.[1]?.body).toBeUndefined();
  });

  it("lists templates through motel-scoped route", async () => {
    fetchMock.mockResolvedValue(response([]));
    await listContractTemplates("motel");
    expect(fetchMock.mock.calls[0]?.[0]).toBe("/api/manager/motels/motel/contract-templates");
  });
});
