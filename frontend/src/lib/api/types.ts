/**
 * Every shape the manager app receives or sends, hand-written from the backend's own source.
 *
 * **Why hand-written (D7).** The backend declares these in
 * `backend/src/modules/{motel,room,renter}/*.types.ts` and `backend/src/shared/errors.ts`. Importing
 * them is not available: the frontend `tsconfig.json` does not resolve the backend's `@/*` alias, and
 * those files reach `drizzle` schemas, which pull in a database driver the browser bundle must never
 * contain. So the field names below are transcribed, and the backend file each one came from is named
 * in its doc comment — that citation is the drift guard, and a reviewer checking this task should
 * read it against the source rather than against `docs/api-contract.md`, which the code contradicts.
 *
 * This module declares shapes and nothing else: no functions, no constants, no runtime values. A
 * `Response` type that grew a helper would be the signal that the logic belongs in the module that
 * owns the endpoint.
 */
import type { VndString } from "@/lib/format/vnd";
import type { RenterStatus, RoomStatus } from "@/lib/format/status";

/**
 * Re-exported, not redeclared (D6, ruling R1). `lib/format/vnd.ts` owns the alias because
 * `parseVndDigits` returns it; two declarations would give every money field in the app two
 * incompatible ways of being one.
 */
export type { VndString };

/**
 * Re-exported for the same reason. `lib/format/status.ts` owns both unions, and its label maps are
 * `Record<RoomStatus, string>` — a union declared a second time here would be a *different* type, so
 * `roomStatusLabel(room.status)` would stop compiling while each copy still looked correct.
 */
export type { RenterStatus, RoomStatus };

/**
 * The stable machine identifier for a failure, transcribed from
 * `backend/src/shared/errors.ts:1-14`.
 *
 * The `code` is what a caller branches on; the HTTP status is only how the server chose to send it.
 * Two codes share a status on purpose — `MAGIC_LINK_EXPIRED` and `UNAUTHORIZED` are both 401, and a
 * screen that cannot tell an expired link from a missing session will send the manager somewhere
 * useless.
 */
export type ErrorCode =
  | "VALIDATION_ERROR"
  | "UNAUTHORIZED"
  | "MAGIC_LINK_EXPIRED"
  | "OTP_INVALID"
  | "OTP_EXPIRED"
  | "RATE_LIMITED"
  | "READING_CONFLICT"
  | "PERIOD_ALREADY_SENT"
  | "FORBIDDEN"
  | "NOT_FOUND"
  | "CONFLICT"
  | "EXTERNAL_SERVICE_ERROR"
  | "INTERNAL_ERROR";

/**
 * The error envelope every non-2xx carries, from `backend/src/middleware/error-handler.ts:11-33`.
 *
 * `error` is Vietnamese and written for the renter to read (`AGENTS.md`), which is what makes it safe
 * to render on a 4xx — and only a 4xx: see `client.ts`, which replaces it on a 5xx.
 *
 * `details` is deliberately loose and deliberately unused. `error-handler.ts:14-16` includes it only
 * when a service set it, and `:23-26` returns a bare `{ error, code }` for a schema failure — so a
 * `VALIDATION_ERROR` carries no field names to map. Field-level errors are owned by client-side
 * validation (D8); a server `VALIDATION_ERROR` is a form-level banner.
 */
export interface ApiErrorBody {
  error: string;
  code: ErrorCode;
  details?: Record<string, unknown>;
}

export interface ReadingConflictDetails {
  server?: { roomId: string; type: MeterType; currentReading: string | null; updatedAt: string };
  [key: string]: unknown;
}

/* -------------------------------------------------------------------------- */
/* Motels — backend/src/modules/motel/motel.types.ts                          */
/* -------------------------------------------------------------------------- */

/** `motel.types.ts:18-22`. A recurring charge the manager adds to every bill. */
export interface MotelFeeInput {
  name: string;
  /** VND, whole units. */
  amount: VndString;
}

/** `motel.types.ts:24-28`. Where VietQR sends the renter's money. */
export interface BankAccountInput {
  bankCode: string;
  accountNumber: string;
  accountName: string;
}

/** `motel.types.ts:30-37` — the `POST /api/manager/motels` body. */
export interface CreateMotelInput {
  name: string;
  address?: string | null;
  electricityPrice: VndString;
  waterPrice: VndString;
  otherFees?: MotelFeeInput[];
  bankAccount?: BankAccountInput | null;
}

/**
 * `motel.types.ts:40-47` — the `PATCH` body.
 *
 * Every key optional, and a key absent from the body is never written
 * (`motel.service.ts` copies field by field). A `null` is a real instruction: it clears the value.
 */
export interface UpdateMotelInput {
  name?: string;
  address?: string | null;
  electricityPrice?: VndString;
  waterPrice?: VndString;
  otherFees?: MotelFeeInput[];
  bankAccount?: BankAccountInput | null;
}

