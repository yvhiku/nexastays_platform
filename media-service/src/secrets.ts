/**
 * Resolve secrets from environment. Never hardcode production credentials.
 */

export type MediaRuntimeStage =
  | 'development'
  | 'dogfood'
  | 'staging'
  | 'production';

export function resolveMediaStage(
  env: NodeJS.ProcessEnv = process.env,
): MediaRuntimeStage {
  const explicit = (env.NEXA_ENV || env.APP_ENV || '').trim().toLowerCase();
  if (
    explicit === 'production' ||
    explicit === 'staging' ||
    explicit === 'dogfood' ||
    explicit === 'development'
  ) {
    return explicit;
  }
  // Dogfood often sets NODE_ENV=production without NEXA_ENV=production.
  if (env.NODE_ENV === 'production') return 'production';
  return 'development';
}

/** Real production (NEXA_ENV=production) — not soft-launch dogfood. */
export function isHardProductionRuntime(
  env: NodeJS.ProcessEnv = process.env,
): boolean {
  return resolveMediaStage(env) === 'production';
}

/** @deprecated Prefer isHardProductionRuntime for S3 fail-closed. */
export function isProductionRuntime(): boolean {
  return process.env.NODE_ENV === 'production';
}

export function requireSecret(
  name: string,
  options?: { devFallback?: string },
): string {
  const value = (process.env[name] ?? '').trim();
  if (value) return value;
  if (isHardProductionRuntime() || process.env.NODE_ENV === 'production') {
    // Require when NODE_ENV=production OR NEXA_ENV=production so dogfood still
    // sets secrets when shipping Node production builds.
    if (isHardProductionRuntime() || !options?.devFallback) {
      throw new Error(
        `${name} is required in production and must be set via environment variables.`,
      );
    }
  }
  if (options?.devFallback !== undefined) return options.devFallback;
  throw new Error(`${name} is not set.`);
}

export function getInternalServiceKey(): string {
  return requireSecret('INTERNAL_SERVICE_KEY', {
    devFallback: 'dev-internal-key',
  });
}

export function getMediaSigningSecret(): string {
  return requireSecret('MEDIA_SIGNING_SECRET', {
    devFallback: 'dev-media-signing-secret',
  });
}

/** Fail closed for object storage when NEXA_ENV=production. */
export function assertProductionObjectStorageConfigured(
  env: NodeJS.ProcessEnv = process.env,
): void {
  if (!isHardProductionRuntime(env)) return;
  if (env.MEDIA_ALLOW_LOCAL_STORAGE === 'true') {
    throw new Error(
      'MEDIA_ALLOW_LOCAL_STORAGE is not permitted when NEXA_ENV=production (PROD-SEC-002).',
    );
  }
  if ((env.MEDIA_STORAGE_BACKEND || '').trim() !== 's3') {
    throw new Error('MEDIA_STORAGE_BACKEND=s3 is required when NEXA_ENV=production.');
  }
  if (!(env.MEDIA_S3_BUCKET || '').trim()) {
    throw new Error('MEDIA_S3_BUCKET is required when NEXA_ENV=production.');
  }
  const publicUrl = (env.MEDIA_PUBLIC_BASE_URL || '').trim();
  if (!publicUrl.startsWith('https://')) {
    throw new Error('MEDIA_PUBLIC_BASE_URL must be an HTTPS URL in production.');
  }
}
