import { describe, expect, test } from "bun:test";
import { createHash } from "node:crypto";

describe("magic link token hashing", () => {
  test("SHA-256 produces a fixed-width hex digest", () => {
    const token = "opaque-token";
    const digest = createHash("sha256").update(token).digest("hex");
    expect(digest).toBe("84d3f23da9b5f51b3269566eff05d3fb23607eeef89567f9cd280b90ca0dbc5c");
    expect(digest).not.toBe(token);
  });
});
