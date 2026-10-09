/**
 * Response fixtures, each one **assigned to the type the API promises for it**.
 *
 * This file is the drift guard the Task 4 brief asks for, and it works in two directions:
 *
 * - A field the backend renames makes the assignment below fail the typecheck, so the break
 *   surfaces here rather than as `undefined` on a screen. `tsc --noEmit` is the assertion; the
 *   runtime tests in `fixtures.test.ts` exist because an `as` cast would defeat the assignment and
 *   because a fixture that quietly became a *number* would still satisfy `Record<string, unknown>`.
 * - Every `VndString` in `lib/api/types.ts` has to appear in a fixture below, so the money guard's
 *   coverage in `client.test.ts` is a statement about the whole surface rather than about the two
 *   prices a lazy fixture would have used.
 *
 * Every value mirrors what `backend/src/modules/{motel,room,renter}/*.service.ts` can actually
 * produce — money as a digit string, `createdAt` as an ISO-8601 UTC instant (`toISOString()`),
 * contract dates as `YYYY-MM-DD` calendar days. Not `.test.ts`, so Vitest does not collect it.
 */
import type {
  ActiveContractSummary,
  CreateMotelInput,
  ManagerAuthResponse,
  ManagerMeResponse,
  BillingPeriodResponse,
  BillingPeriodDetailResponse,
  MotelResponse,
  RecentInvoice,
  RenterDetailResponse,
  RenterResponse,
  RoomResponse,
} from "@/lib/api/types";

export const MANAGER_ID = "3d9f1b7a-5c62-4e08-9a3d-1f2e3c4b5a60";
export const MOTEL_ID = "6f1c1a52-0d4e-4a2b-9c3d-8e5f6a7b8c9d";
export const ROOM_ID = "2b3c4d5e-6f70-4812-9345-a6b7c8d9e0f1";
export const RENTER_ID = "9e8d7c6b-5a49-4382-9170-6f5e4d3c2b1a";
export const CONTRACT_ID = "c4d5e6f7-a8b9-4c0d-8e1f-2a3b4c5d6e7f";
export const BILLING_PERIOD_ID = "b1c2d3e4-f5a6-4b7c-8d9e-0f1a2b3c4d5e";
export const CAPTURE_READING_ID = "d1e2f3a4-b5c6-4789-9012-3a4b5c6d7e8f";
export const CAPTURE_PERIOD: BillingPeriodResponse = { id: BILLING_PERIOD_ID, motelId: MOTEL_ID, month: 10, year: 2026, status: "draft", createdAt: "2026-10-01T00:00:00.000Z" };
export const CAPTURE_PERIOD_DETAIL: BillingPeriodDetailResponse = { ...CAPTURE_PERIOD, electricityPrice: "3500", waterPrice: "15000", rooms: [{ id: ROOM_ID, name: "P.101", readings: [{ id: CAPTURE_READING_ID, roomId: ROOM_ID, type: "electric", previousReading: "100", currentReading: null, readingDate: null, updatedAt: "2026-10-01T00:00:00.000Z" }, { id: "e2f3a4b5-c6d7-4890-9123-4b5c6d7e8f90", roomId: ROOM_ID, type: "water", previousReading: "2.00", currentReading: null, readingDate: null, updatedAt: "2026-10-01T00:00:00.000Z" }] }] };
export const INVOICE_ID = "e5f6a7b8-c9d0-4e1f-8a2b-3c4d5e6f7a8b";

/** A manager with one motel, one unit price of each kind, an extra fee and a bank account. */
export const MOTEL: MotelResponse = {
  id: MOTEL_ID,
  managerId: MANAGER_ID,
  name: "Nhà trọ Minh Anh",
  address: "12 Lý Thường Kiệt, Quận 1",
  electricityPrice: "3500",
  waterPrice: "15000",
  otherFees: [
    { name: "Vệ sinh chung", amount: "50000" },
    { name: "Gửi xe", amount: "100000" },
  ],
  bankAccount: {
    bankCode: "970436",
    accountNumber: "0123456789",
    accountName: "NGUYEN VAN MINH",
  },
  createdAt: "2026-09-01T02:00:00.000Z",
};

/** A motel with no address, no extra fees and no bank account — a real state, not a null test. */
export const MOTEL_WITHOUT_EXTRAS: MotelResponse = {
  id: "a1a1a1a1-b2b2-c3c3-d4d4-e5e5f5f5f5f5",
  managerId: MANAGER_ID,
  name: "Nhà trọ Quê Hương",
  address: null,
  electricityPrice: "3000",
  waterPrice: "12000",
  otherFees: [],
  bankAccount: null,
  createdAt: "2026-09-02T02:00:00.000Z",
};

