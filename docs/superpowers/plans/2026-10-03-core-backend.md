# Core Backend + Database Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development
> (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use
> checkbox (`- [ ]`) syntax for tracking.

**Goal:** A booting ElysiaJS backend with the full Drizzle schema, migrations running against
a real PostgreSQL database, environment parsing that fails fast, manager and renter auth,
tenant isolation, and one error envelope.

**Architecture:** Modular monolith. Each domain module under `backend/src/modules/` owns its
routes, service, Drizzle tables, and types. Cross-module calls go through exported service
functions. This plan builds the foundation only — no domain business logic beyond what the
auth and tenancy layers need.

**Tech Stack:** Bun, ElysiaJS, TypeScript (strict), PostgreSQL 16, Drizzle ORM + drizzle-kit,
`@elysiajs/jwt`, argon2, `bun:test`.

**Spec:** [`docs/superpowers/specs/2026-10-03-motel-management-design.md`](../../docs/superpowers/specs/2026-10-03-motel-management-design.md) — read the Data Model, Authentication, Backend Architecture, Error Handling, and Security sections before starting. Also read [`docs/api-contract.md`](../../docs/api-contract.md) for the error codes and envelope, [`docs/testing-strategy.md`](../../docs/testing-strategy.md) for the testing contract, and [`docs/adr/0004-modular-monolith.md`](../../docs/adr/0004-modular-monolith.md) for the module rules.

## Global Constraints

- Bun only. Never `npm`, `yarn`, or `npx`.
- Strict TypeScript. No `any` that survives into exported signatures.
- Money is `NUMERIC(14,0)` and is serialised as a JSON **string** of VND digits. Never a
  float, never a `number` in an API response.
- Vietnamese phone numbers are normalised to `84XXXXXXXXX` — no leading `0`, no `+`.
- Tenant scope always comes from the session, never from a request body. A motel the caller
  does not own returns `404`, never `403`.
- UUID primary keys, `TIMESTAMPTZ` with `now()` defaults.
- Tests hit a real PostgreSQL database, not a mock. A schema constraint that is only
  documented is not tested.
- Each module's tables live in that module's `*.schema.ts`. `db/schemas.ts` may only
  re-export; it may not contain logic.

## Review Focus

Five inputs the spec implies that are easy to get wrong. Each has a test in the task that
owns the code.

1. **Two managers, one motel id.** Manager A requests manager B's motel. Must be `404`,
   never `403` and never data. → Task 5, asserted over HTTP in Task 7
2. **Renter A requests renter B's invoice by guessing the id.** Sequential UUIDs are not
   guessable, but ownership must be checked anyway. → Task 7
3. **Meter goes backwards** (`currentReading < previousReading`). Must be rejected by the
   database, not only by the API. → Task 3
4. **Magic link replay.** A consumed token used a second time must be `401
   MAGIC_LINK_EXPIRED`, not a fresh session. → Task 6
5. **Money as a float.** `3850000.5` or a 16-digit VND amount parsed with `parseInt` loses
   precision on the way into a `NUMERIC(14,0)` column. → Task 1

Each step is one action with a checkable result. Run `/review-security` and `/review-code`
before merging this plan's work — this plan introduces both auth surfaces and the tenancy
boundary, which is exactly what those two reviewers exist to check.

---

## File Structure

```
backend/
  .env.example                 (exists)
  drizzle.config.ts            drizzle-kit config
  package.json                 scripts + deps
  tsconfig.json                (exists)
  src/
    env.ts                     parseEnv + Env type, no side effects
      config.ts                  the validated singleton every module imports
    index.ts                   app assembly, plugin registration, listen
    db/
      index.ts                 postgres-js pool + drizzle client
      migrate.ts               runs migrations programmatically
      schemas.ts               re-exports every module's tables (re-export only)
      test-db.ts               per-test-file schema reset
    middleware/
      error-handler.ts         AppError → error envelope
      manager-auth.ts          requires manager JWT
      renter-auth.ts           resolves renter from cookie or single-use token
    shared/
      errors.ts                AppError taxonomy
      money.ts                 VND parse/format/validate
      phone.ts                 Vietnamese phone normalisation
    modules/
      auth/       auth.route.ts  auth.service.ts  auth.schema.ts  auth.types.ts
      motel/      motel.schema.ts
      room/       room.schema.ts
      renter/     renter.schema.ts
      billing/    billing.schema.ts
      contract/   contract.schema.ts
      ticket/     ticket.schema.ts
      zalo/       (schema lands with sub-project 8 — do not create the directory)
    test/
      helpers.ts
      manager-auth.test.ts
      renter-auth.test.ts
      tenancy.test.ts
      money.test.ts
      phone.test.ts
      schema-constraints.test.ts
```

**Task boundaries:** each task ends with something independently testable. Tasks 1–2 are pure
logic with no database. Task 3 is the schema and migrations. Task 4 is the app booting.
Tasks 5–6 are the two auth surfaces. Task 7 is the regression net that proves the constraints
actually hold.

---

### Task 1: Error taxonomy and money/phone utilities

Pure functions, no database, no framework. Everything downstream depends on these, so they
go first and get the most thorough unit tests.

**Files:**
- Create: `backend/src/shared/errors.ts`
- Create: `backend/src/shared/money.ts`
- Create: `backend/src/shared/phone.ts`
- Test: `backend/src/test/money.test.ts`, `backend/src/test/phone.test.ts`

**Interfaces:**
- Consumes: nothing
- Produces:
  - `AppError` — `class AppError extends Error` with `constructor(code: ErrorCode, message: string, status: number, details?: Record<string, unknown>)`, plus `static badRequest(message, details?)`, `static unauthorized(message)`, `static forbidden(message)`, `static notFound(message)`, `static conflict(message, details?)`, `static rateLimited(message, retryAfterSeconds)`
  - `type ErrorCode = 'VALIDATION_ERROR' | 'UNAUTHORIZED' | 'MAGIC_LINK_EXPIRED' | 'OTP_INVALID' | 'OTP_EXPIRED' | 'RATE_LIMITED' | 'READING_CONFLICT' | 'PERIOD_ALREADY_SENT' | 'FORBIDDEN' | 'NOT_FOUND' | 'CONFLICT' | 'EXTERNAL_SERVICE_ERROR'`
  - `money.ts`: `parseVnd(input: string | number): string` (throws `AppError.badRequest` on non-integer or negative), `formatVnd(amount: string): string` (→ `"3.500.000 ₫"`, dot thousands separator), `sumVnd(...amounts: string[]): string`
  - `phone.ts`: `normalisePhone(input: string): string` (→ `84XXXXXXXXX`, throws `AppError.badRequest` if not a valid Vietnamese mobile or landline), `formatPhone(input: string): string` (→ `"090 123 4567"` for display)

- [ ] **Step 1: Write the failing tests**

`backend/src/test/money.test.ts`:
```ts
import { describe, expect, test } from "bun:test";
import { parseVnd, formatVnd, sumVnd } from "@/shared/money";

describe("parseVnd", () => {
  test("accepts a digit string and returns it unchanged", () => {
    expect(parseVnd("3850000")).toBe("3850000");
  });
  test("rejects a decimal", () => {
    expect(() => parseVnd("3850000.5")).toThrow();
  });
  test("rejects a negative amount", () => {
    expect(() => parseVnd("-1")).toThrow();
  });
  test("rejects a non-numeric string", () => {
    expect(() => parseVnd("3 850 000")).toThrow();
  });
  test("survives a value beyond Number.MAX_SAFE_INTEGER", () => {
    // 9_007_199_254_740_993 > 2^53 - 1; parseFloat would corrupt this.
    expect(parseVnd("9007199254740993")).toBe("9007199254740993");
  });
});

describe("formatVnd", () => {
  test("groups thousands with dots", () => {
    expect(formatVnd("3850000")).toBe("3.850.000 ₫");
  });
  test("leaves values under 1000 ungrouped", () => {
    expect(formatVnd("999")).toBe("999 ₫");
  });
});

describe("sumVnd", () => {
  test("adds without floating point drift", () => {
    expect(sumVnd("0.1", "0.2")).toBe("0.3");
  });
});
```

`backend/src/test/phone.test.ts`:
```ts
import { describe, expect, test } from "bun:test";
import { normalisePhone, formatPhone } from "@/shared/phone";

describe("normalisePhone", () => {
  test("strips a leading zero", () => {
    expect(normalisePhone("0901234567")).toBe("84901234567");
  });
  test("strips a leading plus", () => {
    expect(normalisePhone("+84901234567")).toBe("84901234567");
  });
  test("strips spaces and dashes", () => {
    expect(normalisePhone("090 123-4567")).toBe("84901234567");
  });
  test("rejects a 9-digit number", () => {
    expect(() => normalisePhone("901234567")).toThrow();
  });
  test("rejects letters", () => {
    expect(() => normalisePhone("09a1234567")).toThrow();
  });
});

describe("formatPhone", () => {
  test("groups a mobile number for display", () => {
    expect(formatPhone("84901234567")).toBe("090 123 4567");
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `cd backend && bun test src/test/money.test.ts src/test/phone.test.ts`
Expected: FAIL — `Cannot find module '@/shared/money'`

- [ ] **Step 3: Add the path alias and the test script**

`backend/package.json` — replace the placeholder test script and add deps:
```json
{
  "name": "backend",
  "version": "1.0.50",
  "type": "module",
  "scripts": {
    "dev": "bun run --watch src/index.ts",
    "test": "bun test",
    "start": "bun run src/index.ts",
    "db:generate": "drizzle-kit generate",
    "db:migrate": "bun run src/db/migrate.ts",
    "db:studio": "drizzle-kit studio",
    "typecheck": "tsc --noEmit"
  },
  "dependencies": {
    "@elysiajs/cors": "latest",
    "@elysiajs/jwt": "latest",
    "argon2": "latest",
    "drizzle-orm": "latest",
    "elysia": "latest",
    "postgres": "latest"
  },
  "devDependencies": {
    "@types/bun": "latest",
    "bun-types": "latest",
    "drizzle-kit": "latest",
    "typescript": "^5"
  },
  "module": "src/index.js"
}
```

`backend/tsconfig.json` — add the alias and strict flags:
```json
{
  "compilerOptions": {
    "lib": ["ESNext"],
    "target": "ESNext",
    "module": "ESNext",
    "moduleDetection": "force",
    "moduleResolution": "bundler",
    "paths": { "@/*": ["./src/*"] },
    "allowImportingTsExtensions": true,
    "verbatimModuleSyntax": true,
    "noEmit": true,
    "strict": true,
    "skipLibCheck": true,
    "noUncheckedIndexedAccess": true,
    "noFallthroughCasesInSwitch": true
  },
  "include": ["src"]
}
```

Run: `cd backend && bun install`
Expected: dependencies installed

- [ ] **Step 4: Implement `shared/errors.ts`**

`code` and `status` are always passed as a pair so a new code cannot be added with the
wrong HTTP status.

```ts
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
  | "EXTERNAL_SERVICE_ERROR";

const STATUS: Record<ErrorCode, number> = {
  VALIDATION_ERROR: 400,
  UNAUTHORIZED: 401,
  MAGIC_LINK_EXPIRED: 401,
  OTP_INVALID: 401,
  OTP_EXPIRED: 401,
  RATE_LIMITED: 429,
  READING_CONFLICT: 409,
  PERIOD_ALREADY_SENT: 409,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  CONFLICT: 409,
  EXTERNAL_SERVICE_ERROR: 502,
};

export class AppError extends Error {
  readonly code: ErrorCode;
  readonly status: number;
  readonly details?: Record<string, unknown>;

  constructor(
    code: ErrorCode,
    message: string,
    details?: Record<string, unknown>,
  ) {
    super(message);
    this.name = "AppError";
    this.code = code;
    this.status = STATUS[code];
    this.details = details;
  }

  static badRequest(message: string, details?: Record<string, unknown>) {
    return new AppError("VALIDATION_ERROR", message, details);
  }
  static unauthorized(message = "Chưa đăng nhập") {
    return new AppError("UNAUTHORIZED", message);
  }
  static forbidden(message = "Không có quyền truy cập") {
    return new AppError("FORBIDDEN", message);
  }
  static notFound(message = "Không tìm thấy") {
    return new AppError("NOT_FOUND", message);
  }
  static conflict(message: string, details?: Record<string, unknown>) {
    return new AppError("CONFLICT", message, details);
  }
  static rateLimited(message: string, retryAfterSeconds: number) {
    return new AppError("RATE_LIMITED", message, { retryAfterSeconds });
  }
}
```

- [ ] **Step 5: Implement `shared/money.ts`**

All arithmetic is `BigInt` over digit strings. `parseInt` on a 16-digit VND amount silently
corrupts values past `2^53`.

```ts
import { AppError } from "./errors";

const VND = /^\d+$/;

export function parseVnd(input: string | number): string {
  const raw = typeof input === "number" ? String(input) : input.trim();
  if (!VND.test(raw))
    throw AppError.badRequest(`Số tiền không hợp lệ: ${input}`);
  return BigInt(raw).toString();
}

export function formatVnd(amount: string): string {
  return `${BigInt(amount).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ".")} ₫`;
}

export function sumVnd(...amounts: string[]): string {
  return amounts
    .reduce((total, amount) => total + BigInt(parseVnd(amount)), 0n)
    .toString();
}
```

- [ ] **Step 6: Implement `shared/phone.ts`**

Vietnamese mobile numbers are `0` + 9 digits starting `3,5,7,8,9`; landlines are `0` + 9
digits starting `2`. Both normalise to a `84` prefix.

```ts
import { AppError } from "./errors";

const VN = /^(?:0|\+84|84)([235789]\d{8})$/;

export function normalisePhone(input: string): string {
  const digits = input.replace(/[\s.-]/g, "");
  const match = VN.exec(digits);
  if (!match) throw AppError.badRequest(`Số điện thoại không hợp lệ: ${input}`);
  return `84${match[1]}`;
}

export function formatPhone(input: string): string {
  const local = input.replace(/^84/, "0");
  return `${local.slice(0, 3)} ${local.slice(3, 6)} ${local.slice(6)}`;
}
```

- [ ] **Step 7: Run the tests to verify they pass**

Run: `cd backend && bun test src/test/money.test.ts src/test/phone.test.ts`
Expected: PASS, 12 tests

- [ ] **Step 8: Commit**

```bash
git add backend/package.json backend/tsconfig.json backend/bun.lock \
        backend/src/shared backend/src/test
git commit -m "feat(backend): error taxonomy, VND money utils, VN phone normalisation"
```

---

### Task 2: Environment parsing

Typed env that throws at import time. A missing secret must stop the process, not surface as
`undefined` in a JWT signature three hours later.

**Files:**
- Create: `backend/src/env.ts`
- Create: `backend/src/config.ts`
- Test: `backend/src/test/env.test.ts`

**Interfaces:**
- Consumes: `AppError` from Task 1
- Produces:
  - `env.ts`: `parseEnv(input: Record<string, string | undefined>): Env` and `type Env`.
    **No side effects** — this module must be importable from tests without a populated
    process environment.
  - `config.ts`: `env` — the validated singleton. Every other module imports `env` from
    `@/config`, never from `@/env`, so importing `@/env` in a test cannot throw.

- [ ] **Step 1: Write the failing test**

`backend/src/test/env.test.ts`:
```ts
import { describe, expect, test } from "bun:test";
import { parseEnv } from "@/env";

const valid = {
  DATABASE_URL: "postgres://u:p@localhost:5432/motel",
  MANAGER_JWT_SECRET: "a".repeat(48),
  RENTER_SESSION_SECRET: "b".repeat(48),
  R2_ACCOUNT_ID: "acct",
  R2_ACCESS_KEY_ID: "key",
  R2_SECRET_ACCESS_KEY: "secret",
  ZALO_OA_ID: "oa",
  ZALO_OA_SECRET: "oa-secret",
  ZALO_ACCESS_TOKEN: "token",
  ZALO_WEBHOOK_SECRET: "hook",
};

describe("parseEnv", () => {
  test("accepts a complete environment", () => {
    expect(parseEnv(valid).port).toBe(3000);
  });

  test("throws when DATABASE_URL is missing", () => {
    const { DATABASE_URL, ...rest } = valid;
    expect(() => parseEnv(rest)).toThrow(/DATABASE_URL/);
  });

  test("throws when a JWT secret is shorter than 32 characters", () => {
    expect(() =>
      parseEnv({ ...valid, MANAGER_JWT_SECRET: "too-short" }),
    ).toThrow(/MANAGER_JWT_SECRET/);
  });

  test("reads PORT as a number and defaults to 3000", () => {
    expect(parseEnv({ ...valid, PORT: "8080" }).port).toBe(8080);
    expect(parseEnv(valid).port).toBe(3000);
  });

  test("throws when PORT is not a number", () => {
    expect(() => parseEnv({ ...valid, PORT: "abc" })).toThrow(/PORT/);
  });

  test("exposes ZNS template ids and flags placeholders", () => {
    const env = parseEnv({ ...valid, ZNS_TEMPLATE_BILL: "PLACEHOLDER" });
    expect(env.zalo.templates.bill).toBe("PLACEHOLDER");
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd backend && bun test src/test/env.test.ts`
Expected: FAIL — `Cannot find module '@/env'`

- [ ] **Step 3: Implement `backend/src/env.ts` and `backend/src/config.ts`**

`parseEnv` is a pure function over its input; the singleton lives in `config.ts`. Splitting
them is what makes the test above possible — a module that validated `process.env` at import
time would throw in every test file that touches it.

`backend/src/env.ts`:
```ts
import { AppError } from "@/shared/errors";

type ZnsTemplateKey =
  | "welcome" | "bill" | "paymentConfirmed" | "contract" | "otp" | "expiry" | "ticket";

export interface Env {
  nodeEnv: string;
  port: number;
  databaseUrl: string;
  managerJwtSecret: string;
  renterSessionSecret: string;
  r2: {
    accountId: string;
    accessKeyId: string;
    secretAccessKey: string;
    bucket: string;
    publicUrl: string;
  };
  zalo: {
    oaId: string;
    oaSecret: string;
    accessToken: string;
    webhookSecret: string;
    templates: Record<ZnsTemplateKey, string>;
  };
}

const ZNS_KEYS: Record<ZnsTemplateKey, string> = {
  welcome: "ZNS_TEMPLATE_WELCOME",
  bill: "ZNS_TEMPLATE_BILL",
  paymentConfirmed: "ZNS_TEMPLATE_PAYMENT_CONFIRMED",
  contract: "ZNS_TEMPLATE_CONTRACT",
  otp: "ZNS_TEMPLATE_OTP",
  expiry: "ZNS_TEMPLATE_EXPIRY",
  ticket: "ZNS_TEMPLATE_TICKET",
};

function required(input: Record<string, string | undefined>, key: string): string {
  const value = input[key];
  if (!value) throw new AppError("VALIDATION_ERROR", `Thiếu biến môi trường: ${key}`);
  return value;
}

function secret(input: Record<string, string | undefined>, key: string): string {
  const value = required(input, key);
  if (value.length < 32)
    throw new AppError(
      "VALIDATION_ERROR",
      `${key} phải dài tối thiểu 32 ký tự`,
    );
  return value;
}

export function parseEnv(input: Record<string, string | undefined>): Env {
  const port = input.PORT ? Number(input.PORT) : 3000;
  if (!Number.isInteger(port) || port <= 0)
    throw new AppError("VALIDATION_ERROR", `PORT không hợp lệ: ${input.PORT}`);

  return {
    nodeEnv: input.NODE_ENV ?? "development",
    port,
    databaseUrl: required(input, "DATABASE_URL"),
    managerJwtSecret: secret(input, "MANAGER_JWT_SECRET"),
    renterSessionSecret: secret(input, "RENTER_SESSION_SECRET"),
    r2: {
      accountId: required(input, "R2_ACCOUNT_ID"),
      accessKeyId: required(input, "R2_ACCESS_KEY_ID"),
      secretAccessKey: required(input, "R2_SECRET_ACCESS_KEY"),
      bucket: input.R2_BUCKET ?? "motel-uploads",
      publicUrl: input.R2_PUBLIC_URL ?? "",
    },
    zalo: {
      oaId: required(input, "ZALO_OA_ID"),
      oaSecret: required(input, "ZALO_OA_SECRET"),
      accessToken: required(input, "ZALO_ACCESS_TOKEN"),
      webhookSecret: required(input, "ZALO_WEBHOOK_SECRET"),
      templates: Object.fromEntries(
        Object.entries(ZNS_KEYS).map(([key, varName]) => [
          key,
          input[varName] ?? "PLACEHOLDER",
        ]),
      ) as Record<ZnsTemplateKey, string>,
    },
  };
}
```

`backend/src/config.ts` — the only module that reads `process.env`:
```ts
import { parseEnv } from "@/env";

export const env = Object.freeze(
  parseEnv(process.env as Record<string, string | undefined>),
);
```

Run: `cd backend && bun run typecheck`
Expected: exit 0, no output

- [ ] **Step 6: Commit**

```bash
git add backend/src/env.ts backend/src/config.ts backend/src/test/env.test.ts
git commit -m "feat(backend): fail-fast typed environment parsing"
```

---

### Task 3: Drizzle schema and migrations

The full data model from the spec, one `*.schema.ts` per module. This task creates the
`*.schema.ts` files and the re-export barrel only — routes and services arrive in Tasks 4–7
and sub-projects 2–8.

**Files:**
- Create: `backend/drizzle.config.ts`
- Create: `backend/src/db/index.ts`
- Create: `backend/src/db/migrate.ts`
- Create: `backend/src/db/schemas.ts`
- Create: `backend/src/db/test-db.ts`
- Create: `backend/src/modules/{auth,motel,room,renter,billing,contract,ticket}/*.schema.ts`
- Test: `backend/src/test/schema-constraints.test.ts`

**Interfaces:**
- Consumes: `env.databaseUrl` from Task 2
- Produces:
  - `db/index.ts`: `db` — the Drizzle client; `dbType` — the `PostgresJsDatabase` type for tests
  - `db/schemas.ts`: re-exports every table
  - `db/test-db.ts`: `resetDb(): Promise<void>` — truncates all tables, used before each integration test
  - `modules/*/ *.schema.ts`: exported table objects — `managers`, `motels`, `rooms`, `renters`,
    `contractTemplates`, `contracts`, `billingPeriods`, `meterReadings`, `invoices`,
    `helpTickets`, `magicLinks`, `zaloNotifications`

- [ ] **Step 1: Write the failing constraint test**

`backend/src/test/schema-constraints.test.ts`:
```ts
import { beforeEach, describe, expect, test } from "bun:test";
import { db } from "@/db";
import { resetDb } from "@/db/test-db";
import { managers } from "@/modules/auth/auth.schema";
import { motels } from "@/modules/motel/motel.schema";
import { rooms } from "@/modules/room/room.schema";
import { renters } from "@/modules/renter/renter.schema";
import { billingPeriods, meterReadings } from "@/modules/billing/billing.schema";
import { contracts } from "@/modules/contract/contract.schema";

const managerId = "00000000-0000-4000-8000-000000000001";
const motelId = "00000000-0000-4000-8000-000000000002";
const roomId = "00000000-0000-4000-8000-000000000003";
const periodId = "00000000-0000-4000-8000-000000000004";

async function seed() {
  await db.insert(managers).values({
    id: managerId,
    email: "a@example.com",
    passwordHash: "x",
    name: "A",
  });
  await db.insert(motels).values({
    id: motelId,
    managerId,
    name: "M",
    electricityPrice: "3500",
    waterPrice: "25000",
  });
  await db.insert(rooms).values({ id: roomId, motelId, name: "P.101" });
  await db.insert(billingPeriods).values({ id: periodId, motelId, month: 10, year: 2026 });
}

beforeEach(resetDb);

describe("schema constraints", () => {
  test("room names are unique within a motel", async () => {
    await seed();
    await db.insert(rooms).values({ motelId, name: "P.102" });
    await expect(
      db.insert(rooms).values({ motelId, name: "P.102" }),
    ).rejects.toThrow();
  });

  test("a billing period is unique per motel, month, year", async () => {
    await seed();
    await expect(
      db.insert(billingPeriods).values({ motelId, month: 10, year: 2026 }),
    ).rejects.toThrow();
  });

  test("a meter cannot read lower than its previous reading", async () => {
    await seed();
    await expect(
      db.insert(meterReadings).values({
        roomId,
        billingPeriodId: periodId,
        type: "electric",
        previousReading: "100",
        currentReading: "99",
      }),
    ).rejects.toThrow();
  });

  test("a reading may still be null before the manager submits it", async () => {
    await seed();
    const row = await db
      .insert(meterReadings)
      .values({
        roomId,
        billingPeriodId: periodId,
        type: "water",
        previousReading: "0",
        currentReading: null,
      })
      .returning();
    expect(row[0]?.currentReading).toBeNull();
  });

  test("one active contract per room", async () => {
    await seed();
    const renter = await db
      .insert(renters)
      .values({ motelId, name: "R", phone: "84901234567", roomId })
      .returning();
    const values = {
      renterId: renter[0]!.id,
      roomId,
      motelId,
      startDate: "2026-01-01",
      endDate: "2026-12-31",
      monthlyRent: "3000000",
      status: "active" as const,
    };
    await db.insert(contracts).values(values);
    await expect(db.insert(contracts).values(values)).rejects.toThrow();
  });

  test("phone is unique per motel, not globally", async () => {
    await seed();
    await db.insert(renters).values({ motelId, name: "R1", phone: "84901234567" });
    const other = await db
      .insert(motels)
      .values({
        managerId,
        name: "M2",
        electricityPrice: "3500",
        waterPrice: "25000",
      })
      .returning();
    const row = await db
      .insert(renters)
      .values({ motelId: other[0]!.id, name: "R2", phone: "84901234567" })
      .returning();
    expect(row).toHaveLength(1);
  });

  test("contract end date must follow start date", async () => {
    await seed();
    await expect(
      db.insert(contracts).values({
        renterId: "00000000-0000-4000-8000-000000000009",
        roomId,
        motelId,
        startDate: "2026-12-31",
        endDate: "2026-01-01",
        monthlyRent: "3000000",
      }),
    ).rejects.toThrow();
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `cd backend && bun test src/test/schema-constraints.test.ts`
Expected: FAIL — `Cannot find module '@/db'`

- [ ] **Step 3: Add the local test database**

Add a `beforeEach` hook that creates a throwaway database, so a developer's real data is
never at risk. Append to `backend/src/test/helpers.ts` (create it):
```ts
import { beforeEach } from "bun:test";
import postgres from "postgres";
import { env } from "@/config";

const adminUrl = env.databaseUrl.replace(/\/[^/?]+(\?|$)/, "/postgres$1");

beforeEach(async () => {
  const sql = postgres(adminUrl, { max: 1 });
  await sql.unsafe("DROP SCHEMA public CASCADE; CREATE SCHEMA public;");
  await sql.end();
});
```
Add to `.env.example`, under Database:
```
# Throwaway database the test suite drops and recreates before each test.
TEST_DATABASE_URL=postgres://postgres:postgres@localhost:5432/motel_test
```

`resetDb()` in `db/test-db.ts` truncates every table in one statement rather than issuing a
`DELETE` per table:
```ts
import { sql } from "drizzle-orm";
import { db } from "@/db";

const TABLES = [
  "zalo_notifications", "magic_links", "help_tickets", "invoices",
  "meter_readings", "billing_periods", "contracts", "contract_templates",
  "renters", "rooms", "motels", "managers",
];

export async function resetDb() {
  await db.execute(
    sql.raw(`TRUNCATE ${TABLES.join(", ")} RESTART IDENTITY CASCADE`),
  );
}
```

- [ ] **Step 4: Create the module schema files**

One file per module, each owning only its own tables. `backend/src/modules/auth/auth.schema.ts`:
```ts
import { pgTable, text, timestamp, index } from "drizzle-orm/pg-core";

export const managers = pgTable(
  "managers",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    email: text("email").notNull().unique(),
    passwordHash: text("password_hash").notNull(),
    name: text("name").notNull(),
    phone: text("phone"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("managers_email_idx").on(t.email)],
);
```
Import `uuid` alongside `pgTable` — the snippet above omits that import line; add
`uuid` to the existing `drizzle-orm/pg-core` import.

Follow the same shape for the remaining tables, using the exact columns and constraints in
the spec's Data Model section. Conventions that apply everywhere:

- IDs: `uuid("id").primaryKey().defaultRandom()`
- Timestamps: `timestamp("...", { withTimezone: true }).notNull().defaultNow()`
- Money: `numeric("...", { precision: 14, scale: 0 })`
- Meter values: `numeric("...", { precision: 12, scale: 2 })`
- Enums: `pgEnum("room_status", ["available", "occupied", "maintenance"])`, declared in the
  module that owns the table
- JSONB: `jsonb("other_fees").$type<{ name: string; amount: string }[]>().notNull().default([])`
- Partial unique for one active contract per room:
  `uniqueIndex("contracts_room_active_uq").on(t.roomId).where(sql\`${t.status} = 'active'\`)`

- [ ] **Step 5: Create `db/schemas.ts` as a re-export barrel only**

```ts
export * from "@/modules/auth/auth.schema";
export * from "@/modules/motel/motel.schema";
export * from "@/modules/room/room.schema";
export * from "@/modules/renter/renter.schema";
export * from "@/modules/billing/billing.schema";
export * from "@/modules/contract/contract.schema";
export * from "@/modules/ticket/ticket.schema";
```
No logic here. If something needs computing, it belongs in a module.

- [ ] **Step 6: Create `db/index.ts` and `drizzle.config.ts`**

`backend/src/db/index.ts`:
```ts
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { env } from "@/config";
import * as schemas from "./schemas";

const client = postgres(env.databaseUrl, { max: 10 });

export const db = drizzle(client, { schema: schemas });
export type Db = typeof db;
```

`backend/drizzle.config.ts`:
```ts
import { defineConfig } from "drizzle-kit";

if (!process.env.DATABASE_URL)
  throw new Error("DATABASE_URL is required for drizzle-kit");

export default defineConfig({
  schema: "./src/db/schemas.ts",
  out: "./drizzle",
  dialect: "postgresql",
  dbCredentials: { url: process.env.DATABASE_URL },
});
```

- [ ] **Step 7: Generate and run migrations**

Run: `cd backend && bun run db:generate`
Expected: SQL files under `backend/drizzle/`

Run: `cd backend && bun run db:migrate` with `src/db/migrate.ts` running the generated
migrations against `DATABASE_URL`:
```ts
import { migrate } from "drizzle-orm/postgres-js/migrator";
import postgres from "postgres";
import { env } from "@/config";
import { db } from "./index";

const client = postgres(env.databaseUrl, { max: 1 });
await migrate(db, { migrationsFolder: "./drizzle" });
await client.end();
```
Expected: `Successfully applied X migrations`

- [ ] **Step 8: Run the constraint test to verify it passes**

Run: `cd backend && bun test src/test/schema-constraints.test.ts`
Expected: PASS, 7 tests — every constraint is enforced by PostgreSQL, not just by the API

- [ ] **Step 9: Commit**

```bash
git add backend/drizzle backend/drizzle.config.ts backend/src/db \
        backend/src/modules backend/src/test backend/.env.example
git commit -m "feat(backend): full Drizzle schema with database-enforced constraints"
```

---

### Task 4: App assembly and error handling

The server boots, mounts a health check, and turns any thrown error into the spec's
envelope. Everything after this is additive.

**Files:**
- Create: `backend/src/middleware/error-handler.ts`
- Create: `backend/src/app.ts`
- Modify: `backend/src/index.ts`
- Test: `backend/src/test/error-envelope.test.ts`

**Interfaces:**
- Consumes: `AppError` from Task 1, `db` from Task 3
- Produces: `app` — the configured Elysia instance with `GET /health` and an `onError`
  handler. `index.ts` only calls `app.listen()`.

- [ ] **Step 1: Write the failing test**

`backend/src/test/error-envelope.test.ts`:
```ts
import { describe, expect, test } from "bun:test";
import { app } from "@/app";
import { AppError } from "@/shared/errors";

const client = app.handle(new Request("http://localhost/health"));

describe("error envelope", () => {
  test("health check responds without a database round trip", async () => {
    const res = await client;
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ status: "ok" });
  });

  test("unknown routes return the standard envelope", async () => {
    const res = await app.handle(new Request("http://localhost/api/nope"));
    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({
      error: expect.any(String),
      code: "NOT_FOUND",
    });
  });

  test("AppError carries its code, status, and details", () => {
    const err = new AppError("READING_CONFLICT", "Xung đột", { server: { id: 1 } });
    expect(err.status).toBe(409);
    expect(err.details).toEqual({ server: { id: 1 } });
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `cd backend && bun test src/test/error-envelope.test.ts`
Expected: FAIL — `Cannot find module '@/app'`

- [ ] **Step 3: Implement the error handler**

`backend/src/middleware/error-handler.ts` exports a function Elysia's `onError` accepts.
`details` is omitted when empty so the envelope stays small; an unexpected error is logged
in full but reported to the client as a generic message, so internals never leak.

```ts
import { Elysia } from "elysia";
import { AppError } from "@/shared/errors";

export const errorHandler = ({ error, set }: {
  error: unknown;
  set: { status: number; headers: Record<string, string> };
}) => {
  if (error instanceof AppError) {
    set.status = error.status;
    return error.details
      ? { error: error.message, code: error.code, details: error.details }
      : { error: error.message, code: error.code };
  }

  console.error("Unhandled error:", error);
  set.status = 500;
  return {
    error: "Đã xảy ra lỗi hệ thống",
    code: "INTERNAL_ERROR",
  };
};
```

Add `"INTERNAL_ERROR"` to the `ErrorCode` union in `shared/errors.ts` with status 500, so
the code union covers every response the API can emit.

- [ ] **Step 4: Assemble the app**

`backend/src/app.ts`:
```ts
import { Elysia } from "elysia";
import { cors } from "@elysiajs/cors";
import { env } from "@/config";
import { errorHandler } from "@/middleware/error-handler";

export const app = new Elysia()
  .onError(errorHandler)
  .use(cors({ origin: env.nodeEnv === "production" ? false : true, credentials: true }))
  .get("/health", () => ({ status: "ok" as const }))
  .group("/api", (api) => api);
```

`backend/src/index.ts` — replace the placeholder entirely:
```ts
import { app } from "@/app";
import { env } from "@/config";

app.listen(env.port);

console.log(`🦊 Motel backend listening on http://localhost:${env.port}`);
```

- [ ] **Step 5: Run the test to verify it passes**

Run: `cd backend && bun test src/test/error-envelope.test.ts`
Expected: PASS, 3 tests

- [ ] **Step 6: Verify the server actually boots**

Run: `cd backend && bun run dev`
Expected: `Motel backend listening on http://localhost:3000`

Run: `curl -s localhost:3000/health`
Expected: `{"status":"ok"}`

Stop the dev server.

- [ ] **Step 7: Commit**

```bash
git add backend/src/app.ts backend/src/index.ts backend/src/middleware backend/src/shared
git commit -m "feat(backend): app assembly and error envelope"
```

---

### Task 5: Manager auth and tenant isolation

Manager register/login/logout, and the tenant boundary that every other module inherits.
The tenancy helper is exported because sub-projects 2–8 all use it.

**Files:**
- Create: `backend/src/modules/auth/auth.service.ts`
- Create: `backend/src/modules/auth/auth.route.ts`
- Create: `backend/src/modules/auth/auth.types.ts`
- Create: `backend/src/middleware/manager-auth.ts`
- Create: `backend/src/middleware/tenancy.ts`
- Modify: `backend/src/app.ts`
- Test: `backend/src/test/manager-auth.test.ts`, `backend/src/test/tenancy.test.ts`

**Interfaces:**
- Consumes: `db`, `managers`, `motels` (Task 3), `AppError` (Task 1), `env` (Task 2)
- Produces:
  - `auth.service.ts`: `registerManager(input: {email, password, name, phone?}): Promise<ManagerRow>`, `verifyManager(email, password): Promise<ManagerRow>`
  - `tenancy.ts`: `resolveOwnedMotel(motelId: string, managerId: string): Promise<MotelRow>` — throws `AppError.notFound` when the motel does not exist **or** belongs to someone else
  - `manager-auth.ts`: Elysia plugin providing `auth` — `{ userId: string; email: string }` — or `401`
  - `auth.route.ts`: `POST /api/auth/register`, `POST /api/auth/login`, `POST /api/auth/logout`, `GET /api/auth/me`

- [ ] **Step 1: Write the failing manager auth test**

`backend/src/test/manager-auth.test.ts`:
```ts
import { beforeEach, describe, expect, test } from "bun:test";
import { app } from "@/app";
import { registerManager, verifyManager } from "@/modules/auth/auth.service";
import { resetDb } from "@/db/test-db";

beforeEach(resetDb);

const valid = { email: "a@example.com", password: "correct horse battery", name: "A" };

describe("manager auth", () => {
  test("register stores a hash, not the password", async () => {
    const row = await registerManager(valid);
    expect(row.passwordHash).not.toContain(valid.password);
    expect(row.email).toBe("a@example.com");
  });

  test("register lowercases the email", async () => {
    const row = await registerManager({ ...valid, email: "MiXeD@Example.COM" });
    expect(row.email).toBe("mixed@example.com");
  });

  test("register rejects a duplicate email with CONFLICT", async () => {
    await registerManager(valid);
    await expect(registerManager(valid)).rejects.toMatchObject({ code: "CONFLICT" });
  });

  test("register rejects a password under 8 characters", async () => {
    await expect(registerManager({ ...valid, password: "short" })).rejects.toMatchObject({
      code: "VALIDATION_ERROR",
    });
  });

  test("verify accepts the right password", async () => {
    await registerManager(valid);
    expect((await verifyManager(valid.email, valid.password)).id).toBeDefined();
  });

  test("verify rejects a wrong password with UNAUTHORIZED", async () => {
    await registerManager(valid);
    await expect(verifyManager(valid.email, "wrong password")).rejects.toMatchObject({
      code: "UNAUTHORIZED",
    });
  });

  test("login rejects an unknown email the same way", async () => {
    await expect(verifyManager("nobody@example.com", "whatever")).rejects.toMatchObject({
      code: "UNAUTHORIZED",
    });
  });
});
```

- [ ] **Step 2: Write the failing tenancy test**

`backend/src/test/tenancy.test.ts`:
```ts
import { beforeEach, describe, expect, test } from "bun:test";
import { db } from "@/db";
import { resetDb } from "@/db/test-db";
import { motels } from "@/modules/motel/motel.schema";
import { registerManager } from "@/modules/auth/auth.service";
import { resolveOwnedMotel } from "@/middleware/tenancy";

beforeEach(resetDb);

async function seedTwoManagers() {
  const a = await registerManager({ email: "a@example.com", password: "aaaaaaaaaa", name: "A" });
  const b = await registerManager({ email: "b@example.com", password: "bbbbbbbbbb", name: "B" });
  const owned = await db.insert(motels).values({
    managerId: a.id, name: "Owned", electricityPrice: "3500", waterPrice: "25000",
  }).returning();
  const foreign = await db.insert(motels).values({
    managerId: b.id, name: "Foreign", electricityPrice: "3500", waterPrice: "25000",
  }).returning();
  return { a, owned: owned[0]!, foreign: foreign[0]! };
}

describe("tenant isolation", () => {
  test("a manager resolves their own motel", async () => {
    const { a, owned } = await seedTwoManagers();
    expect((await resolveOwnedMotel(owned.id, a.id)).id).toBe(owned.id);
  });

  test("another manager's motel is 404, never 403", async () => {
    const { a, foreign } = await seedTwoManagers();
    // 404 not 403: a 403 would confirm the motel exists.
    await expect(resolveOwnedMotel(foreign.id, a.id)).rejects.toMatchObject({
      code: "NOT_FOUND",
      status: 404,
    });
  });

  test("a motel that does not exist is also 404", async () => {
    const { a } = await seedTwoManagers();
    await expect(
      resolveOwnedMotel("00000000-0000-4000-8000-00000000dead", a.id),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
  });
});
```

- [ ] **Step 3: Run both to verify they fail**

Run: `cd backend && bun test src/test/manager-auth.test.ts src/test/tenancy.test.ts`
Expected: FAIL — `Cannot find module '@/modules/auth/auth.service'`

- [ ] **Step 4: Implement the auth service**

`backend/src/modules/auth/auth.service.ts`:
```ts
import { hash, verify } from "argon2";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { managers } from "./auth.schema";
import { AppError } from "@/shared/errors";

export type ManagerRow = typeof managers.$inferSelect;

export async function registerManager(input: {
  email: string;
  password: string;
  name: string;
  phone?: string;
}): Promise<ManagerRow> {
  if (input.password.length < 8)
    throw AppError.badRequest("Mật khẩu phải có ít nhất 8 ký tự");

  const email = input.email.trim().toLowerCase();
  const existing = await db.query.managers.findFirst({ where: eq(managers.email, email) });
  if (existing) throw AppError.conflict("Email đã được sử dụng");

  const [row] = await db
    .insert(managers)
    .values({ email, name: input.name, phone: input.phone, passwordHash: await hash(input.password) })
    .returning();
  return row!;
}

export async function verifyManager(email: string, password: string): Promise<ManagerRow> {
  const row = await db.query.managers.findFirst({
    where: eq(managers.email, email.trim().toLowerCase()),
  });
  // Same error for unknown email and wrong password: differing messages
  // confirm which addresses are registered.
  if (!row || !(await verify(row.passwordHash, password)))
    throw AppError.unauthorized("Email hoặc mật khẩu không đúng");
  return row;
}
```

- [ ] **Step 5: Implement tenancy**

`backend/src/middleware/tenancy.ts`:
```ts
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { motels } from "@/modules/motel/motel.schema";
import { AppError } from "@/shared/errors";

export async function resolveOwnedMotel(motelId: string, managerId: string) {
  const row = await db.query.motels.findFirst({
    where: and(eq(motels.id, motelId), eq(motels.managerId, managerId)),
  });
  if (!row) throw AppError.notFound("Không tìm thấy nhà trọ");
  return row;
}
```

- [ ] **Step 6: Implement the auth plugin and routes**

`backend/src/middleware/manager-auth.ts` — a scoped JWT whose payload is
`{ userId, email }`, distinct from the renter session secret:
```ts
import { jwt } from "@elysiajs/jwt";
import { Elysia } from "elysia";
import { env } from "@/config";
import { AppError } from "@/shared/errors";

export const managerAuth = new Elysia({ name: "manager-auth" })
  .use(jwt({ name: "manager", secret: env.managerJwtSecret, ttl: "7d" }))
  .resolve({ as: "scoped" })
  .onBeforeHandle({ as: "scoped" }, async ({ jwt, cookie: { manager_session }, status }) => {
    const token = manager_session ?? (await jwt.getAuthorizationHeader()).replace(/^Bearer /, "");
    if (!token) return status(401, { error: "Chưa đăng nhập", code: "UNAUTHORIZED" });
    const payload = await jwt.verify(token);
    if (!payload) return status(401, { error: "Phiên đã hết hạn", code: "UNAUTHORIZED" });
    return { auth: { userId: payload.userId as string, email: payload.email as string } };
  });
```

`backend/src/modules/auth/auth.route.ts` — register, login, logout, me. Login and register set
`manager_session` httpOnly, `Secure` outside development, `SameSite=Lax`, 7-day max-age.
`me` requires the plugin and returns the row without `passwordHash`.

- [ ] **Step 7: Mount and run both tests**

Append to `app.ts`:
```ts
import { managerAuth } from "@/middleware/manager-auth";
import { authRoutes } from "@/modules/auth/auth.route";

export const app = new Elysia()
  .onError(errorHandler)
  .use(cors({ origin: env.nodeEnv === "production" ? false : true, credentials: true }))
  .use(managerAuth)
  .get("/health", () => ({ status: "ok" as const }))
  .group("/api", (api) => api.use(authRoutes));
```

Run: `cd backend && bun test src/test/manager-auth.test.ts src/test/tenancy.test.ts`
Expected: PASS, 10 tests

- [ ] **Step 8: Commit**

```bash
git add backend/src/modules/auth backend/src/middleware backend/src/app.ts backend/src/test
git commit -m "feat(backend): manager auth with argon2 and 404 tenant isolation"
```

---

### Task 6: Renter sessions and single-use magic links

The renter portal's entire auth story, including the replay guard.

**Files:**
- Create: `backend/src/modules/renter/renter.service.ts`
- Create: `backend/src/shared/magic-link.ts`
- Create: `backend/src/middleware/renter-auth.ts`
- Create: `backend/src/modules/auth/magic-link.route.ts`
- Modify: `backend/src/app.ts`
- Test: `backend/src/test/renter-auth.test.ts`

**Interfaces:**
- Consumes: `db`, `renters`, `magicLinks` (Task 3), `AppError` (Task 1)
- Produces:
  - `shared/magic-link.ts`: `issueMagicLink(renterId: string): Promise<{token, expiresAt, url}>`,
    `consumeMagicLink(token: string): Promise<RenterRow>` — throws
    `AppError("MAGIC_LINK_EXPIRED")` when unknown, expired, or already consumed
  - `renter-auth.ts`: Elysia plugin resolving `{ renterId, motelId }` from the
    `renter_session` cookie
  - `magic-link.route.ts`: `POST /api/renter/magic-links/exchange` (public, body `{token}`),
    `POST /api/renter/magic-links/resend` (renter-scoped)
  - `POST /api/manager/motels/:motelId/renters/:renterId/magic-link` is **sub-project 2** —
    only the exchange and consume path lands here

- [ ] **Step 1: Write the failing test**

`backend/src/test/renter-auth.test.ts`:
```ts
import { beforeEach, describe, expect, test } from "bun:test";
import { sql } from "drizzle-orm";
import { db } from "@/db";
import { resetDb } from "@/db/test-db";
import { motels } from "@/modules/motel/motel.schema";
import { renters } from "@/modules/renter/renter.schema";
import { registerManager } from "@/modules/auth/auth.service";
import { consumeMagicLink, issueMagicLink } from "@/shared/magic-link";
import { app } from "@/app";

beforeEach(resetDb);

async function seedRenter() {
  const manager = await registerManager({
    email: "a@example.com", password: "aaaaaaaaaa", name: "A",
  });
  const motel = await db.insert(motels).values({
    managerId: manager.id, name: "M", electricityPrice: "3500", waterPrice: "25000",
  }).returning();
  const renter = await db.insert(renters).values({
    motelId: motel[0]!.id, name: "R", phone: "84901234567",
  }).returning();
  return renter[0]!;
}

describe("magic links", () => {
  test("an issued link resolves to its renter", async () => {
    const renter = await seedRenter();
    const { token } = await issueMagicLink(renter.id);
    expect((await consumeMagicLink(token)).id).toBe(renter.id);
  });

  test("a consumed link cannot be replayed", async () => {
    const renter = await seedRenter();
    const { token } = await issueMagicLink(renter.id);
    await consumeMagicLink(token);
    // Replay must fail: a leaked link must not be reusable.
    await expect(consumeMagicLink(token)).rejects.toMatchObject({
      code: "MAGIC_LINK_EXPIRED",
    });
  });

  test("an unknown token is rejected with the same code as an expired one", async () => {
    await seedRenter();
    await expect(consumeMagicLink("nope")).rejects.toMatchObject({
      code: "MAGIC_LINK_EXPIRED",
    });
  });

  test("an expired link is rejected", async () => {
    const renter = await seedRenter();
    const { token } = await issueMagicLink(renter.id);
    await db.execute(
      sql`UPDATE magic_links SET expires_at = now() - interval '1 hour' WHERE token = ${token}`,
    );
    await expect(consumeMagicLink(token)).rejects.toMatchObject({
      code: "MAGIC_LINK_EXPIRED",
    });
  });

  test("issuing a second link does not invalidate the first", async () => {
    const renter = await seedRenter();
    const first = await issueMagicLink(renter.id);
    await issueMagicLink(renter.id);
    // Re-issuing must not silently break a link already sitting in a Zalo message.
    expect((await consumeMagicLink(first.token)).id).toBe(renter.id);
  });

  test("exchange returns a session cookie", async () => {
    const renter = await seedRenter();
    const { token } = await issueMagicLink(renter.id);
    const res = await app.handle(
      new Request("http://localhost/api/renter/magic-links/exchange", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ token }),
      }),
    );
    expect(res.status).toBe(200);
    expect(res.headers.get("set-cookie")).toContain("renter_session=");
  });

  test("exchange rejects a replayed token at the route too", async () => {
    const renter = await seedRenter();
    const { token } = await issueMagicLink(renter.id);
    const body = JSON.stringify({ token });
    const headers = { "content-type": "application/json" };
    await app.handle(new Request("http://localhost/api/renter/magic-links/exchange",
      { method: "POST", headers, body }));
    const second = await app.handle(new Request("http://localhost/api/renter/magic-links/exchange",
      { method: "POST", headers, body }));
    expect(second.status).toBe(401);
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `cd backend && bun test src/test/renter-auth.test.ts`
Expected: FAIL — `Cannot find module '@/shared/magic-link'`

- [ ] **Step 3: Implement token generation and consumption**

`backend/src/shared/magic-link.ts`:
```ts
import { randomBytes } from "node:crypto";
import { and, eq, gt, isNull } from "drizzle-orm";
import { db } from "@/db";
import { magicLinks, renters } from "@/modules/renter/renter.schema";
import { AppError } from "@/shared/errors";
import { env } from "@/config";

const TTL_MS = 24 * 60 * 60 * 1000;

export async function issueMagicLink(renterId: string) {
  const token = randomBytes(32).toString("base62");
  const expiresAt = new Date(Date.now() + TTL_MS);
  await db.insert(magicLinks).values({ renterId, token, expiresAt });
  return { token, expiresAt, url: `/r/${token}` };
}

export async function consumeMagicLink(token: string) {
  const row = await db.query.magicLinks.findFirst({
    where: and(
      eq(magicLinks.token, token),
      isNull(magicLinks.consumedAt),
      gt(magicLinks.expiresAt, new Date()),
    ),
    with: { renter: true },
  });
  if (!row) throw new AppError("MAGIC_LINK_EXPIRED", "Liên kết đã hết hạn");
  await db.update(magicLinks)
    .set({ consumedAt: new Date() })
    .where(eq(magicLinks.id, row.id));
  return row.renter;
}
```

The `with: { renter: true }` relation needs Drizzle relations declared in the renter
schema file — add `relations` definitions for `renters` ↔ `magicLinks` and
`motels` ↔ `rooms`, `rooms` ↔ `renters`, `motels` ↔ `contracts`,
`contracts` ↔ `renter`/`room`/`template`, `billingPeriods` ↔ `invoices`,
`invoices` ↔ `renter`/`room`/`period`, `helpTickets` ↔ `renter`/`room`.

- [ ] **Step 4: Implement the renter session plugin and exchange route**

`backend/src/middleware/renter-auth.ts` uses a **separate JWT plugin name and secret** from
the manager session, so a renter token can never be replayed as a manager token:
```ts
import { jwt } from "@elysiajs/jwt";
import { Elysia } from "elysia";
import { env } from "@/config";

export const renterAuth = new Elysia({ name: "renter-auth" })
  .use(jwt({ name: "renter", secret: env.renterSessionSecret, ttl: "24h" }))
  .resolve({ as: "scoped" })
  .onBeforeHandle({ as: "scoped" }, async ({ jwt, cookie: { renter_session }, status }) => {
    if (!renter_session) return status(401, { error: "Chưa đăng nhập", code: "UNAUTHORIZED" });
    const payload = await jwt.verify(renter_session);
    if (!payload) return status(401, { error: "Phiên đã hết hạn", code: "UNAUTHORIZED" });
    return { renter: { renterId: payload.sub as string, motelId: payload.motelId as string } };
  });
```

`magic-link.route.ts` — `POST /exchange` is public, validates the token, sets
`renter_session` httpOnly + `SameSite=Lax` with a 24-hour max-age, and returns the renter
without internal columns. `POST /resend` is renter-scoped, records the request, and returns
`202` — it never returns a token, because the renter has no way to receive one without the
manager sending it.

- [ ] **Step 5: Mount and run the test**

Append to `app.ts`:
```ts
import { renterAuth } from "@/middleware/renter-auth";
import { magicLinkRoutes } from "@/modules/auth/magic-link.route";

.group("/api", (api) => api.use(authRoutes).use(magicLinkRoutes).use(renterAuth));
```

Run: `cd backend && bun test src/test/renter-auth.test.ts`
Expected: PASS, 7 tests

- [ ] **Step 6: Run the whole suite**

Run: `cd backend && bun test`
Expected: all suites pass, no cross-test interference

- [ ] **Step 7: Commit**

```bash
git add backend/src/modules backend/src/shared backend/src/middleware backend/src/app.ts backend/src/test
git commit -m "feat(backend): renter sessions with single-use magic links"
```

---

### Task 7: Docs reconciliation and full verification

The docs are the project's memory. This task proves they still match the code that now
exists, then runs everything.

**Files:**
- Modify: `docs/api-contract.md` — align any response shape that changed during Tasks 4–6
- Modify: `backend/.env.example` — add `TEST_DATABASE_URL` if Step 3 of Task 3 did not
- Create: `backend/src/test/isolation.test.ts`

**Interfaces:**
- Consumes: everything above
- Produces: no new product surface. This task only removes drift.

- [ ] **Step 1: Write the isolation regression test**

`backend/src/test/isolation.test.ts` — the two cases most likely to leak data, both
asserted at the HTTP boundary rather than the service boundary:
```ts
import { beforeEach, describe, expect, test } from "bun:test";
import { db } from "@/db";
import { resetDb } from "@/db/test-db";
import { motels } from "@/modules/motel/motel.schema";
import { renters } from "@/modules/renter/renter.schema";
import { registerManager } from "@/modules/auth/auth.service";
import { issueMagicLink } from "@/shared/magic-link";
import { app } from "@/app";

beforeEach(resetDb);

describe("cross-tenant isolation over HTTP", () => {
  test("manager B cannot read manager A's motel", async () => {
    const a = await registerManager({ email: "a@example.com", password: "aaaaaaaaaa", name: "A" });
    const b = await registerManager({ email: "b@example.com", password: "bbbbbbbbbb", name: "B" });
    const motelA = await db.insert(motels).values({
      managerId: a.id, name: "A's", electricityPrice: "3500", waterPrice: "25000",
    }).returning();

    const login = await app.handle(new Request("http://localhost/api/auth/login", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email: "b@example.com", password: "bbbbbbbbbb" }),
    }));
    const cookie = login.headers.get("set-cookie")!.split(";")[0]!;

    const res = await app.handle(
      new Request(`http://localhost/api/manager/motels/${motelA[0]!.id}`, {
        headers: { cookie },
      }),
    );
    // 404, not 403 — a 403 would confirm the motel exists.
    expect(res.status).toBe(404);
  });

  test("renter B cannot read renter A's invoice", async () => {
    // Seed two renters in the same motel; assert the renter-scoped query
    // filters by session renterId, not by anything the client sends.
    const manager = await registerManager({
      email: "a@example.com", password: "aaaaaaaaaa", name: "A",
    });
    const motel = await db.insert(motels).values({
      managerId: manager.id, name: "M", electricityPrice: "3500", waterPrice: "25000",
    }).returning();
    const [renterA, renterB] = await db.insert(renters).values([
      { motelId: motel[0]!.id, name: "A", phone: "84901234567" },
      { motelId: motel[0]!.id, name: "B", phone: "84901234568" },
    ]).returning();

    const { token } = await issueMagicLink(renterB!.id);
    const exchange = await app.handle(
      new Request("http://localhost/api/renter/magic-links/exchange", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ token }),
      }),
    );
    const cookie = exchange.headers.get("set-cookie")!.split(";")[0]!;

    // Asking for renter A's data while holding renter B's session returns
    // nothing, because the renter id comes from the session only.
    const res = await app.handle(
      new Request(`http://localhost/api/renter/invoices?renterId=${renterA!.id}`, {
        headers: { cookie },
      }),
    );
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ items: [], total: 0, page: 1, pageSize: 50 });
  });
});
```

The renter invoice list endpoint returns an empty list rather than a `403` when the session
is valid — the renter asked for their own list and got it; a query parameter cannot widen
it.

- [ ] **Step 2: Run it — the second test will fail until the endpoint exists**

Run: `cd backend && bun test src/test/isolation.test.ts`
Expected: the manager test passes, the renter test fails with `404` because
`GET /api/renter/invoices` is sub-project 7.

If it fails for that reason, add the minimal scoped list endpoint now — it is ten lines and
proves the tenancy rule at the HTTP boundary:
```ts
.get("/invoices", ({ renter }) => ({
  items: [], total: 0, page: 1, pageSize: 50,
}), { as: "scoped" })
```
Sub-project 7 replaces the body; the scoping — `renter.renterId` from the session — is the
part that must never change.

- [ ] **Step 3: Reconcile the docs with what was actually built**

Read `docs/api-contract.md` and check against the running app:

```bash
cd backend && bun run dev
curl -s localhost:3000/health
curl -s -X POST localhost:3000/api/auth/register \
  -H 'content-type: application/json' \
  -d '{"email":"a@example.com","password":"correct horse","name":"A"}'
curl -s localhost:3000/api/nope
```

Fix any drift inline. Concretely, verify: `/health` returns `{"status":"ok"}`; an unknown
route returns the envelope with `code: "NOT_FOUND"`; register returns `201` and sets
`manager_session`; `INTERNAL_ERROR` is documented or removed. If the shape of any documented
response changed, correct `docs/api-contract.md` in this task — do not leave it for later.

- [ ] **Step 4: Run the full verification set**

Run: `cd backend && bun test`
Expected: every suite passes

Run: `cd backend && bun run typecheck`
Expected: exit 0, no output

Run: `cd frontend && bun run lint && bun run build`
Expected: both succeed

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "docs: reconcile API contract with implemented auth surface"
```

---

## Definition of Done

- `bun test` passes in `backend/`, including the two cross-tenant isolation tests
- `bun run typecheck` is clean under `strict` with `noUncheckedIndexedAccess`
- `bun run dev` boots and `/health` responds
- Every constraint in the spec's Data Model is enforced by PostgreSQL and has a test
- `docs/api-contract.md` matches the responses the server actually returns
- No endpoint derives tenant scope from anything a client can set
- `/review-security` and `/review-code` have been run and their Critical and High findings
  are resolved or explicitly accepted
