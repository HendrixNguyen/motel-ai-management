import { and, eq, sql } from "drizzle-orm";
import { t } from "elysia";
import { db } from "@/db";
import { resolveAccessibleMotel, type MotelActor } from "@/middleware/tenancy";
import { AppError } from "@/shared/errors";
import { monthlyUtilityCosts } from "./monthly-utility-costs.schema";
import { billingPeriods } from "./billing.schema";
import type { MonthlyUtilityReport } from "./monthly-utility-costs.types";
import type {
  MonthlyUtilityCostInput,
  MonthlyUtilityCostResponse,
} from "./monthly-utility-costs.types";

export const monthlyUtilityCostsParams = t.Object({
  motelId: t.String({ format: "uuid" }),
  year: t.String({ pattern: "^\\d{1,4}$" }),
  month: t.String({ pattern: "^\\d{1,2}$" }),
});

const amountSchema = t.Union([t.String({ pattern: "^\\d{1,14}$" }), t.Null()]);
const noteSchema = t.Union([t.String({ maxLength: 2000 }), t.Null()]);
export const monthlyUtilityCostsBody = t.Object({
  electricityAmount: amountSchema,
  waterAmount: amountSchema,
  electricityNotes: noteSchema,
  waterNotes: noteSchema,
});

function monthKey(year: string, month: string) {
  const y = Number(year);
  const m = Number(month);
  if (!Number.isInteger(y) || y < 1 || y > 9999 || !Number.isInteger(m) || m < 1 || m > 12)
    throw AppError.badRequest("Tháng hoặc năm không hợp lệ");
  return { year: y, month: m };
}

function normalize(input: MonthlyUtilityCostInput): MonthlyUtilityCostInput {
  return {
    ...input,
    electricityNotes: input.electricityNotes?.trim() || null,
    waterNotes: input.waterNotes?.trim() || null,
  };
}

function response(row: typeof monthlyUtilityCosts.$inferSelect): MonthlyUtilityCostResponse {
  return {
    motelId: row.motelId,
    year: row.year,
    month: row.month,
    electricityAmount: row.electricityAmount,
    waterAmount: row.waterAmount,
    electricityNotes: row.electricityNotes,
    waterNotes: row.waterNotes,
  };
}

export async function upsertMonthlyUtilityCosts(
  motelId: string,
  actor: MotelActor,
  yearInput: string | number,
  monthInput: string | number,
  input: MonthlyUtilityCostInput,
): Promise<MonthlyUtilityCostResponse> {
  const { year, month } = monthKey(String(yearInput), String(monthInput));
  await resolveAccessibleMotel(motelId, actor);
  const values = normalize(input);
  const [row] = await db
    .insert(monthlyUtilityCosts)
    .values({ motelId, year, month, ...values })
    .onConflictDoUpdate({
      target: [monthlyUtilityCosts.motelId, monthlyUtilityCosts.year, monthlyUtilityCosts.month],
      set: { ...values, updatedAt: new Date() },
    })
    .returning();
  if (!row) throw AppError.badRequest("Không thể lưu chi phí điện nước");
  return response(row);
}

