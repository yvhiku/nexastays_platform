export interface MediaMetadata {
  assetId: string;
  storageKey: string;
  mimeType: string;
  sizeBytes: number;
  ownerService: string;
  ownerUserId?: string;
  createdAt: string;
}

export interface StorageBackend {
  /** Persist a blob; returns the storage key. */
  put(storageKey: string, buffer: Buffer): Promise<void>;
  /** Read a blob by storage key. */
  get(storageKey: string): Promise<Buffer>;
  exists(storageKey: string): Promise<boolean>;
  delete(storageKey: string): Promise<void>;
}
