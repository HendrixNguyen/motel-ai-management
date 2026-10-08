import type { ContractTemplateClause } from "./contract.schema";
import type { VndString } from "@/shared/money";

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
export interface ContractResponse {
  id: string;
  motelId: string;
  renterId: string;
  roomId: string;
  templateId: string | null;
  startDate: string;
  endDate: string;
  monthlyRent: VndString;
  deposit: VndString;
  clauses: ContractTemplateClause[];
  otpSentAt: string | null;
  otpSignedAt: string | null;
  status: "draft" | "active" | "expired" | "terminated";
  createdAt: string;
}
export interface CreateContractInput {
  renterId: string;
  roomId: string;
  templateId?: string;
  startDate: string;
  endDate: string;
  monthlyRent?: string;
  deposit?: string;
  clauses?: ContractTemplateClause[];
}
export type UpdateContractInput = Partial<
  Pick<
    CreateContractInput,
    | "startDate"
    | "endDate"
    | "monthlyRent"
    | "deposit"
    | "clauses"
    | "templateId"
  >
>;
