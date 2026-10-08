import { createHash } from "node:crypto";

export const MAX_STORAGE_BYTES = 10 * 1024 * 1024;
export const SUPPORTED_CONTENT_TYPES = ["image/jpeg", "image/png", "application/pdf"] as const;
export type StorageContentType = (typeof SUPPORTED_CONTENT_TYPES)[number];

export interface StoragePutInput {
  objectKey: string;
  body: Uint8Array | ReadableStream<Uint8Array>;
  contentType: StorageContentType;
}

export interface StorageObject {
  objectKey: string;
  size: number;
  checksum: string;
  contentType: StorageContentType;
}

export interface StorageAdapter {
  put(input: StoragePutInput): Promise<StorageObject>;
  delete(objectKey: string): Promise<void>;
  createSignedDownload(objectKey: string, expiresInSeconds: number): Promise<string>;
}

export class StorageError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "StorageError";
  }
}

function magicMatches(bytes: Uint8Array, contentType: StorageContentType): boolean {
  if (contentType === "image/jpeg") return bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
  if (contentType === "image/png") return bytes.slice(0, 8).every((byte, index) => byte === [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a][index]);
  return new TextDecoder().decode(bytes.slice(0, 5)) === "%PDF-";
}

export async function readStorageBody(body: StoragePutInput["body"]): Promise<Uint8Array> {
  if (body instanceof Uint8Array) return body;
  const reader = body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  while (true) {
    const result = await reader.read();
    if (result.done) break;
    size += result.value.byteLength;
    if (size > MAX_STORAGE_BYTES) throw new StorageError("Tệp vượt quá giới hạn 10 MB");
    chunks.push(result.value);
  }
  const output = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) { output.set(chunk, offset); offset += chunk.byteLength; }
  return output;
}

export async function validateStorageInput(input: StoragePutInput): Promise<Uint8Array> {
  input.objectKey = input.objectKey.replace(/^\/+/, "").replace(/\/+/g, "/");
  if (!/^[-a-zA-Z0-9_./]+$/.test(input.objectKey) || input.objectKey.includes("..")) throw new StorageError("Object key không hợp lệ");
  if (!SUPPORTED_CONTENT_TYPES.includes(input.contentType)) throw new StorageError("MIME không được hỗ trợ");
  const bytes = await readStorageBody(input.body);
  if (bytes.byteLength > MAX_STORAGE_BYTES) throw new StorageError("Tệp vượt quá giới hạn 10 MB");
  if (!magicMatches(bytes, input.contentType)) throw new StorageError("MIME không khớp nội dung tệp");
  return bytes;
}

export class FakeStorageAdapter implements StorageAdapter {
  private readonly objects = new Map<string, StorageObject>();
  constructor(private readonly options: { failure?: Error } = {}) {}
  async put(input: StoragePutInput): Promise<StorageObject> {
    if (this.options.failure) throw this.options.failure;
    const bytes = await validateStorageInput(input);
    const object = { objectKey: input.objectKey, size: bytes.byteLength, checksum: createHash("sha256").update(bytes).digest("hex"), contentType: input.contentType };
    this.objects.set(input.objectKey, object);
    return object;
  }
  async delete(objectKey: string): Promise<void> {
    if (this.options.failure) throw this.options.failure;
    this.objects.delete(objectKey);
  }
  async createSignedDownload(objectKey: string, expiresInSeconds: number): Promise<string> {
    if (this.options.failure) throw this.options.failure;
    if (!this.objects.has(objectKey)) throw new StorageError("Không tìm thấy tệp");
    if (!Number.isInteger(expiresInSeconds) || expiresInSeconds < 1 || expiresInSeconds > 900) throw new StorageError("TTL không hợp lệ");
    return `fake://private/${encodeURIComponent(objectKey)}?expires=${expiresInSeconds}`;
  }
}
