import type { DomainEventType } from '../event-types';
import { normalizeEventType } from './registry';
import { EVENT_SCHEMAS } from './schemas';

export class EventValidationError extends Error {
  constructor(
    public readonly eventType: string,
    public readonly issues: string[],
  ) {
    super(`Invalid event "${eventType}": ${issues.join('; ')}`);
    this.name = 'EventValidationError';
  }
}

/**
 * Validate an event payload against its registered schema.
 * Throws EventValidationError — publishers must NOT silently drop this.
 * Returns the canonical (versioned) event type.
 */
export function assertValidEvent(
  type: string,
  payload: Record<string, unknown>,
): DomainEventType {
  const canonical = normalizeEventType(type);
  if (!canonical) {
    throw new EventValidationError(type, ['unknown event type — add it to the registry first']);
  }
  const schema = EVENT_SCHEMAS[canonical];
  const result = schema.safeParse(payload);
  if (!result.success) {
    const issues = result.error.issues.map(
      (i) => `${i.path.join('.') || '(root)'}: ${i.message}`,
    );
    throw new EventValidationError(canonical, issues);
  }
  return canonical;
}
