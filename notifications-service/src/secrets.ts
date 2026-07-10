/**
 * Resolve secrets from environment. Never hardcode production credentials.
 */

export function isProductionRuntime(): boolean {
  return process.env.NODE_ENV === 'production';
}

export function requireSecret(
  name: string,
  options?: { devFallback?: string },
): string {
  const value = (process.env[name] ?? '').trim();
  if (value) return value;
  if (isProductionRuntime()) {
    throw new Error(`${name} is required in production and must be set via environment variables.`);
  }
  if (options?.devFallback !== undefined) return options.devFallback;
  throw new Error(`${name} is not set.`);
}

export function getInternalServiceKey(): string {
  return requireSecret('INTERNAL_SERVICE_KEY', {
    devFallback: 'dev-internal-key',
  });
}
