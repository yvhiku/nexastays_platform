export interface CircuitBreakerOptions {
  /** Consecutive failures before the circuit opens. Default 5. */
  failureThreshold?: number;
  /** How long the circuit stays open before a half-open probe. Default 30s. */
  resetTimeoutMs?: number;
  name?: string;
}

export class CircuitOpenError extends Error {
  constructor(name: string) {
    super(`Circuit "${name}" is open — call rejected`);
    this.name = 'CircuitOpenError';
  }
}

type CircuitState = 'closed' | 'open' | 'half-open';

/**
 * Minimal circuit breaker for outbound service calls
 * (Identity snapshot, notifications, media service).
 */
export class CircuitBreaker {
  private state: CircuitState = 'closed';
  private failures = 0;
  private openedAt = 0;
  private readonly failureThreshold: number;
  private readonly resetTimeoutMs: number;
  private readonly name: string;

  constructor(options: CircuitBreakerOptions = {}) {
    this.failureThreshold = options.failureThreshold ?? 5;
    this.resetTimeoutMs = options.resetTimeoutMs ?? 30_000;
    this.name = options.name ?? 'default';
  }

  get currentState(): CircuitState {
    return this.state;
  }

  async execute<T>(fn: () => Promise<T>): Promise<T> {
    if (this.state === 'open') {
      if (Date.now() - this.openedAt >= this.resetTimeoutMs) {
        this.state = 'half-open';
      } else {
        throw new CircuitOpenError(this.name);
      }
    }
    try {
      const result = await fn();
      this.onSuccess();
      return result;
    } catch (err) {
      this.onFailure();
      throw err;
    }
  }

  private onSuccess(): void {
    this.failures = 0;
    this.state = 'closed';
  }

  private onFailure(): void {
    this.failures += 1;
    if (this.state === 'half-open' || this.failures >= this.failureThreshold) {
      this.state = 'open';
      this.openedAt = Date.now();
    }
  }
}

export interface RetryOptions {
  attempts?: number;
  baseDelayMs?: number;
  maxDelayMs?: number;
  /** Return false to stop retrying for non-transient errors. */
  shouldRetry?: (err: unknown) => boolean;
}

/** Retry with exponential backoff + jitter. */
export async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  options: RetryOptions = {},
): Promise<T> {
  const attempts = options.attempts ?? 3;
  const baseDelayMs = options.baseDelayMs ?? 200;
  const maxDelayMs = options.maxDelayMs ?? 5_000;
  let lastError: unknown;
  for (let attempt = 0; attempt < attempts; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastError = err;
      if (options.shouldRetry && !options.shouldRetry(err)) throw err;
      if (attempt === attempts - 1) break;
      const delay = Math.min(baseDelayMs * 2 ** attempt, maxDelayMs);
      const jitter = delay * (0.5 + Math.random() * 0.5);
      await new Promise((r) => setTimeout(r, jitter));
    }
  }
  throw lastError;
}
