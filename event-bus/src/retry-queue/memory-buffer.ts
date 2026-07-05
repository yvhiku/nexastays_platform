import type { DomainEvent } from '../event-types';

const DEFAULT_CAPACITY = 1000;

/**
 * In-memory holding buffer used when Redis is down.
 * Events are flushed back to Redis when connectivity recovers.
 * Bounded: oldest events are dropped (with a callback) when full.
 */
export class InMemoryEventBuffer {
  private buffer: DomainEvent[] = [];

  constructor(
    private readonly capacity: number = DEFAULT_CAPACITY,
    private readonly onDrop?: (event: DomainEvent) => void,
  ) {}

  get size(): number {
    return this.buffer.length;
  }

  push(event: DomainEvent): void {
    if (this.buffer.length >= this.capacity) {
      const dropped = this.buffer.shift();
      if (dropped && this.onDrop) this.onDrop(dropped);
    }
    this.buffer.push(event);
  }

  drain(): DomainEvent[] {
    const all = this.buffer;
    this.buffer = [];
    return all;
  }

  requeueFront(events: DomainEvent[]): void {
    this.buffer = [...events, ...this.buffer].slice(0, this.capacity);
  }
}
