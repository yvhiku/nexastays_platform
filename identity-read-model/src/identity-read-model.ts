import Redis from 'ioredis';
import { CircuitBreaker, retryWithBackoff } from '@nexa/event-bus';

export interface IdentitySnapshot {
  userId: string;
  unifiedIdentityId: string | null;
  accountType: string | null;
  roles: string[];
  kycStatus: string;
  kycTier: string;
  kycLevel: number;
  accountStatus?: string;
  updatedAt: string;
  [key: string]: unknown;
}

export interface IdentityReadModelOptions {
  /** Redis URL. Omit/empty → cache disabled, every call falls through to Identity API. */
  redisUrl?: string;
  /** Identity API base, e.g. http://127.0.0.1:3001/api/v1 */
  identityBaseUrl: string;
  /** Cache TTL in ms. Default 120s — aligned with Identity snapshot TTL. */
  ttlMs?: number;
  /** Service name for logs. */
  serviceName?: string;
}

const KEY_PREFIX = 'nexa:identity:read-model:';

/**
 * Redis-backed identity read model.
 *
 * Read path:  Redis cache → (miss) → Identity /snapshots/me → cache with TTL.
 * The Identity API call is guarded by retry + circuit breaker so a struggling
 * Identity service cannot take product services down with it.
 *
 * Invalidation: call invalidate(userId) from a kyc.updated.v1 consumer.
 */
export class IdentityReadModel {
  private readonly redis: Redis | null;
  private readonly ttlMs: number;
  private readonly baseUrl: string;
  private readonly serviceName: string;
  private readonly breaker = new CircuitBreaker({
    name: 'identity-snapshot-api',
    failureThreshold: 5,
    resetTimeoutMs: 15_000,
  });

  constructor(options: IdentityReadModelOptions) {
    this.baseUrl = options.identityBaseUrl.replace(/\/$/, '');
    this.ttlMs = options.ttlMs ?? 120_000;
    this.serviceName = options.serviceName ?? 'identity-read-model';
    const url = options.redisUrl ?? process.env.REDIS_URL;
    this.redis = url ? new Redis(url, { maxRetriesPerRequest: 1, lazyConnect: true }) : null;
    if (this.redis) void this.redis.connect().catch(() => undefined);
  }

  /**
   * Get identity snapshot for a user. Cache-first; falls back to the
   * Identity snapshot API (authorized with the caller's bearer token).
   * Returns null if both cache and API are unavailable.
   */
  async getSnapshot(
    userId: string,
    authorizationHeader: string,
  ): Promise<IdentitySnapshot | null> {
    const cached = await this.readCache(userId);
    if (cached) return cached;

    const fresh = await this.fetchFromIdentity(authorizationHeader);
    if (fresh) await this.writeCache(userId, fresh);
    return fresh;
  }

  /** Drop the cached snapshot — call on kyc.updated events. */
  async invalidate(userId: string): Promise<void> {
    if (!this.redis) return;
    try {
      await this.redis.del(KEY_PREFIX + userId);
    } catch {
      /* cache best-effort */
    }
  }

  /** Warm/refresh the cache directly (e.g. from an event payload). */
  async prime(userId: string, snapshot: IdentitySnapshot): Promise<void> {
    await this.writeCache(userId, snapshot);
  }

  private async readCache(userId: string): Promise<IdentitySnapshot | null> {
    if (!this.redis) return null;
    try {
      const raw = await this.redis.get(KEY_PREFIX + userId);
      return raw ? (JSON.parse(raw) as IdentitySnapshot) : null;
    } catch {
      return null;
    }
  }

  private async writeCache(userId: string, snapshot: IdentitySnapshot): Promise<void> {
    if (!this.redis) return;
    try {
      await this.redis.set(
        KEY_PREFIX + userId,
        JSON.stringify(snapshot),
        'PX',
        this.ttlMs,
      );
    } catch {
      /* cache best-effort */
    }
  }

  private async fetchFromIdentity(
    authorizationHeader: string,
  ): Promise<IdentitySnapshot | null> {
    if (!authorizationHeader?.startsWith('Bearer ')) return null;
    try {
      return await this.breaker.execute(() =>
        retryWithBackoff(
          async () => {
            const res = await fetch(`${this.baseUrl}/snapshots/me`, {
              headers: { Authorization: authorizationHeader },
            });
            if (!res.ok) {
              const err = new Error(`snapshot HTTP ${res.status}`);
              // 4xx = not transient; don't burn retries.
              (err as Error & { permanent?: boolean }).permanent = res.status < 500;
              throw err;
            }
            return (await res.json()) as IdentitySnapshot;
          },
          {
            attempts: 3,
            baseDelayMs: 150,
            shouldRetry: (e) => !(e as { permanent?: boolean })?.permanent,
          },
        ),
      );
    } catch (err) {
      console.warn(
        JSON.stringify({
          level: 'warn',
          service: this.serviceName,
          event: 'identity.snapshot_fetch_failed',
          error: err instanceof Error ? err.message : String(err),
          circuit: this.breaker.currentState,
          ts: new Date().toISOString(),
        }),
      );
      return null;
    }
  }
}
