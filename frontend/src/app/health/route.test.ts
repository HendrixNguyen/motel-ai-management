import { describe, expect, it } from "vitest";
import { GET } from "./route";

describe("frontend health endpoint", () => {
  it("answers independently of backend state", async () => {
    const response = GET();

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ status: "ok" });
  });
});