export const ROOM: RoomResponse = {
  id: ROOM_ID,
  motelId: MOTEL_ID,
  name: "P.101",
  basePrice: "3500000",
  floor: 1,
  status: "occupied",
  createdAt: "2026-09-01T02:00:00.000Z",
};

/** `floor` is nullable in the schema, so a ground-floor room with no floor recorded is legal. */
export const ROOM_WITHOUT_FLOOR: RoomResponse = {
  id: "f6a7b8c9-d0e1-4f2a-8b3c-4d5e6f7a8b9c",
  motelId: MOTEL_ID,
  name: "P.001",
  basePrice: "3000000",
  floor: null,
  status: "available",
  createdAt: "2026-09-01T02:05:00.000Z",
};

export const ROOMS: RoomResponse[] = [ROOM, ROOM_WITHOUT_FLOOR];

export const RENTER: RenterResponse = {
  id: RENTER_ID,
  motelId: MOTEL_ID,
  name: "Trần Thị B",
  phone: "84901234567",
  idNumber: "079203004567",
  idCardFrontUrl: "renters/9e8d7c6b/front.jpg",
  idCardBackUrl: null,
  roomId: ROOM_ID,
  zaloOaId: "oa.zalo.9f8e7d6c5b4a",
  isOaFollower: true,
  status: "active",
  createdAt: "2026-09-05T03:20:00.000Z",
};

/** A renter filed but not yet assigned a room, which is why `roomId` and `zaloOaId` are nullable. */
export const RENTER_WITHOUT_ROOM: RenterResponse = {
  id: "0a1b2c3d-4e5f-4061-8273-8495a6b7c8d9",
  motelId: MOTEL_ID,
  name: "Lê Văn C",
  phone: "84912345678",
  idNumber: null,
  idCardFrontUrl: null,
  idCardBackUrl: null,
  roomId: null,
  zaloOaId: null,
  isOaFollower: false,
  status: "inactive",
  createdAt: "2026-09-06T03:20:00.000Z",
};

export const RENTERS: RenterResponse[] = [RENTER, RENTER_WITHOUT_ROOM];

export const ACTIVE_CONTRACT: ActiveContractSummary = {
  id: CONTRACT_ID,
  roomId: ROOM_ID,
  roomName: "P.101",
  startDate: "2026-09-01",
  endDate: "2027-08-31",
  monthlyRent: "3500000",
};

export const INVOICE_OVERDUE: RecentInvoice = {
  id: INVOICE_ID,
  billingPeriodId: BILLING_PERIOD_ID,
  totalAmount: "3740000",
  paymentStatus: "overdue",
  createdAt: "2026-10-01T00:05:00.000Z",
};

export const INVOICE_PAID: RecentInvoice = {
  id: "1b2c3d4e-5f60-4718-8293-a4b5c6d7e8f9",
  billingPeriodId: "2c3d4e5f-6071-4829-93a4-b5c6d7e8f9a0",
  totalAmount: "3672000",
  paymentStatus: "paid",
  createdAt: "2026-11-01T00:05:00.000Z",
};

/** The detail view: the renter, plus the live contract and the invoice history. */
export const RENTER_DETAIL: RenterDetailResponse = {
  ...RENTER,
  activeContract: ACTIVE_CONTRACT,
  invoices: [INVOICE_OVERDUE, INVOICE_PAID],
};

/**
 * A renter with neither a contract nor an invoice — the state `RenterDetailResponse` answers with
 * `null` and `[]`, which a fixture that only covers the full case would leave untested.
 */
export const RENTER_DETAIL_WITHOUT_HISTORY: RenterDetailResponse = {
  ...RENTER_WITHOUT_ROOM,
  activeContract: null,
  invoices: [],
};

/** What `POST /api/auth/register` and `POST /api/auth/login` answer with. */
export const MANAGER_AUTH: ManagerAuthResponse = {
  id: MANAGER_ID,
  email: "minhanh@example.vn",
  name: "Nguyễn Minh Anh",
};

/** What `GET /api/auth/me` answers with — no `name`, and a type that does not pretend otherwise. */
export const MANAGER_ME: ManagerMeResponse = {
  id: MANAGER_ID,
  email: "minhanh@example.vn",
};

export const CREATE_MOTEL: CreateMotelInput = {
  name: "Nhà trọ Minh Anh",
  address: "12 Lý Thường Kiệt, Quận 1",
  electricityPrice: "3500",
  waterPrice: "15000",
  otherFees: [{ name: "Vệ sinh chung", amount: "50000" }],
  bankAccount: {
    bankCode: "970436",
    accountNumber: "0123456789",
    accountName: "NGUYEN VAN MINH",
  },
};
