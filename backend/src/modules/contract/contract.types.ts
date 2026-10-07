import type { ContractTemplateClause } from "./contract.schema";

export interface ContractTemplateInput {
  name: string;
  clauses: ContractTemplateClause[];
  isDefault?: boolean;
}
export type UpdateContractTemplateInput = Partial<ContractTemplateInput>;
export interface ContractTemplateResponse {
  id: string;
  motelId: string;
  name: string;
  clauses: ContractTemplateClause[];
  isDefault: boolean;
  createdAt: string;
}
