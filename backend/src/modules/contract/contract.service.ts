import { eq } from "drizzle-orm";
import { db } from "@/db";
import { contractTemplates } from "./contract.schema";

export async function countContractTemplatesForMotel(motelId: string): Promise<number> {
  return db.$count(contractTemplates, eq(contractTemplates.motelId, motelId));
}