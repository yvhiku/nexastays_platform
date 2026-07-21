import { DOMAIN_EVENT_TYPES, type DomainEventType } from '../event-types';

/**
 * Event registry — the ONLY sanctioned way to reference event names.
 * New event versions get a new entry (BOOKING_CONFIRMED_V2 → 'booking.confirmed.v2').
 */
export const EVENTS = {
  BOOKING_CREATED: 'booking.created.v1',
  BOOKING_CONFIRMED: 'booking.confirmed.v1',
  BOOKING_COMPLETED: 'booking.completed.v1',
  BOOKING_CANCELLED: 'booking.cancelled.v1',
  BOOKING_HOST_APPROVED: 'booking.host_approved.v1',
  PAYMENT_SUCCEEDED: 'payment.succeeded.v1',
  PAYMENT_EXPIRED: 'payment.expired.v1',
  KYC_UPDATED: 'kyc.updated.v1',
  LISTING_PUBLISHED: 'listing.published.v1',
  REVIEW_CREATED: 'review.created.v1',
  REVIEW_UPDATED: 'review.updated.v1',
  REVIEW_DELETED: 'review.deleted.v1',
  REVIEW_REMINDER: 'review.reminder.v1',
  REVIEW_REPLY: 'review.reply.v1',
  CHECKOUT_REMINDER: 'booking.checkout_reminder.v1',
  MESSAGE_RECEIVED: 'message.received.v1',
  MESSAGE_SENT: 'message.sent.v1',
  MESSAGE_READ: 'message.read.v1',
  CONVERSATION_ARCHIVED: 'conversation.archived.v1',
} as const satisfies Record<string, DomainEventType>;

export type RegisteredEventName = (typeof EVENTS)[keyof typeof EVENTS];

const VERSION_SUFFIX = /\.v\d+$/;

/**
 * Normalize any incoming event name to a canonical versioned type.
 * Unversioned legacy names ('booking.confirmed') map to '.v1'.
 * Returns null for unknown events.
 */
export function normalizeEventType(type: string): DomainEventType | null {
  const candidate = VERSION_SUFFIX.test(type) ? type : `${type}.v1`;
  return (DOMAIN_EVENT_TYPES as readonly string[]).includes(candidate)
    ? (candidate as DomainEventType)
    : null;
}

/** Strip version suffix — for logging/grouping only, never for routing. */
export function baseEventName(type: string): string {
  return type.replace(VERSION_SUFFIX, '');
}

export function eventVersion(type: string): number {
  const m = type.match(/\.v(\d+)$/);
  return m ? Number(m[1]) : 1;
}
