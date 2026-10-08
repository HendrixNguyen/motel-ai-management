import { env } from "@/config";
import type { StorageAdapter, StorageObject, StoragePutInput } from "@/shared/storage";

export class R2StorageAdapter implements StorageAdapter {
  constructor(private readonly credentials = env.r2) {}
  async put(_input: StoragePutInput): Promise<StorageObject> {
    throw new Error(`R2 storage unavailable for bucket ${this.credentials.bucket}`);
  }
  async delete(_objectKey: string): Promise<void> {
    throw new Error(`R2 storage unavailable for bucket ${this.credentials.bucket}`);
  }
  async createSignedDownload(_objectKey: string, _expiresInSeconds: number): Promise<string> {
    throw new Error(`R2 storage unavailable for bucket ${this.credentials.bucket}`);
  }
}
