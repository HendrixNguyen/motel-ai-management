import type { CreateMotelInput } from "./motel.types";
import type { TemplateSelection } from "@/modules/contract/contract-catalog.types";
import type { VndString } from "@/shared/money";

export interface SetupRoomInput {
  name: string;
  basePrice: VndString;
  floor?: number | null;
}

export type SetupMotelInput =
  | {
      requestId: string;
      mode: "full";
      motel: CreateMotelInput;
      template: TemplateSelection;
      rooms: SetupRoomInput[];
    }
  | {
      requestId: string;
      mode: "quick";
      motel: CreateMotelInput;
      template?: TemplateSelection;
    };

export interface SetupMotelResult {
  motelId: string;
  mode: "full" | "quick";
  roomCount: number;
  templateId: string | null;
}
