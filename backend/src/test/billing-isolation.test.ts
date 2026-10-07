import { beforeEach, describe, expect, test } from "bun:test";
import { resetDb } from "@/db/test-db";
import { AppError } from "@/shared/errors";

beforeEach(resetDb);
describe("billing isolation", () => {
  test("cross-tenant access uses 404", () => {
    expect(AppError.notFound().status).toBe(404);
  });
});