/**
 * `motel.types.ts:49-60`.
 *
 * `otherFees` is `[]` and `bankAccount` is `null` rather than absent on a motel that has neither:
 * `motel.service.ts` maps a row through `toResponse`, so both keys are always present. A screen that
 * reads `motel.bankAccount.accountName` must fail on `null`, not on `undefined`.
 *
 * `address` is nullable for the same reason — a motel is addressable by name alone.
 */
export interface MotelResponse {
  id: string;
  managerId: string;
  name: string;
  address: string | null;
  /** VND per kWh. */
  electricityPrice: VndString;
  /** VND per m³. */
  waterPrice: VndString;
  otherFees: MotelFeeInput[];
  bankAccount: BankAccountInput | null;
  /** ISO-8601 UTC string on the wire, from `toISOString()` (`motel.service.ts:37`). */
  createdAt: string;
}

/* -------------------------------------------------------------------------- */
/* Rooms — backend/src/modules/room/room.types.ts                              */
/* -------------------------------------------------------------------------- */

/** `room.types.ts:17-23` — the `POST` body. */
export interface CreateRoomInput {
  name: string;
  /** VND, whole units, per month. */
  basePrice: VndString;
  /** Nullable: a ground-floor room may have no floor recorded. */
  floor?: number | null;
  status?: RoomStatus;
}

/** `room.types.ts:25-31` — the `PATCH` body. */
export interface UpdateRoomInput {
  name?: string;
  basePrice?: VndString;
  floor?: number | null;
  status?: RoomStatus;
}

/**
 * `room.types.ts:33-37` — the `?floor=&status=&search=` filters.
 *
 * `floor` is a number, and `0` is a value: `room.service.ts:114` filters on `!== undefined`, so a
 * truthiness test on the way out would send no filter and answer with every floor.
 *
 * An empty `search` is a legal value that the service treats as no filter
 * (`room.service.ts:117-119`), so it is also safe to send; `rooms.ts` drops it anyway.
 */
export interface ListRoomsFilters {
  floor?: number;
  status?: RoomStatus;
  search?: string;
}

/** `room.types.ts:39-47`. */
export interface RoomResponse {
  id: string;
  motelId: string;
  name: string;
  /** VND, whole units, per month. */
  basePrice: VndString;
  floor: number | null;
  status: RoomStatus;
  /** ISO-8601 UTC string on the wire, from `toISOString()` (`room.service.ts:89`). */
  createdAt: string;
}

/* -------------------------------------------------------------------------- */
/* Billing — backend/src/modules/billing/billing.types.ts                       */
/* -------------------------------------------------------------------------- */

export type BillingPeriodStatus = "draft" | "sent" | "closed";
export type MeterType = "electric" | "water";
export type PaymentStatus = "unpaid" | "paid" | "overdue";

export interface BillingPeriodResponse {
  id: string;
  motelId: string;
  month: number;
  year: number;
  status: BillingPeriodStatus;
  createdAt: string;
}

export interface MeterReadingResponse {
  id: string;
  roomId: string;
  type: MeterType;
  previousReading: string;
  currentReading: string | null;
  readingDate: string | null;
  updatedAt: string;
}

export interface BillingPeriodDetailResponse extends BillingPeriodResponse {
  rooms: Array<{ id: string; name: string; readings: MeterReadingResponse[] }>;
}

export interface CapturePeriodFixture extends BillingPeriodDetailResponse {
  rooms: Array<{ id: string; name: string; readings: MeterReadingResponse[] }>;
}

export interface UpdateReadingInput {
  roomId: string;
  type: MeterType;
  currentReading: string;
  expectedUpdatedAt: string;
}

export interface UpdateReadingsInput {
  readings: UpdateReadingInput[];
}

export interface InvoiceResponse {
  id: string;
  billingPeriodId: string;
  roomId: string;
  roomName: string;
  renterId: string;
  motelId: string;
  rentAmount: VndString;
  electricityUsage: string;
  electricityCost: VndString;
  waterUsage: string;
  waterCost: VndString;
  otherFees: MotelFeeInput[];
  totalAmount: VndString;
  qrCodeData: string | null;
  paymentStatus: PaymentStatus;
  paidAt: string | null;
  createdAt: string;
}

export interface InvoiceGenerationResponse {
  invoices: InvoiceResponse[];
  details: { skippedRooms: Array<{ id: string; name: string }> };
}

export interface UploadResponse {
  id: string;
  contentType: string;
  size: number;
  checksum: string;
  createdAt: string;
}

export interface CaptureUploadResponse extends UploadResponse {
  url?: string;
}

/* -------------------------------------------------------------------------- */
/* Renters — backend/src/modules/renter/renter.types.ts                         */
/* -------------------------------------------------------------------------- */

