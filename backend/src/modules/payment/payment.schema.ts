import { check, foreignKey, index, integer, pgEnum, pgTable, text, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { invoices } from "@/modules/billing/billing.schema";
import { managers } from "@/modules/auth/auth.schema";
import { motels } from "@/modules/motel/motel.schema";
import { renters } from "@/modules/renter/renter.schema";

export const paymentProofStatus = pgEnum("payment_proof_status", ["pending", "approved", "rejected"]);

export const paymentProofs = pgTable(
  "payment_proofs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    invoiceId: uuid("invoice_id").notNull(),
    renterId: uuid("renter_id").notNull().references(() => renters.id),
    motelId: uuid("motel_id").notNull().references(() => motels.id),
    objectKey: text("object_key").notNull(),
    contentType: text("content_type").notNull(),
    size: integer("size").notNull(),
    checksum: text("checksum").notNull(),
    status: paymentProofStatus("status").notNull().default("pending"),
    submittedAt: timestamp("submitted_at", { withTimezone: true }).notNull().defaultNow(),
    reviewedAt: timestamp("reviewed_at", { withTimezone: true }),
    reviewedByManagerId: uuid("reviewed_by_manager_id").references(() => managers.id),
    rejectionReason: text("rejection_reason"),
  },
  (t) => [
    foreignKey({ columns: [t.invoiceId, t.renterId, t.motelId], foreignColumns: [invoices.id, invoices.renterId, invoices.motelId], name: "payment_proofs_invoice_ownership_fk" }),
    index("payment_proofs_invoice_id_idx").on(t.invoiceId),
    index("payment_proofs_renter_id_idx").on(t.renterId),
    index("payment_proofs_motel_id_idx").on(t.motelId),
    uniqueIndex("payment_proofs_object_key_uq").on(t.objectKey),
    uniqueIndex("payment_proofs_current_invoice_uq").on(t.invoiceId).where(sql`${t.status} <> 'rejected'`),
    check("payment_proofs_content_type_check", sql`${t.contentType} in ('image/jpeg', 'image/png')`),
    check("payment_proofs_size_check", sql`${t.size} between 1 and 10485760`),
    check("payment_proofs_checksum_check", sql`length(trim(${t.checksum})) > 0`),
     check("payment_proofs_review_state_check", sql`(${t.status} = 'pending' and ${t.reviewedAt} is null and ${t.reviewedByManagerId} is null and ${t.rejectionReason} is null) or (${t.status} = 'approved' and ${t.reviewedAt} is not null and ${t.reviewedByManagerId} is not null and ${t.rejectionReason} is null) or (${t.status} = 'rejected' and ${t.reviewedAt} is not null and ${t.reviewedByManagerId} is not null and ${t.rejectionReason} is not null and length(trim(${t.rejectionReason})) between 1 and 500)`),

  ],
);

export type PaymentProofStatus = typeof paymentProofStatus.enumValues[number];
export type PaymentProof = typeof paymentProofs.$inferSelect;
export type NewPaymentProof = typeof paymentProofs.$inferInsert;
