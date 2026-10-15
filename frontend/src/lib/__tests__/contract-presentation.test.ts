import { describe, expect, it } from "vitest";
import { contractDraftFromContract, contractPartyNames, createContractDraft, prepareContractInput, prepareContractPatch, type ContractDraft } from "@/lib/contract-presentation";
import { draftTemplateUpdate } from "@/lib/contract-presentation";
import type { ContractResponse, ContractTemplateResponse, RenterResponse, RoomResponse } from "@/lib/api/types";

const contract: ContractResponse = { id: "contract", motelId: "motel", renterId: "renter", roomId: "room", startDate: "2026-10-01", endDate: "2027-09-30", monthlyRent: "3500000", deposit: "1000000", clauses: [], otpSentAt: null, otpSignedAt: null, status: "draft", createdAt: "2026-10-01T00:00:00.000Z" };
const renter: RenterResponse = { id: "renter", motelId: "motel", name: "Nguyễn An", phone: "0900000000", idNumber: null, idCardFrontUrl: null, idCardBackUrl: null, roomId: "room", zaloOaId: null, isOaFollower: false, status: "active", createdAt: "2026-10-01T00:00:00.000Z" };
const room: RoomResponse = { id: "room", motelId: "motel", name: "P.101", basePrice: "3500000", floor: 1, status: "occupied", createdAt: "2026-10-01T00:00:00.000Z" };

describe("contract list presentation", () => {
  it("resolves real renter and room labels from selected-motel data", () => expect(contractPartyNames(contract, [renter], [room])).toEqual({ renter: "Nguyễn An", room: "P.101" }));
  it("does not expose IDs when linked records are absent", () => expect(contractPartyNames(contract, [], [])).toEqual({ renter: "Khách thuê không còn trong danh sách", room: "Phòng không còn trong danh sách" }));
  it("does not resolve records from another motel", () => expect(contractPartyNames(contract, [{ ...renter, motelId: "foreign" }], [{ ...room, motelId: "foreign" }])).toEqual({ renter: "Khách thuê không còn trong danh sách", room: "Phòng không còn trong danh sách" }));
  it("validates dates as actual calendar days", () => {
    const draft: ContractDraft = { renterId: renter.id, roomId: room.id, templateId: "", startDate: "2026-02-31", endDate: "2027-02-28", monthlyRent: "3500000", deposit: "0", clauses: [] };
    expect(prepareContractInput("motel", draft, [renter], [room], [])).toMatchObject({ ok: false, errors: { startDate: expect.any(String) } });
  });
  it("creates draft with room base rent and a motel template snapshot", () => {
    const template: ContractTemplateResponse = { id: "template", motelId: "motel", name: "Default", clauses: [{ title: "Rent", content: "Due monthly" }], isDefault: true, createdAt: contract.createdAt };
    expect(createContractDraft([renter], [room], [template])).toMatchObject({ renterId: renter.id, roomId: room.id, monthlyRent: room.basePrice, templateId: template.id, clauses: template.clauses });
  });
  it("creates exact digit-string amounts and excludes renter/room IDs from a draft PATCH", () => {
    const draft = { ...contractDraftFromContract(contract), monthlyRent: "3.500.000", deposit: "1.000.000" };
    expect(prepareContractPatch("motel", contract, draft, [renter], [room], [])).toEqual({ ok: true, input: { startDate: draft.startDate, endDate: draft.endDate, monthlyRent: "3500000", deposit: "1000000", clauses: [] } });
  });
  it("updates draft terms without revalidating immutable renter and room assignments", () => {
    const draft = { ...contractDraftFromContract(contract), monthlyRent: "4.000.000", clauses: [{ title: "Một", content: "A" }, { title: "Hai", content: "B" }] };
    const result = prepareContractPatch("motel", contract, draft, [renter], [room], []);
    expect(result).toEqual({ ok: true, input: { startDate: draft.startDate, endDate: draft.endDate, monthlyRent: "4000000", deposit: draft.deposit, clauses: draft.clauses } });
  });
  it("refuses edits to active contracts", () => expect(prepareContractPatch("motel", { ...contract, status: "active" }, contractDraftFromContract(contract), [renter], [room], [])).toMatchObject({ ok: false }));
  it("preserves all template clauses and default state when preparing template updates", () => {
    const template: ContractTemplateResponse = { id: "t", motelId: "motel", name: "Old", clauses: [{ title: "One", content: "A" }, { title: "Two", content: "B" }], isDefault: true, createdAt: contract.createdAt };
    expect(draftTemplateUpdate(template, " New ", template.clauses)).toEqual({ name: "New", clauses: template.clauses, isDefault: true });
  });
});
