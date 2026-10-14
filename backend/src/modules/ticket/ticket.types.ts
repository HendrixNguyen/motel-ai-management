import type { TicketCategory } from "./ticket.schema";

export type { TicketCategory };
export type CreateTicketInput = { renterId: string; motelId: string; roomId: string; category: TicketCategory; description: string; files: File[] };
export type TicketResponse = { id: string; renterId: string; motelId: string; roomId: string; category: TicketCategory; description: string; photoUrls: string[]; status: "open" | "in_progress" | "resolved"; createdAt: string; resolvedAt: string | null };