export async function getMonthlyUtilityReport(
  motelId: string,
  actor: MotelActor,
  yearInput: string | number,
  monthInput: string | number,
): Promise<MonthlyUtilityReport> {
  const { year, month } = monthKey(String(yearInput), String(monthInput));
  return db.transaction(async (tx) => {
    await resolveAccessibleMotel(motelId, actor, tx);
    const period = (
      await tx
        .select({ id: billingPeriods.id, status: billingPeriods.status })
        .from(billingPeriods)
        .where(
          and(
            eq(billingPeriods.motelId, motelId),
            eq(billingPeriods.year, year),
            eq(billingPeriods.month, month),
          ),
        )
        .limit(1)
    )[0];
    const cost = (
      await tx
        .select()
        .from(monthlyUtilityCosts)
        .where(
          and(
            eq(monthlyUtilityCosts.motelId, motelId),
            eq(monthlyUtilityCosts.year, year),
            eq(monthlyUtilityCosts.month, month),
          ),
        )
        .limit(1)
    )[0];
    const aggregate = period
      ? ((
          (await tx.execute(sql`select
          coalesce(sum(i.electricity_cost), 0)::text as electricity_billed,
          coalesce(sum(i.water_cost), 0)::text as water_billed,
          coalesce(sum(i.total_amount), 0)::text as total_billed,
          coalesce(sum(i.electricity_cost) filter (where i.payment_status = 'paid'), 0)::text as electricity_collected,
          coalesce(sum(i.water_cost) filter (where i.payment_status = 'paid'), 0)::text as water_collected,
          coalesce(sum(i.total_amount) filter (where i.payment_status = 'paid'), 0)::text as total_collected
        from invoices i
        inner join billing_periods p on p.id = i.billing_period_id
        where i.motel_id = ${motelId} and p.motel_id = ${motelId} and p.id = ${period.id} and p.year = ${year} and p.month = ${month} and p.status in ('sent', 'closed')`)) as unknown as Record<
            string,
            string
          >[]
        )[0] ?? null)
      : null;
    const periodStatus = period?.status ?? null;
    const billedE = aggregate?.electricity_billed ?? "0";
    const billedW = aggregate?.water_billed ?? "0";
    const collectedE = aggregate?.electricity_collected ?? "0";
    const collectedW = aggregate?.water_collected ?? "0";
    const billedTotal = aggregate?.total_billed ?? "0";
    const collectedTotal = aggregate?.total_collected ?? "0";
    const costE = cost?.electricityAmount ?? null;
    const costW = cost?.waterAmount ?? null;
    const sum = (...values: string[]) =>
      values.reduce((total, value) => total + BigInt(value), 0n).toString();
    const diff = (amount: string, amountCost: string | null) =>
      amountCost === null ? null : (BigInt(amount) - BigInt(amountCost)).toString();
    const utilityCost = costE === null || costW === null ? null : sum(costE, costW);
    const costsResponse = cost
      ? response(cost)
      : {
          motelId,
          year,
          month,
          electricityAmount: null,
          waterAmount: null,
          electricityNotes: null,
          waterNotes: null,
        };
    return {
      motelId,
      year,
      month,
      periodStatus,
      costs: {
        electricityAmount: costsResponse.electricityAmount,
        waterAmount: costsResponse.waterAmount,
        electricityNotes: costsResponse.electricityNotes,
        waterNotes: costsResponse.waterNotes,
      },
      electricity: {
        billed: billedE,
        collected: collectedE,
        cost: costE,
        billedDifference: diff(billedE, costE),
        collectedDifference: diff(collectedE, costE),
      },
      water: {
        billed: billedW,
        collected: collectedW,
        cost: costW,
        billedDifference: diff(billedW, costW),
        collectedDifference: diff(collectedW, costW),
      },
      utilities: {
        billed: sum(billedE, billedW),
        collected: sum(collectedE, collectedW),
        cost: utilityCost,
        billedDifference: diff(sum(billedE, billedW), utilityCost),
        collectedDifference: diff(sum(collectedE, collectedW), utilityCost),
      },
      totals: {
        billed: billedTotal,
        collected: collectedTotal,
        outstanding: (BigInt(billedTotal) - BigInt(collectedTotal)).toString(),
        billedLessUtilityCosts: diff(billedTotal, utilityCost),
        collectedLessUtilityCosts: diff(collectedTotal, utilityCost),
      },
    };
  });
}

export async function getMonthlyUtilityCosts(
  motelId: string,
  actor: MotelActor,
  yearInput: string | number,
  monthInput: string | number,
): Promise<MonthlyUtilityCostResponse> {
  const { year, month } = monthKey(String(yearInput), String(monthInput));
  await resolveAccessibleMotel(motelId, actor);
  const [row] = await db
    .select()
    .from(monthlyUtilityCosts)
    .where(
      and(
        eq(monthlyUtilityCosts.motelId, motelId),
        eq(monthlyUtilityCosts.year, year),
        eq(monthlyUtilityCosts.month, month),
      ),
    )
    .limit(1);
  return row
    ? response(row)
    : {
        motelId,
        year,
        month,
        electricityAmount: null,
        waterAmount: null,
        electricityNotes: null,
        waterNotes: null,
      };
}
