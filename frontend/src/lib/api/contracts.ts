import { serverGet } from "./server";
import type { ContractResponse, ContractStatus, ContractTemplateResponse } from "./types";

export function listContracts(motelId: string, status?: ContractStatus) { return serverGet<ContractResponse[]>(`/api/manager/motels/${encodeURIComponent(motelId)}/contracts${status ? `?status=${encodeURIComponent(status)}` : ""}`); }
export function listContractTemplates(motelId: string) { return serverGet<ContractTemplateResponse[]>(`/api/manager/motels/${encodeURIComponent(motelId)}/contract-templates`); }
export function getContract(motelId: string, contractId: string) { return serverGet<ContractResponse>(`/api/manager/motels/${encodeURIComponent(motelId)}/contracts/${encodeURIComponent(contractId)}`); }
