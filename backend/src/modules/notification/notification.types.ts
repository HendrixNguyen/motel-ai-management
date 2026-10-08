import type { notificationEvents } from "./notification.schema";

export type NotificationEvent = typeof notificationEvents.$inferSelect;
export type NotificationInput = {
  eventKey: string;
  renterId: string;
  motelId: string;
  templateId?: string;
  payload: Record<string, unknown>;
};

export type ProviderResult = { providerId: string };
export type ZaloProvider = {
  sendOaMessage(input: { recipientId: string; payload: Record<string, unknown> }): Promise<ProviderResult>;
  sendZns(input: { phone: string; templateId: string; payload: Record<string, unknown> }): Promise<ProviderResult>;
};
