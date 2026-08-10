import { createHmac, randomUUID, timingSafeEqual } from 'crypto';
import { Injectable, NotFoundException, UnauthorizedException } from '@nestjs/common';
import { LocalStorageBackend } from './storage/local-storage.backend';
import { S3StorageBackend } from './storage/s3-storage.backend';
import type { MediaMetadata, StorageBackend } from './storage/storage-backend.interface';
import { detectSafeMediaType, safeDownloadName } from './media-security';
import {
  getMediaSigningSecret,
  isHardProductionRuntime,
} from './secrets';

const META_SUFFIX = '.meta.json';

@Injectable()
export class MediaService {
  private readonly backend: StorageBackend;

  constructor() {
    if (isHardProductionRuntime() && process.env.MEDIA_STORAGE_BACKEND !== 's3') {
      throw new Error('MEDIA_STORAGE_BACKEND=s3 is required in production.');
    }
    this.backend =
      process.env.MEDIA_STORAGE_BACKEND === 's3'
        ? new S3StorageBackend()
        : new LocalStorageBackend();
  }

  async upload(params: {
    buffer: Buffer;
    filename: string;
    mimeType: string;
    ownerService: string;
    ownerUserId?: string;
    prefix?: string;
    assetId?: string;
  }): Promise<MediaMetadata & { signedUrl: string }> {
    const assetId = params.assetId?.trim() || randomUUID();
    const detected = detectSafeMediaType(params.buffer);
    const prefix = (params.prefix ?? params.ownerService).replace(/[^a-zA-Z0-9_/-]/g, '');
    const storageKey = `${prefix}/${assetId}${detected.extension}`;

    const metadata: MediaMetadata = {
      assetId,
      storageKey,
      mimeType: detected.mime,
      originalFilename: safeDownloadName(params.filename, detected.extension),
      sizeBytes: params.buffer.length,
      ownerService: params.ownerService,
      ownerUserId: params.ownerUserId,
      createdAt: new Date().toISOString(),
    };

    await this.backend.put(storageKey, params.buffer);
    await this.backend.put(
      storageKey + META_SUFFIX,
      Buffer.from(JSON.stringify(metadata)),
    );

    return { ...metadata, signedUrl: this.signedUrlFor(assetId, storageKey) };
  }

  async getMetadataByKey(storageKey: string): Promise<MediaMetadata> {
    try {
      const raw = await this.backend.get(storageKey + META_SUFFIX);
      return JSON.parse(raw.toString()) as MediaMetadata;
    } catch {
      throw new NotFoundException('Asset not found');
    }
  }

  async getFile(storageKey: string): Promise<{ buffer: Buffer; metadata: MediaMetadata }> {
    const metadata = await this.getMetadataByKey(storageKey);
    const buffer = await this.backend.get(storageKey);
    return { buffer, metadata };
  }

  /** HMAC-signed, expiring URL — S3 presigned-URL equivalent for any backend. */
  signedUrlFor(assetId: string, storageKey: string, ttlSeconds = 900): string {
    const exp = Math.floor(Date.now() / 1000) + ttlSeconds;
    const sig = this.computeSignature(storageKey, exp);
    const base =
      process.env.MEDIA_PUBLIC_BASE_URL ??
      `http://127.0.0.1:${process.env.PORT ?? 3004}`;
    const encodedKey = encodeURIComponent(storageKey);
    return `${base}/api/v1/media/file?key=${encodedKey}&exp=${exp}&sig=${sig}`;
  }

  verifySignature(storageKey: string, exp: number, sig: string): void {
    if (exp < Math.floor(Date.now() / 1000)) {
      throw new UnauthorizedException('Signed URL expired');
    }
    const expected = this.computeSignature(storageKey, exp);
    const a = Buffer.from(expected);
    const b = Buffer.from(sig);
    if (a.length !== b.length || !timingSafeEqual(a, b)) {
      throw new UnauthorizedException('Invalid signature');
    }
  }

  private computeSignature(storageKey: string, exp: number): string {
    return createHmac('sha256', getMediaSigningSecret())
      .update(`${storageKey}:${exp}`)
      .digest('hex');
  }
}
