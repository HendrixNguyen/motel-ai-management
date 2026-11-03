import { apiGet, apiSend } from "./client";
import type { ContractTemplateCatalogResponse, ContractTemplateResponse } from "./types";

export function listContractTemplateCatalog() {
  return apiGet<ContractTemplateCatalogResponse[]>("/api/manager/contract-template-catalog");
}

export function copyContractTemplateFromCatalog(
  motelId: string,
  input: { catalogKey: string; catalogVersion: number; isDefault?: boolean },
) {
  return apiSend<ContractTemplateResponse>(
    `/api/manager/motels/${encodeURIComponent(motelId)}/contract-templates/from-catalog`,
    "POST",
    input,
  );
}
