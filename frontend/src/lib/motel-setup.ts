import type {
  CreateMotelInput,
  MotelResponse,
  SetupMotelInput,
  SetupRoomInput,
  TemplateSelection,
} from "@/lib/api/types";
import type { MotelDraft } from "./motel-form";
import { formatVndPlain } from "./format/vnd";

export type CopyGroups = {
  bank: boolean;
  services: boolean;
};

export function applyMotelCopy(
  draft: MotelDraft,
  source: MotelResponse,
  groups: CopyGroups,
): MotelDraft {
  const next = structuredClone(draft);
  if (groups.bank && source.bankAccount) {
    next.bankEnabled = true;
    next.bankAccount = structuredClone(source.bankAccount);
  }
  if (groups.services && source.otherFees) {
    next.otherFees = source.otherFees.map((fee) => ({
      name: fee.name,
      amount: formatVndPlain(fee.amount),
    }));
  }
  return next;
}

export function buildSetupInput(
  requestId: string,
  mode: "full" | "quick",
  motel: CreateMotelInput,
  template: TemplateSelection | null,
  rooms: SetupRoomInput[],
): SetupMotelInput {
  if (mode === "full") {
    if (!template) {
      throw new Error("Full setup requires a template");
    }
    if (rooms.length < 1 || rooms.length > 100) {
      throw new Error("Full setup requires between 1 and 100 rooms");
    }
    return {
      requestId,
      mode: "full",
      motel,
      template,
      rooms,
    };
  }

  const quickInput: SetupMotelInput = {
    requestId,
    mode: "quick",
    motel,
  };
  if (template) {
    quickInput.template = template;
  }
  return quickInput;
}

export type StoredSetupDraft = {
  version: 1;
  mode: "full" | "quick";
  motel: Omit<MotelDraft, "bankAccount" | "bankEnabled">;
  template: TemplateSelection | null;
  rooms: SetupRoomInput[];
  pendingRequestId: string | null;
};

export function serializeSetupDraft(draft: StoredSetupDraft): string {
  const safeDraft: StoredSetupDraft = {
    version: 1,
    mode: draft.mode,
    motel: {
      name: draft.motel.name,
      address: draft.motel.address,
      electricityPrice: draft.motel.electricityPrice,
      waterPrice: draft.motel.waterPrice,
      otherFees: draft.motel.otherFees.map((f) => ({ name: f.name, amount: f.amount })),
    },
    template: draft.template,
    rooms: draft.rooms.map((r) => ({
      name: r.name,
      basePrice: r.basePrice,
      ...(r.floor !== undefined ? { floor: r.floor } : {}),
    })),
    pendingRequestId: draft.pendingRequestId,
  };
  return JSON.stringify(safeDraft);
}

export function parseSetupDraft(raw: string): StoredSetupDraft | null {
  try {
    const data = JSON.parse(raw);
    if (!data || typeof data !== "object") return null;
    if (data.version !== 1) return null;
    if (data.mode !== "full" && data.mode !== "quick") return null;
    if (!data.motel || typeof data.motel !== "object") return null;
    if (typeof data.motel.name !== "string") return null;
    if (typeof data.motel.address !== "string") return null;
    if (typeof data.motel.electricityPrice !== "string") return null;
    if (typeof data.motel.waterPrice !== "string") return null;
    if (!Array.isArray(data.motel.otherFees)) return null;
    if (!Array.isArray(data.rooms)) return null;

    return {
      version: 1,
      mode: data.mode,
      motel: {
        name: data.motel.name,
        address: data.motel.address,
        electricityPrice: data.motel.electricityPrice,
        waterPrice: data.motel.waterPrice,
        otherFees: data.motel.otherFees,
      },
      template: data.template ?? null,
      rooms: data.rooms,
      pendingRequestId: typeof data.pendingRequestId === "string" ? data.pendingRequestId : null,
    };
  } catch {
    return null;
  }
}
