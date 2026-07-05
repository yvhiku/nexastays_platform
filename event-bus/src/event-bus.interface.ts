import type { DomainEvent, DomainEventType } from './event-types';

export interface EventBusPublisher {
  /**
   * Publish a domain event. `type` accepts registry names (EVENTS.*) or
   * legacy unversioned names (normalized to .v1).
   * Throws EventValidationError for unknown types or invalid payloads.
   */
  publish<T extends Record<string, unknown>>(
    type: string,
    source: string,
    payload: T,
  ): Promise<DomainEvent<T>>;
}

export type EventHandler = (event: DomainEvent) => Promise<void>;

export interface EventBusConsumer {
  subscribe(types: (DomainEventType | string)[], handler: EventHandler): Promise<void>;
  start(): Promise<void>;
  stop(): Promise<void>;
}
