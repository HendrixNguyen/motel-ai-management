import type { ContractTemplateClause } from "./contract.schema";

export type TemplateSelection =
  | { kind: "catalog"; key: string; version: number }
  | { kind: "motel"; motelId: string; templateId: string; fingerprint: string };

export type CatalogSummary = {
  key: string;
  version: number;
  name: string;
  description: string;
};

export type TemplatePreview = {
  name: string;
  clauses: ContractTemplateClause[];
  selection: TemplateSelection;
};
