import * as fs from 'fs/promises';
import * as path from 'path';
import type { StorageBackend } from './storage-backend.interface';

/** Local disk backend — dev default. */
export class LocalStorageBackend implements StorageBackend {
  constructor(private readonly rootDir = process.env.MEDIA_STORAGE_ROOT ?? 'media-data') {}

  private fullPath(storageKey: string): string {
    const resolved = path.resolve(this.rootDir, storageKey);
    const root = path.resolve(this.rootDir);
    if (!resolved.startsWith(root)) throw new Error('Invalid storage key');
    return resolved;
  }

  async put(storageKey: string, buffer: Buffer): Promise<void> {
    const p = this.fullPath(storageKey);
    await fs.mkdir(path.dirname(p), { recursive: true });
    await fs.writeFile(p, buffer);
  }

  async get(storageKey: string): Promise<Buffer> {
    return fs.readFile(this.fullPath(storageKey));
  }

  async exists(storageKey: string): Promise<boolean> {
    try {
      await fs.access(this.fullPath(storageKey));
      return true;
    } catch {
      return false;
    }
  }

  async delete(storageKey: string): Promise<void> {
    await fs.rm(this.fullPath(storageKey), { force: true });
  }
}
