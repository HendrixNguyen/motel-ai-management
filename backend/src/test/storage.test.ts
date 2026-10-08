import { describe, expect, test } from "bun:test";
import { FakeStorageAdapter, StorageError, validateStorageInput } from "@/shared/storage";

describe("storage validation", () => {
  test("accepts JPEG, PNG, and PDF magic bytes", async () => {
    for (const [contentType, bytes] of [
      ["image/jpeg", new Uint8Array([0xff, 0xd8, 0xff, 0xe0])],
      ["image/png", new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])],
      ["application/pdf", new TextEncoder().encode("%PDF-1.7")],
    ] as const) {
      await expect(validateStorageInput({ objectKey: "motel/one/file", body: bytes, contentType })).resolves.toBeInstanceOf(Uint8Array);
    }
  });

  test("rejects mismatched MIME, unsafe keys, and oversized content", async () => {
    await expect(validateStorageInput({ objectKey: "../secret", body: new Uint8Array([1]), contentType: "image/png" })).rejects.toBeInstanceOf(StorageError);
    await expect(validateStorageInput({ objectKey: "motel/one/file", body: new Uint8Array([0xff, 0xd8, 0xff]), contentType: "image/png" })).rejects.toThrow("không khớp");
    await expect(validateStorageInput({ objectKey: "motel/one/file", body: new Uint8Array(10 * 1024 * 1024 + 1), contentType: "image/jpeg" })).rejects.toThrow("10 MB");
  });
});

describe("FakeStorageAdapter", () => {
  test("stores metadata, signs downloads with TTL, and deletes objects", async () => {
    const storage = new FakeStorageAdapter();
    const result = await storage.put({ objectKey: "motel/one/file", body: new Uint8Array([0xff, 0xd8, 0xff]), contentType: "image/jpeg" });
    expect(result).toMatchObject({ objectKey: "motel/one/file", size: 3, contentType: "image/jpeg" });
    expect(result.checksum).toMatch(/^[a-f0-9]{64}$/);
    expect(await storage.createSignedDownload(result.objectKey, 60)).toContain("expires=60");
    await storage.delete(result.objectKey);
    await expect(storage.createSignedDownload(result.objectKey, 60)).rejects.toThrow("Không tìm thấy");
  });

  test("can fail operations for failure-path tests", async () => {
    const storage = new FakeStorageAdapter({ failure: new Error("storage down") });
    await expect(storage.put({ objectKey: "motel/one/file", body: new Uint8Array([0xff, 0xd8, 0xff]), contentType: "image/jpeg" })).rejects.toThrow("storage down");
  });
});
