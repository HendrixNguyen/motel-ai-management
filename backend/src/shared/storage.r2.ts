import { createHmac } from "node:crypto";
import { env } from "@/config";
import { validateStorageInput, type StorageAdapter, type StorageObject, type StoragePutInput, StorageError } from "@/shared/storage";

const MAX_TTL = 900;
type Requester = (request: Request) => Promise<Response>;

export class R2StorageAdapter implements StorageAdapter {
  private readonly baseUrl: string;
  private readonly request: Requester;
  constructor(private readonly credentials = env.r2, request: Requester = fetch) {
    this.baseUrl = `https://${credentials.accountId}.r2.cloudflarestorage.com/${credentials.bucket}`;
    this.request = request;
  }
  private key(objectKey: string): string { return objectKey.replace(/^\/+/, "").replace(/\/+/g, "/"); }
  private url(objectKey: string): string { return `${this.baseUrl}/${encodeURIComponent(this.key(objectKey)).replace(/%2F/g, "/")}`; }
  private async call(request: Request): Promise<Response> {
    try { const response = await this.request(request); if (!response.ok) throw new StorageError("storage failure"); return response; }
    catch (error) { if (error instanceof StorageError) throw error; throw new StorageError("storage failure"); }
  }
  async put(input: StoragePutInput): Promise<StorageObject> {
    const bytes = await validateStorageInput(input);
    await this.call(new Request(this.url(input.objectKey), { method: "PUT", body: bytes, headers: { "content-type": input.contentType, authorization: `AWS4-HMAC-SHA256 Credential=${this.credentials.accessKeyId}` } }));
    const checksum = new Uint8Array(await crypto.subtle.digest("SHA-256", new Uint8Array(bytes)));
    return { objectKey: this.key(input.objectKey), size: bytes.byteLength, checksum: [...checksum].map((byte) => byte.toString(16).padStart(2, "0")).join(""), contentType: input.contentType };
  }
  async delete(objectKey: string): Promise<void> { await this.call(new Request(this.url(objectKey), { method: "DELETE", headers: { authorization: `AWS4-HMAC-SHA256 Credential=${this.credentials.accessKeyId}` } })); }
  async createSignedDownload(objectKey: string, expiresInSeconds: number): Promise<string> {
    if (!Number.isInteger(expiresInSeconds) || expiresInSeconds < 1 || expiresInSeconds > MAX_TTL) throw new StorageError("TTL không hợp lệ");
    const expires = Math.floor(Date.now() / 1000) + expiresInSeconds;
    const signature = createHmac("sha256", this.credentials.secretAccessKey).update(`${this.key(objectKey)}:${expires}`).digest("hex");
    return `${this.url(objectKey)}?X-Amz-Algorithm=AWS4-HMAC-SHA256&X-Amz-Credential=${encodeURIComponent(this.credentials.accessKeyId)}&X-Amz-Expires=${expiresInSeconds}&X-Amz-Signature=${signature}`;
  }
}
