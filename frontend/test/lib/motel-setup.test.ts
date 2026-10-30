import { afterEach, describe, expect, it, vi } from "vitest";
import {
  applyMotelCopy,
  buildSetupInput,
  parseSetupDraft,
  serializeSetupDraft,
  type CopyGroups,
  type StoredSetupDraft,
} from "@/lib/motel-setup";
import { createMotelDraft, prepareMotelInput } from "@/lib/motel-form";
import { submitMotelSetup } from "@/lib/api/motel-setup.client";
import * as motelsClient from "@/lib/api/motels.client";
import type {
  CreateMotelInput,
  MotelResponse,
  SetupRoomInput,
  TemplateSelection,
} from "@/lib/api/types";
import { MOTEL } from "@test/lib/api/fixtures";

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

const mockTemplate: TemplateSelection = {
  kind: "catalog",
  key: "standard-v1",
  version: 1,
};

const mockRooms: SetupRoomInput[] = [
  { name: "P.101", basePrice: "2500000", floor: 1 },
  { name: "P.102", basePrice: "2600000", floor: 1 },
];

describe("motel-setup draft and copy state", () => {
  it("copy_is_not_edit: copied bank/fees deep-equal source, name/address remain new, source unchanged after draft mutation; mock updateMotel and assert not called on setup submit", async () => {
    const source: MotelResponse = structuredClone(MOTEL);
    const draft = createMotelDraft();
    draft.name = "Nhà trọ Mới";
    draft.address = "123 Đường Mới";
    draft.electricityPrice = "4000";
    draft.waterPrice = "30000";

    const groups: CopyGroups = { bank: true, services: true };
    const copied = applyMotelCopy(draft, source, groups);

    expect(copied.name).toBe("Nhà trọ Mới");
    expect(copied.address).toBe("123 Đường Mới");
    expect(copied.bankEnabled).toBe(true);
    expect(copied.bankAccount).toEqual(source.bankAccount);
    expect(copied.bankAccount).not.toBe(source.bankAccount);
    expect(copied.otherFees).toEqual(
      source.otherFees.map((f) => ({
        name: f.name,
        amount: "50000" === f.amount || f.name === "Vệ sinh chung" ? "50.000" : "100.000",
      })),
    );

    const prepared = prepareMotelInput(copied);
    expect(prepared.ok).toBe(true);
    if (prepared.ok) {
      expect(prepared.input.otherFees).toEqual(source.otherFees);
      expect(prepared.input.bankAccount).toEqual(source.bankAccount);
    }

    copied.bankAccount.accountName = "MUTATED NAME";
    copied.otherFees.push({ name: "Rác", amount: "20000" });
    expect(source.bankAccount?.accountName).toBe(MOTEL.bankAccount?.accountName);
    expect(source.otherFees.length).toBe(MOTEL.otherFees.length);

    const updateMotelSpy = vi.spyOn(motelsClient, "updateMotel");
    const fetchMock = vi.fn().mockResolvedValue(
      Response.json({
        motelId: "motel-1",
        mode: "full",
        roomCount: 2,
        templateId: "tpl-1",
      }),
    );
    vi.stubGlobal("fetch", fetchMock);

    const fallbackInput: CreateMotelInput = {
      name: "Fallback",
      electricityPrice: "4000",
      waterPrice: "30000",
    };
    const setupInput = buildSetupInput(
      "req-1",
      "full",
      prepared.ok ? prepared.input : fallbackInput,
      mockTemplate,
      mockRooms,
    );
    await submitMotelSetup(setupInput);

    expect(updateMotelSpy).not.toHaveBeenCalled();
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/manager/motels/setup",
      expect.objectContaining({ method: "POST" }),
    );
  });

  it("quick_preserves_template_not_rooms: build quick from draft with rooms -> rooms omitted, template preserved", () => {
    const prep = prepareMotelInput({
      ...createMotelDraft(MOTEL),
      name: "Nhà trọ Quick",
    });
    if (!prep.ok) throw new Error("preparation failed");

    const input = buildSetupInput("req-1", "quick", prep.input, mockTemplate, mockRooms);
    expect(input.mode).toBe("quick");
    expect(input.template).toEqual(mockTemplate);
    expect("rooms" in input).toBe(false);
  });

  it("full missing template or room count 0/101 throws error; 1..100 pass", () => {
    const prep = prepareMotelInput({
      ...createMotelDraft(MOTEL),
      name: "Nhà trọ Full",
    });
    if (!prep.ok) throw new Error("preparation failed");

    expect(() => buildSetupInput("req-1", "full", prep.input, null, mockRooms)).toThrow();
    expect(() => buildSetupInput("req-1", "full", prep.input, mockTemplate, [])).toThrow();

    const rooms101: SetupRoomInput[] = Array.from({ length: 101 }, (_, i) => ({
      name: `P.${i + 1}`,
      basePrice: "2000000",
    }));
    expect(() => buildSetupInput("req-1", "full", prep.input, mockTemplate, rooms101)).toThrow();

    const rooms100: SetupRoomInput[] = Array.from({ length: 100 }, (_, i) => ({
      name: `P.${i + 1}`,
      basePrice: "2000000",
    }));
    const ok100 = buildSetupInput("req-1", "full", prep.input, mockTemplate, rooms100);
    expect(ok100.mode).toBe("full");
    if (ok100.mode === "full") {
      expect(ok100.rooms.length).toBe(100);
    }

    const rooms1: SetupRoomInput[] = [{ name: "P.1", basePrice: "2000000" }];
    const ok1 = buildSetupInput("req-1", "full", prep.input, mockTemplate, rooms1);
    expect(ok1.mode).toBe("full");
  });

  it("storage serializer excludes bank/clauses, runtime validator parseSetupDraft rejects corrupt or unknown version JSON. pendingRequestId survives", () => {
    const draft: StoredSetupDraft = {
      version: 1,
      mode: "full",
      motel: {
        name: "Nhà trọ Test",
        address: "456 Test",
        electricityPrice: "3500",
        waterPrice: "25000",
        otherFees: [{ name: "Wifi", amount: "50000" }],
      },
      template: mockTemplate,
      rooms: mockRooms,
      pendingRequestId: "req-abc-123",
    };

    const serialized = serializeSetupDraft(draft);
    expect(serialized).not.toContain("bankAccount");
    expect(serialized).not.toContain("bankCode");
    expect(serialized).not.toContain("clauses");

    const parsed = parseSetupDraft(serialized);
    expect(parsed).toEqual(draft);
    expect(parsed?.pendingRequestId).toBe("req-abc-123");

    expect(parseSetupDraft("not json")).toBeNull();
    expect(parseSetupDraft(JSON.stringify({ version: 2 }))).toBeNull();
    expect(parseSetupDraft(JSON.stringify({ version: 1, mode: "unknown" }))).toBeNull();
    expect(parseSetupDraft(JSON.stringify({}))).toBeNull();
  });
});
