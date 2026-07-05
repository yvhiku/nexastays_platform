import type { StorageBackend } from './storage-backend.interface';

/**
 * S3-compatible backend (AWS S3, MinIO, Cloudflare R2).
 *
 * Prod-ready seam: install @aws-sdk/client-s3 and set
 * MEDIA_S3_BUCKET / MEDIA_S3_ENDPOINT / AWS credentials, then this
 * backend is selected automatically (MEDIA_STORAGE_BACKEND=s3).
 */
export class S3StorageBackend implements StorageBackend {
  private client: unknown = null;
  private readonly bucket = process.env.MEDIA_S3_BUCKET ?? '';

  private async getClient(): Promise<any> {
    if (this.client) return this.client;
    try {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const { S3Client } = require('@aws-sdk/client-s3');
      this.client = new S3Client({
        endpoint: process.env.MEDIA_S3_ENDPOINT || undefined,
        region: process.env.MEDIA_S3_REGION ?? 'auto',
        forcePathStyle: true,
      });
      return this.client;
    } catch {
      throw new Error(
        'S3 backend selected but @aws-sdk/client-s3 is not installed. Run: npm i @aws-sdk/client-s3',
      );
    }
  }

  async put(storageKey: string, buffer: Buffer): Promise<void> {
    const client = await this.getClient();
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { PutObjectCommand } = require('@aws-sdk/client-s3');
    await client.send(
      new PutObjectCommand({ Bucket: this.bucket, Key: storageKey, Body: buffer }),
    );
  }

  async get(storageKey: string): Promise<Buffer> {
    const client = await this.getClient();
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { GetObjectCommand } = require('@aws-sdk/client-s3');
    const res = await client.send(
      new GetObjectCommand({ Bucket: this.bucket, Key: storageKey }),
    );
    return Buffer.from(await res.Body.transformToByteArray());
  }

  async exists(storageKey: string): Promise<boolean> {
    const client = await this.getClient();
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { HeadObjectCommand } = require('@aws-sdk/client-s3');
    try {
      await client.send(
        new HeadObjectCommand({ Bucket: this.bucket, Key: storageKey }),
      );
      return true;
    } catch {
      return false;
    }
  }

  async delete(storageKey: string): Promise<void> {
    const client = await this.getClient();
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { DeleteObjectCommand } = require('@aws-sdk/client-s3');
    await client.send(
      new DeleteObjectCommand({ Bucket: this.bucket, Key: storageKey }),
    );
  }
}
