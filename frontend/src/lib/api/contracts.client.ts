import { apiGet, apiSend } from "./client";
import type { ContractResponse, ContractStatus, ContractTemplateResponse, CreateContractInput, CreateContractTemplateInput, UpdateContractInput, UpdateContractTemplateInput } from "./types";

const base = (motelId: string) => `/api/manager/motels/${encodeURIComponent(motelId)}`;
const contractBase = (motelId: string) => `${base(motelId)}/contracts`;
const templateBase = (motelId: string) => `${base(motelId)}/contract-templates`;

export function listContracts(motelId: string, status?: ContractStatus) {
  return apiGet<ContractResponse[]>(`${contractBase(motelId)}${status ? `?status=${encodeURIComponent(status)}` : ""}`);
}
export function getContract(motelId: string, contractId: string) { return apiGet<ContractResponse>(`${contractBase(motelId)}/${encodeURIComponent(contractId)}`); }
export function createContract(motelId: string, input: CreateContractInput) { return apiSend<ContractResponse>(contractBase(motelId), "POST", input); }
export function updateContract(motelId: string, contractId: string, input: UpdateContractInput) { return apiSend<ContractResponse>(`${contractBase(motelId)}/${encodeURIComponent(contractId)}`, "PATCH", input); }
export function sendContract(motelId: string, contractId: string) { return apiSend<ContractResponse>(`${contractBase(motelId)}/${encodeURIComponent(contractId)}/send`, "POST"); }
export function terminateContract(motelId: string, contractId: string) { return apiSend<ContractResponse>(`${contractBase(motelId)}/${encodeURIComponent(contractId)}/terminate`, "POST"); }
export function listContractTemplates(motelId: string) { return apiGet<ContractTemplateResponse[]>(templateBase(motelId)); }
export function createContractTemplate(motelId: string, input: CreateContractTemplateInput) { return apiSend<ContractTemplateResponse>(templateBase(motelId), "POST", input); }
export function updateContractTemplate(motelId: string, templateId: string, input: UpdateContractTemplateInput) { return apiSend<ContractTemplateResponse>(`${templateBase(motelId)}/${encodeURIComponent(templateId)}`, "PATCH", input); }
export function deleteContractTemplate(motelId: string, templateId: string) { return apiSend<void>(`${templateBase(motelId)}/${encodeURIComponent(templateId)}`, "DELETE"); }
