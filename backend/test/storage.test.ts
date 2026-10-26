import { describe, expect, spyOn, test } from "bun:test";
import { FakeStorageAdapter, StorageError, validateStorageInput } from "@/shared/storage";
import { R2StorageAdapter } from "@/shared/storage.r2";

describe("storage validation", () => {
  test("validates images against resource-specific byte limits", async () => {
    const jpeg = new Uint8Array([0xff, 0xd8, 0xff]);
    await expect(
      validateStorageInput({
        objectKey: "motel/one/cccd",
        body: jpeg,
        contentType: "image/jpeg",
        maxBytes: 5_000_000,
      }),
    ).resolves.toBeInstanceOf(Uint8Array);
    await expect(
      validateStorageInput({
        objectKey: "motel/one/cccd",
        body: new Uint8Array(5_000_001),
        contentType: "image/jpeg",
        maxBytes: 5_000_000,
      }),
    ).rejects.toThrow("5 MB");
  });
  test("accepts JPEG, PNG, and PDF magic bytes", async () => {
    for (const [contentType, bytes] of [
      ["image/jpeg", new Uint8Array([0xff, 0xd8, 0xff, 0xe0])],
      ["image/png", new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])],
      ["application/pdf", new TextEncoder().encode("%PDF-1.7")],
    ] as const) {
      await expect(
        validateStorageInput({ objectKey: "motel/one/file", body: bytes, contentType }),
      ).resolves.toBeInstanceOf(Uint8Array);
    }
  });

  test("rejects mismatched MIME, unsafe keys, and oversized content", async () => {
    for (const objectKey of [
      "",
      "/leading",
      "motel//empty",
      "motel/./dot",
      "motel/../parent",
      "../secret",
    ]) {
      await expect(
        validateStorageInput({ objectKey, body: new Uint8Array([1]), contentType: "image/png" }),
      ).rejects.toBeInstanceOf(StorageError);
    }
    await expect(
      validateStorageInput({
        objectKey: "motel/one/file",
        body: new Uint8Array([0xff, 0xd8, 0xff]),
        contentType: "image/png",
      }),
    ).rejects.toThrow("không khớp");
    await expect(
      validateStorageInput({
        objectKey: "motel/one/file",
        body: new Uint8Array(10 * 1024 * 1024 + 1),
        contentType: "image/jpeg",
      }),
    ).rejects.toThrow("10 MB");
  });
});