/** `renter.types.ts:7-15` — the `POST` body. No `status`: a renter starts active. */
export interface CreateRenterInput {
  name: string;
  /** Local or `+84` form; normalised to `84XXXXXXXXX` before it is stored. */
  phone: string;
  idNumber?: string | null;
  idCardFrontUrl?: string | null;
  idCardBackUrl?: string | null;
  /** Must be a room of *this* motel, or the request is 404. */
  roomId?: string | null;
}

/** `renter.types.ts:25-34` — the `PATCH` body. An explicit `null` clears; absent leaves alone. */
export interface UpdateRenterInput {
  name?: string;
  phone?: string;
  idNumber?: string | null;
  idCardFrontUrl?: string | null;
  idCardBackUrl?: string | null;
  roomId?: string | null;
  status?: RenterStatus;
}

/** `renter.types.ts:36-40` — the `?status=&roomId=&search=` filters. */
export interface ListRentersFilters {
  status?: RenterStatus;
  roomId?: string;
  search?: string;
}

/**
 * `renter.types.ts:42-58`.
 *
 * `phone` is always the normalised `84XXXXXXXXX` form, whatever the manager typed
 * (`renter.service.ts:126`), so a screen never has to normalise to compare it.
 *
 * `roomId` is null until the renter is assigned a room (`renter.schema.ts:38`), and `zaloOaId` is
 * null until they follow the OA — `isOaFollower` can therefore be `false` while `zaloOaId` is set,
 * so the switch behind the follow banner reads the boolean, never the id.
 */
export interface RenterResponse {
  id: string;
  motelId: string;
  name: string;
  phone: string;
  idNumber: string | null;
  idCardFrontUrl: string | null;
  idCardBackUrl: string | null;
  roomId: string | null;
  zaloOaId: string | null;
  isOaFollower: boolean;
  status: RenterStatus;
  /** ISO-8601 UTC string on the wire, from `toISOString()` (`renter.service.ts:126`). */
  createdAt: string;
}

/**
 * `backend/src/modules/contract/contract.service.ts:24-33`, reached through
 * `RenterDetailResponse`. Transcribed rather than imported for the reason in the file header.
 *
 * `startDate` and `endDate` are `YYYY-MM-DD`: a `date` column is a calendar day, not an instant, so
 * no timezone applies and neither may be rendered through `formatDate` as though it were one.
 */
export interface ActiveContractSummary {
  id: string;
  roomId: string;
  /** The room's display name, e.g. `P.101` — the only form a manager recognises it by. */
  roomName: string;
  startDate: string;
  endDate: string;
  /** VND, whole units, per month. */
  monthlyRent: VndString;
}

/**
 * `backend/src/modules/billing/billing.service.ts:10-17`, reached through `RenterDetailResponse`.
 *
 * There is **no due date**: the UI spec forbids showing one (`docs/frontend-ui-specs.md`, R1), so
 * `paymentStatus` is the whole of the urgency signal and `overdue` is a manual state.
 */
export interface RecentInvoice {
  id: string;
  billingPeriodId: string;
  /** VND, whole units. */
  totalAmount: VndString;
  paymentStatus: "unpaid" | "paid" | "overdue";
  /** ISO-8601 UTC string on the wire. */
  createdAt: string;
}

/**
 * `renter.types.ts:73-76` — what `GET /api/manager/motels/:motelId/renters/:renterId` answers with:
 * the row, plus the two things a manager opens that screen to see.
 *
 * `activeContract` is `null` and `invoices` is `[]` for a renter with neither, which is a state a
 * motel actually has — a tenant who moved in before the contract was written
 * (`renter.service.ts:246` spreads `null` and `[]` straight through). Answering it with an empty
 * object would be a lie.
 */
export interface RenterDetailResponse extends RenterResponse {
  activeContract: ActiveContractSummary | null;
  invoices: RecentInvoice[];
}

export interface RenterPortalProfile {
  id: string;
  name: string;
  phone: string;
  room: { id: string; name: string; floor: number | null } | null;
  motel: { id: string; name: string; bankAccount: { bankCode: string; accountNumber: string; accountName: string } | null };
  activeContract: ActiveContractSummary | null;
}

export interface RenterPeriod {
  id: string;
  month: number;
  year: number;
  status: "draft" | "sent" | "closed";
  createdAt: string;
}

