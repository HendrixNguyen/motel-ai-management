import { DeleteObjectCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { env } from "@/config";
import { validateStorageInput, type StorageAdapter, type StorageObject, type StoragePutInput, StorageError } from "@/shared/storage";

const MAX_TTL = 900;
export class R2StorageAdapter implements StorageAdapter {
  private readonly client: S3Client;
  constructor(private readonly credentials = env.r2, client?: S3Client, private readonly signer = getSignedUrl) {
    this.client = client ?? new S3Client({ region: "auto", endpoint: `https://${credentials.accountId}.r2.cloudflarestorage.com`, credentials: { accessKeyId: credentials.accessKeyId, secretAccessKey: credentials.secretAccessKey } });
  }
  private key(objectKey: string): string {
    const key = objectKey.replace(/^\/+/, "").replace(/\/+/g, "/");
    if (!key || key.includes("..") || !/^[-a-zA-Z0-9_./]+$/.test(key)) throw new StorageError("Object key không hợp lệ");
    return key;
  }
  async put(input: StoragePutInput): Promise<StorageObject> {
    const objectKey = this.key(input.objectKey);
    const bytes = await validateStorageInput({ ...input, objectKey });
    try { await this.client.send(new PutObjectCommand({ Bucket: this.credentials.bucket, Key: objectKey, Body: bytes, ContentType: input.contentType })); }
    catch { throw new StorageError("storage failure"); }
    const digest = new Uint8Array(await crypto.subtle.digest("SHA-256", new Uint8Array(bytes)));
    return { objectKey, size: bytes.byteLength, checksum: [...digest].map((byte) => byte.toString(16).padStart(2, "0")).join(""), contentType: input.contentType };
  }
  async delete(objectKey: string): Promise<void> {
    const key = this.key(objectKey);
    try { await this.client.send(new DeleteObjectCommand({ Bucket: this.credentials.bucket, Key: key })); }
    catch { throw new StorageError("storage failure"); }
  }
  async createSignedDownload(objectKey: string, expiresInSeconds: number): Promise<string> {
    const key = this.key(objectKey);
    if (!Number.isInteger(expiresInSeconds) || expiresInSeconds < 1 || expiresInSeconds > MAX_TTL) throw new StorageError("TTL không hợp lệ");
    try { return await this.signer(this.client, new (await import("@aws-sdk/client-s3")).GetObjectCommand({ Bucket: this.credentials.bucket, Key: key }), { expiresIn: expiresInSeconds }); }
    catch { throw new StorageError("storage failure"); }
  }
}