describe("FakeStorageAdapter", () => {
  test("stores metadata, signs downloads with TTL, and deletes objects", async () => {
    const storage = new FakeStorageAdapter();
    const result = await storage.put({
      objectKey: "motel/one/file",
      body: new Uint8Array([0xff, 0xd8, 0xff]),
      contentType: "image/jpeg",
    });
    expect(result).toMatchObject({
      objectKey: "motel/one/file",
      size: 3,
      contentType: "image/jpeg",
    });
    expect(result.checksum).toMatch(/^[a-f0-9]{64}$/);
    expect(await storage.createSignedDownload(result.objectKey, 60)).toContain("expires=60");
    await storage.delete(result.objectKey);
    await expect(storage.createSignedDownload(result.objectKey, 60)).rejects.toThrow(
      "Không tìm thấy",
    );
  });

  test("enforces stream limits and TTL boundaries", async () => {
    const storage = new FakeStorageAdapter();
    const stream = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(new Uint8Array(10 * 1024 * 1024));
        controller.enqueue(new Uint8Array(1));
        controller.close();
      },
    });
    await expect(
      storage.put({ objectKey: "motel/one/file", body: stream, contentType: "image/jpeg" }),
    ).rejects.toThrow("10 MB");
    const result = await storage.put({
      objectKey: "motel/one/file",
      body: new Uint8Array([0xff, 0xd8, 0xff]),
      contentType: "image/jpeg",
    });
    await expect(storage.createSignedDownload(result.objectKey, 0)).rejects.toThrow("TTL");
    await expect(storage.createSignedDownload(result.objectKey, 901)).rejects.toThrow("TTL");
    await expect(storage.createSignedDownload(result.objectKey, 1)).resolves.toContain("expires=1");
    await expect(storage.createSignedDownload(result.objectKey, 900)).resolves.toContain(
      "expires=900",
    );
  });

  test("rejects unsafe keys and sanitizes failure details", async () => {
    const storage = new FakeStorageAdapter();
    await expect(
      storage.put({
        objectKey: "/motel//one/file",
        body: new Uint8Array([0xff, 0xd8, 0xff]),
        contentType: "image/jpeg",
      }),
    ).rejects.toBeInstanceOf(StorageError);
    const failing = new FakeStorageAdapter({
      failure: new Error("bucket=secret accessKey=private"),
    });
    await expect(failing.delete("motel/one/file")).rejects.toThrow(StorageError);
    await expect(failing.delete("motel/one/file")).rejects.not.toThrow("bucket=secret");
    await expect(failing.createSignedDownload("motel/one/file", 60)).rejects.toThrow(StorageError);
    await expect(failing.createSignedDownload("motel/one/file", 60)).rejects.not.toThrow(
      "accessKey=private",
    );
  });

  test("R2 upload logs only allowlisted provider diagnostics", async () => {
    const logger = spyOn(console, "error").mockImplementation(() => {});
    const providerError = Object.assign(new Error("secret-bearing accessKey=private object=motel/one/file"), {
      name: "SlowDown",
      $metadata: { httpStatusCode: 503, requestId: "request-safe-id" },
    });
    const adapter = new R2StorageAdapter(
      {
        accountId: "account-private",
        accessKeyId: "key-private",
        secretAccessKey: "secret-private",
        bucket: "bucket-private",
        publicUrl: "",
      },
      { send: async () => { throw providerError; } } as never,
    );

    try {
      await expect(adapter.put({
        objectKey: "motel/one/object-private",
        body: new Uint8Array([0xff, 0xd8, 0xff]),
        contentType: "image/jpeg",
      })).rejects.toBeInstanceOf(StorageError);
      await expect(adapter.put({
        objectKey: "motel/one/object-private",
        body: new Uint8Array([0xff, 0xd8, 0xff]),
        contentType: "image/jpeg",
      })).rejects.toThrow("storage failure");
      expect(logger).toHaveBeenCalledTimes(2);
      for (const call of logger.mock.calls) {
        expect(call).toEqual([
          "R2 storage failure",
          { operation: "r2.put", errorName: "SlowDown", httpStatusCode: 503, requestId: "request-safe-id" },
        ]);
      }
      const logged = JSON.stringify(logger.mock.calls);
      for (const secret of ["secret-bearing", "accessKey=private", "object-private", "key-private", "secret-private", "bucket-private", "account-private"]) {
        expect(logged).not.toContain(secret);
      }
    } finally {
      logger.mockRestore();
    }
  });

  test("R2 adapter sanitizes failed S3 upload, delete, and presign operations", async () => {
    const input = {
      objectKey: "motel/one/file",
      body: new Uint8Array([0xff, 0xd8, 0xff]),
      contentType: "image/jpeg",
    } as const;
    const client = {
      send: async () => {
        throw new Error("accessKey=private secret=hidden");
      },
    } as never;
    const upload = new R2StorageAdapter(
      {
        accountId: "acct",
        accessKeyId: "key",
        secretAccessKey: "secret",
        bucket: "bucket",
        publicUrl: "",
      },
      client,
    );
    await expect(upload.put(input)).rejects.toThrow("storage failure");
    await expect(upload.put(input)).rejects.not.toThrow("private");
    await expect(upload.delete(input.objectKey)).rejects.toThrow("storage failure");
    const signer = new R2StorageAdapter(
      {
        accountId: "acct",
        accessKeyId: "key",
        secretAccessKey: "secret",
        bucket: "bucket",
        publicUrl: "",
      },
      {} as never,
      async () => {
        throw new Error("secret signer");
      },
    );
    await expect(signer.createSignedDownload(input.objectKey, 10)).rejects.toThrow(
      "storage failure",
    );
    await expect(signer.createSignedDownload("../unsafe", 10)).rejects.toBeInstanceOf(StorageError);
  });

  test("R2 adapter uses S3-compatible operations without leaking credentials", async () => {
    const requests: Array<{ name: string; input: Record<string, unknown> }> = [];
    const adapter = new R2StorageAdapter(
      {
        accountId: "acct",
        accessKeyId: "key",
        secretAccessKey: "secret",
        bucket: "bucket",
        publicUrl: "",
      },
      {
        send: async (command: { input: Record<string, string> }) => {
          requests.push({ name: command.constructor.name, input: command.input });
          return {};
        },
      } as never,
      async (...args: unknown[]) => {
        const command = args[1] as { input: Record<string, unknown> };
        expect(command.input).toMatchObject({ Bucket: "bucket", Key: "motel/one/file" });
        return "https://signed.test/file?X-Amz-SignedHeaders=host&X-Amz-Expires=60";
      },
    );
    const input = {
      objectKey: "motel/one/file",
      body: new Uint8Array([0xff, 0xd8, 0xff]),
      contentType: "image/jpeg",
    } as const;
    const originalKey = input.objectKey;
    const result = await adapter.put(input);
    expect(input.objectKey).toBe(originalKey);
    expect(result.objectKey).toBe("motel/one/file");
    await adapter.delete(result.objectKey);
    const url = await adapter.createSignedDownload(result.objectKey, 60);
    expect(url).toContain("X-Amz-Expires=60");
    expect(url).not.toContain("secret");
    expect(requests.map((request) => request.name)).toEqual([
      "PutObjectCommand",
      "DeleteObjectCommand",
    ]);
    expect(JSON.stringify(requests)).not.toContain("secret");
    expect(url).toMatch(/X-Amz-SignedHeaders=/);
    expect(url).not.toContain("secret");
  });

  test("can fail operations for failure-path tests", async () => {
    const storage = new FakeStorageAdapter({ failure: new Error("storage down") });
    await expect(
      storage.put({
        objectKey: "motel/one/file",
        body: new Uint8Array([0xff, 0xd8, 0xff]),
        contentType: "image/jpeg",
      }),
    ).rejects.toThrow("storage failure");
  });
});
