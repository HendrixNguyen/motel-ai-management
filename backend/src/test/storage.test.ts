import { describe, expect, test } from "bun:test";
import { FakeStorageAdapter, StorageError, validateStorageInput } from "@/shared/storage";
import { R2StorageAdapter } from "@/shared/storage.r2";

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

  test("enforces stream limits and TTL boundaries", async () => {
    const storage = new FakeStorageAdapter();
    const stream = new ReadableStream<Uint8Array>({ start(controller) { controller.enqueue(new Uint8Array(10 * 1024 * 1024)); controller.enqueue(new Uint8Array(1)); controller.close(); } });
    await expect(storage.put({ objectKey: "motel/one/file", body: stream, contentType: "image/jpeg" })).rejects.toThrow("10 MB");
    const result = await storage.put({ objectKey: "motel/one/file", body: new Uint8Array([0xff, 0xd8, 0xff]), contentType: "image/jpeg" });
    await expect(storage.createSignedDownload(result.objectKey, 0)).rejects.toThrow("TTL");
    await expect(storage.createSignedDownload(result.objectKey, 901)).rejects.toThrow("TTL");
    await expect(storage.createSignedDownload(result.objectKey, 1)).resolves.toContain("expires=1");
    await expect(storage.createSignedDownload(result.objectKey, 900)).resolves.toContain("expires=900");
  });

  test("normalizes keys and hides failure details", async () => {
    const storage = new FakeStorageAdapter();
    const result = await storage.put({ objectKey: "/motel//one/file", body: new Uint8Array([0xff, 0xd8, 0xff]), contentType: "image/jpeg" });
    expect(result.objectKey).toBe("motel/one/file");
    const failing = new FakeStorageAdapter({ failure: new Error("bucket=secret accessKey=private") });
    await expect(failing.delete("motel/one/file")).rejects.toThrow("bucket=secret");
    await expect(failing.createSignedDownload("motel/one/file", 60)).rejects.toThrow("bucket=secret");
  });

  test("R2 adapter uses S3-compatible operations without leaking credentials", async () => {
    const requests: Request[] = [];
    const adapter = new R2StorageAdapter({ accountId: "acct", accessKeyId: "key", secretAccessKey: "secret", bucket: "bucket", publicUrl: "" }, async (request) => { requests.push(request); return new Response(request.method === "HEAD" ? null : new Uint8Array([0xff, 0xd8, 0xff])); });
    const result = await adapter.put({ objectKey: "/motel//one/file", body: new Uint8Array([0xff, 0xd8, 0xff]), contentType: "image/jpeg" });
    expect(result.objectKey).toBe("motel/one/file");
    await adapter.delete(result.objectKey);
    const url = await adapter.createSignedDownload(result.objectKey, 60);
    expect(url).toContain("X-Amz-Expires=60");
    expect(url).not.toContain("secret");
    expect(requests.map((request) => request.method)).toEqual(["PUT", "DELETE"]);
  });

  test("can fail operations for failure-path tests", async () => {
    const storage = new FakeStorageAdapter({ failure: new Error("storage down") });
    await expect(storage.put({ objectKey: "motel/one/file", body: new Uint8Array([0xff, 0xd8, 0xff]), contentType: "image/jpeg" })).rejects.toThrow("storage down");
  });
});
