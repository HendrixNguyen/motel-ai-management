import { apiGet, apiSend } from "./client";
import type {
  CatalogSummary,
  ContractTemplateResponse,
  SetupMotelInput,
  SetupMotelResult,
  TemplatePreview,
} from "./types";

export function submitMotelSetup(input: SetupMotelInput): Promise<SetupMotelResult> {
  return apiSend<SetupMotelResult>("/api/manager/motels/setup", "POST", input);
}

export function getMotelSetupResult(requestId: string): Promise<SetupMotelResult> {
  return apiGet<SetupMotelResult>(
    `/api/manager/motels/setup-requests/${encodeURIComponent(requestId)}`,
  );
}

export function listContractCatalog(): Promise<CatalogSummary[]> {
  return apiGet<CatalogSummary[]>("/api/manager/contract-template-catalog");
}

export function previewCatalogTemplate(key: string, version: number): Promise<TemplatePreview> {
  return apiGet<TemplatePreview>(
    `/api/manager/contract-template-catalog/${encodeURIComponent(key)}/${encodeURIComponent(version)}`,
  );
}

export function previewOwnedTemplate(
  motelId: string,
  templateId: string,
): Promise<TemplatePreview> {
  return apiGet<TemplatePreview>(
    `/api/manager/motels/${encodeURIComponent(motelId)}/contract-templates/${encodeURIComponent(templateId)}/setup-preview`,
  );
}

export function copyCatalogTemplate(
  motelId: string,
  input: { catalogKey: string; catalogVersion: number; isDefault: boolean },
): Promise<ContractTemplateResponse> {
  return apiSend<ContractTemplateResponse>(
    `/api/manager/motels/${encodeURIComponent(motelId)}/contract-templates/from-catalog`,
    "POST",
    input,
  );
}