export interface RenterInvoiceSummary {
  id: string;
  billingPeriodId: string;
  month: number;
  year: number;
  roomId: string;
  roomName: string;
  rentAmount: VndString;
  electricityUsage: string;
  electricityCost: VndString;
  waterUsage: string;
  waterCost: VndString;
  otherFees: Array<{ name: string; amount: VndString }>;
  totalAmount: VndString;
  qrCodeData: string | null;
  paymentStatus: PaymentStatus;
  paymentMethod: "bank_transfer" | "cash" | null;
  paidAt: string | null;
  createdAt: string;
}
export type PaymentProofStatus = "pending" | "approved" | "rejected";
export interface PaymentProof {
  id: string;
  invoiceId: string;
  status: PaymentProofStatus;
  contentType: "image/jpeg" | "image/png";
  size: number;
  submittedAt: string;
  reviewedAt: string | null;
  rejectionReason: string | null;
}
export interface RenterPaymentProof extends PaymentProof { signedUrl: string; }

export interface RenterInvoiceDetail extends RenterInvoiceSummary {
  bankAccount: { bankCode: string; accountNumber: string; accountName: string } | null;
  transferDescription: string;
  meterPhotos: Array<{ type: "electric" | "water"; signedUrl: string; capturedAt: string | null }>;
}
export type RenterInvoice = RenterInvoiceSummary | RenterInvoiceDetail;

export interface CreateRenterTicketInput {
  category: RenterTicketCategory;
  description: string;
  photoUrls?: string[];
  photos?: File[];
}

export type ContractStatus = "draft" | "active" | "expired" | "terminated";
export interface ContractClause { title: string; content: string; }
export interface ContractTemplateResponse { id: string; motelId: string; name: string; clauses: ContractClause[]; isDefault: boolean; createdAt: string; }
export interface CreateContractTemplateInput { name: string; clauses: ContractClause[]; isDefault?: boolean; }
export interface UpdateContractTemplateInput { name?: string; clauses?: ContractClause[]; isDefault?: boolean; }
export interface CreateContractInput { renterId: string; roomId: string; templateId?: string; startDate: string; endDate: string; monthlyRent?: VndString; deposit?: VndString; clauses?: ContractClause[]; }
export interface UpdateContractInput { templateId?: string; startDate?: string; endDate?: string; monthlyRent?: VndString; deposit?: VndString; clauses?: ContractClause[]; }
export interface ContractResponse { id: string; motelId: string; renterId: string; roomId: string; startDate: string; endDate: string; monthlyRent: VndString; deposit: VndString; clauses: ContractClause[]; otpSentAt: string | null; otpSignedAt: string | null; status: ContractStatus; createdAt: string; }

export interface RenterContract {
  id: string;
  motelId: string;
  renterId: string;
  roomId: string;
  startDate: string;
  endDate: string;
  monthlyRent: VndString;
  deposit: VndString;
  clauses: Array<{ title: string; content: string }>;
  otpSentAt: string | null;
  otpSignedAt: string | null;
  status: "draft" | "active" | "expired" | "terminated";
  createdAt: string;
}

export type RenterTicketCategory = "electricity" | "water" | "facilities" | "other";
export interface RenterTicket {
  id: string;
  category: RenterTicketCategory;
  description: string;
  status: "open" | "in_progress" | "resolved";
  createdAt: string;
  photoUrls?: string[];
}
/* -------------------------------------------------------------------------- */
/* Auth — backend/src/modules/auth/auth.route.ts                                 */
/* -------------------------------------------------------------------------- */

/**
 * What `POST /api/auth/register` and `POST /api/auth/login` answer with:
 * `{ id, email, name }` (`auth.route.ts:32`, `:56`).
 *
 * Both set `manager_session` on the response, so both are called from the **browser** through the
 * proxied path — a Server Action would have to forward `Set-Cookie` by hand and get every attribute
 * right. See `auth.client.ts`.
 */
export interface ManagerAuthResponse {
  id: string;
  email: string;
  name: string;
}

/**
 * What `GET /api/auth/me` answers with: `{ id, email }` (`auth.route.ts:77`).
 *
 * **Not** the same type as `ManagerAuthResponse`, though the two look similar, and the missing
 * `name` is not an oversight to tidy up: `/me` reads the claims off the JWT
 * (`auth.types.ts`), which never carried a name. A screen that renders a manager's name from `/me`
 * gets `undefined` — so the top bar shows the email, and the name arrives from the login response.
 */
export interface ManagerMeResponse {
  id: string;
  email: string;
}

/** The `POST /api/auth/register` body (`auth.route.ts:35-40`). */
export interface RegisterManagerInput {
  email: string;
  /** ≥ 8 characters, enforced by the route schema. */
  password: string;
  name: string;
  phone?: string;
}

/** The `POST /api/auth/login` body (`auth.route.ts:59-63`). */
export interface LoginInput {
  email: string;
  password: string;
}

/**
 * What `POST /api/manager/motels/:motelId/renters/:renterId/magic-link` answers with:
 * `{ token, url }` (`auth.route.ts:84-104`).
 *
 * `token` is the opaque magic-link token; `url` is the full renter-portal URL the manager can copy
 * and send to the renter through any channel.
 */
export interface MagicLinkResponse {
  token: string;
  url: string;
}
