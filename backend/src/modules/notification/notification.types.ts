import type { notificationEvents } from "./notification.schema";
export type NotificationEvent = typeof notificationEvents.$inferSelect;
export type NotificationInput = {
  eventKey: string;
  renterId: string;
  motelId: string;
  templateId?: string;
  channel?: "zns" | "web_push" | "manual";
  payload: Record<string, unknown>;
  transientSecret?: Record<string, unknown>;
};
export type RetryFailureKind =
  | "rate_limited"
  | "provider_unavailable"
  | "timeout"
  | "invalid_recipient"
  | "invalid_template"
  | "unauthorized"
  | "provider_error"
  | "secret_unavailable";
export type ProviderResult = { providerId: string };
export type ZaloProvider = {
  sendZns(input: {
    phone: string;
    templateId: string;
    payload: Record<string, unknown>;
  }): Promise<ProviderResult>;
};
