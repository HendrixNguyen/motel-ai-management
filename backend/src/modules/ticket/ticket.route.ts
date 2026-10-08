import { Elysia, t } from "elysia";
import { cookie } from "@elysiajs/cookie";
import { renterAuth, requireRenterAuth } from "@/middleware/renter-auth";
import { createTicket, getTicket, listTickets } from "./ticket.service";
import { getRenter } from "@/modules/renter/renter.service";

const params = t.Object({ ticketId: t.String({ format: "uuid" }) });
const category = t.Union([t.Literal("electricity"), t.Literal("water"), t.Literal("facilities"), t.Literal("other")]);

export const ticketRoutes = new Elysia({ name: "ticket-routes" })
  .use(cookie())
  .use(renterAuth)
  .get("/renter/tickets", ({ auth }) => { const session = requireRenterAuth(auth); return listTickets(session.renterId, session.motelId); }, { detail: { security: [{ renterAuth: [] }] } })
  .get("/renter/tickets/:ticketId", ({ auth, params }) => { const session = requireRenterAuth(auth); return getTicket(params.ticketId, session.renterId, session.motelId); }, { params, detail: { security: [{ renterAuth: [] }] } })
  .post("/renter/tickets", async ({ auth, request, set }) => {
    const session = requireRenterAuth(auth);
    const renter = await getRenter(session.renterId);
    if (!renter?.roomId) throw new Error("renter room missing");
    const contentType = request.headers.get("content-type") ?? "";
    let categoryValue: string | null;
    let description: string | null;
    let files: File[];
    try {
      if (contentType.includes("multipart/form-data")) {
        const form = await request.formData();
        categoryValue = typeof form.get("category") === "string" ? form.get("category") as string : null;
        description = typeof form.get("description") === "string" ? form.get("description") as string : null;
        files = form.getAll("photos").filter((value) => value instanceof File) as unknown as File[];
      } else if (contentType.includes("application/json")) {
        const body = await request.json() as unknown;
          if (typeof body !== "object" || body === null || Array.isArray(body)) throw new Error("invalid json body");
        const record = body as Record<string, unknown>;
        categoryValue = typeof record.category === "string" ? record.category : null;
        description = typeof record.description === "string" ? record.description : null;
        files = [];
      } else throw new Error("unsupported content type");
    } catch {
      set.status = 400;
      return { error: "Dữ liệu gửi lên không hợp lệ", code: "VALIDATION_ERROR" };
    }
    if (!category.Value.Check(categoryValue) || !description) { set.status = 400; return { error: "Dữ liệu gửi lên không hợp lệ", code: "VALIDATION_ERROR" }; }
    const ticketCategory = categoryValue as "electricity" | "water" | "facilities" | "other";
    const result = await createTicket({ renterId: session.renterId, motelId: session.motelId, roomId: renter.roomId, category: ticketCategory, description, files });
    set.status = 201;
    return result;
  }, { detail: { security: [{ renterAuth: [] }] } });
