import { describe, expect, test } from "vitest";
import { createRenterDraft, prepareRenterInput } from "./renter-form";

describe("renter Zalo destination", () => {
  test("requires manager confirmation and normalizes a different destination", () => {
    const draft = {
      ...createRenterDraft(),
      name: "A",
      phone: "0901234567",
      zaloPhone: "0912345678",
      zaloPhoneConfirmed: true,
    };
    expect(prepareRenterInput(draft)).toMatchObject({
      ok: true,
      input: { phone: "84901234567", zaloPhone: "84912345678" },
    });
    expect(prepareRenterInput({ ...draft, zaloPhoneConfirmed: false })).toMatchObject({
      ok: false,
      fields: { zaloPhone: expect.any(String) },
    });
    expect(
      prepareRenterInput({
        ...createRenterDraft(),
        name: "A",
        phone: "0901234567",
        zaloPhoneConfirmed: true,
      }),
    ).toMatchObject({ ok: false, fields: { zaloPhone: expect.any(String) } });
  });

  test("leaves destination unset by default rather than copying contact phone", () => {
    const result = prepareRenterInput({ ...createRenterDraft(), name: "A", phone: "0901234567" });
    expect(result).toMatchObject({ ok: true, input: { phone: "84901234567", zaloPhone: null } });
  });
});
