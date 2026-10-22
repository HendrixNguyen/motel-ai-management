import type { ContractResponse, ContractStatus, ContractTemplateResponse, CreateContractInput, RenterResponse, RoomResponse, UpdateContractInput } from "@/lib/api/types";
import { parseVndDigits } from "@/lib/format/vnd";

export function contractPartyNames(contract: ContractResponse, renters: readonly RenterResponse[], rooms: readonly RoomResponse[]): { renter: string; room: string } {
  const renter = renters.find((item) => item.id === contract.renterId && item.motelId === contract.motelId);
  const room = rooms.find((item) => item.id === contract.roomId && item.motelId === contract.motelId);
  return { renter: renter?.name ?? "Khách thuê không còn trong danh sách", room: room?.name ?? "Phòng không còn trong danh sách" };
}

export type ContractDraft = { renterId: string; roomId: string; templateId: string; startDate: string; endDate: string; monthlyRent: string; deposit: string; clauses: { title: string; content: string }[] };
export type ContractFieldErrors = Partial<Record<keyof ContractDraft, string>>;
export function contractDraftFromContract(contract: ContractResponse): ContractDraft { return { renterId: contract.renterId, roomId: contract.roomId, templateId: "", startDate: contract.startDate, endDate: contract.endDate, monthlyRent: contract.monthlyRent, deposit: contract.deposit, clauses: contract.clauses.map((clause) => ({ ...clause })) }; }
export function createContractDraft(renters: readonly RenterResponse[], rooms: readonly RoomResponse[], templates: readonly ContractTemplateResponse[]): ContractDraft {
  const renter = renters.find((item) => item.status === "active"); const room = rooms.find((item) => item.status !== "maintenance"); const template = templates.find((item) => item.isDefault) ?? templates[0];
  return { renterId: renter?.id ?? "", roomId: room?.id ?? "", templateId: template?.id ?? "", startDate: "", endDate: "", monthlyRent: room?.basePrice ?? "", deposit: "0", clauses: template?.clauses.map((clause) => ({ ...clause })) ?? [] };
}
function validCalendarDay(day: string) { if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) return false; const date = new Date(`${day}T00:00:00.000Z`); return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === day; }
export function prepareContractInput(motelId: string, draft: ContractDraft, renters: readonly RenterResponse[], rooms: readonly RoomResponse[], templates: readonly ContractTemplateResponse[]): { ok: true; input: CreateContractInput } | { ok: false; errors: ContractFieldErrors } {
  const errors: ContractFieldErrors = {}; const renter = renters.find((item) => item.id === draft.renterId && item.motelId === motelId && item.status === "active"); const room = rooms.find((item) => item.id === draft.roomId && item.motelId === motelId && item.status !== "maintenance");
  if (!renter) errors.renterId = "Chọn khách thuê đang hoạt động trong nhà trọ này"; if (!room) errors.roomId = "Chọn phòng hợp lệ trong nhà trọ này";
  if (!validCalendarDay(draft.startDate)) errors.startDate = "Nhập ngày bắt đầu hợp lệ"; if (!validCalendarDay(draft.endDate) || (validCalendarDay(draft.startDate) && draft.endDate <= draft.startDate)) errors.endDate = "Ngày kết thúc phải sau ngày bắt đầu";
  const monthlyRent = parseVndDigits(draft.monthlyRent), deposit = parseVndDigits(draft.deposit); if (monthlyRent === null) errors.monthlyRent = "Nhập tiền thuê bằng VND hợp lệ"; if (deposit === null) errors.deposit = "Nhập tiền cọc bằng VND hợp lệ";
  let templateId: string | undefined; if (draft.templateId) { const template = templates.find((item) => item.id === draft.templateId && item.motelId === motelId); if (!template) errors.templateId = "Mẫu hợp đồng không thuộc nhà trọ này"; else templateId = template.id; }
  const clauses = draft.clauses.map((clause, index) => { const title = clause.title.trim(), content = clause.content.trim(); if (!title) errors.clauses = `Nhập tiêu đề điều khoản ${index + 1}`; if (!content) errors.clauses ??= `Nhập nội dung điều khoản ${index + 1}`; return { title, content }; });
  if (Object.keys(errors).length || monthlyRent === null || deposit === null) return { ok: false, errors };
  return { ok: true, input: { renterId: renter!.id, roomId: room!.id, startDate: draft.startDate, endDate: draft.endDate, monthlyRent, deposit, ...(templateId ? { templateId } : {}), clauses } };
}
export function prepareContractPatch(motelId: string, contract: ContractResponse, draft: ContractDraft, renters: readonly RenterResponse[], rooms: readonly RoomResponse[], templates: readonly ContractTemplateResponse[]): { ok: true; input: UpdateContractInput } | { ok: false; errors: ContractFieldErrors } {
  if (contract.status !== "draft") return { ok: false, errors: {} };
  if (contract.motelId !== motelId) return { ok: false, errors: {} };
  const errors: ContractFieldErrors = {};
  if (!validCalendarDay(draft.startDate)) errors.startDate = "Nhập ngày bắt đầu hợp lệ";
  if (!validCalendarDay(draft.endDate) || (validCalendarDay(draft.startDate) && draft.endDate <= draft.startDate)) errors.endDate = "Ngày kết thúc phải sau ngày bắt đầu";
  const monthlyRent = parseVndDigits(draft.monthlyRent), deposit = parseVndDigits(draft.deposit);
  if (monthlyRent === null) errors.monthlyRent = "Nhập tiền thuê bằng VND hợp lệ";
  if (deposit === null) errors.deposit = "Nhập tiền cọc bằng VND hợp lệ";
  const clauses = draft.clauses.map((clause, index) => { const title = clause.title.trim(), content = clause.content.trim(); if (!title) errors.clauses = `Nhập tiêu đề điều khoản ${index + 1}`; if (!content) errors.clauses ??= `Nhập nội dung điều khoản ${index + 1}`; return { title, content }; });
  let templateId: string | undefined;
  if (draft.templateId) { const template = templates.find((item) => item.id === draft.templateId && item.motelId === motelId); if (!template) errors.templateId = "Mẫu hợp đồng không thuộc nhà trọ này"; else templateId = template.id; }
  if (!renters.some((item) => item.id === contract.renterId && item.motelId === motelId)) errors.renterId = "Khách thuê của hợp đồng không thuộc nhà trọ này";
  if (!rooms.some((item) => item.id === contract.roomId && item.motelId === motelId)) errors.roomId = "Phòng của hợp đồng không thuộc nhà trọ này";
  if (Object.keys(errors).length || monthlyRent === null || deposit === null) return { ok: false, errors };
  return { ok: true, input: { startDate: draft.startDate, endDate: draft.endDate, monthlyRent, deposit, clauses, ...(templateId ? { templateId } : {}) } };
}
export function draftTemplateUpdate(template: ContractTemplateResponse, name: string, clauses: ContractTemplateResponse["clauses"]) { return { name: name.trim(), clauses: clauses.map((clause) => ({ title: clause.title.trim(), content: clause.content.trim() })), isDefault: template.isDefault }; }
export function contractStatusLabel(status: ContractStatus) { return ({ draft: "Bản nháp", active: "Đang hiệu lực", expired: "Đã hết hạn", terminated: "Đã chấm dứt" })[status]; }
