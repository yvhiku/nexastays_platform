/**
 * Canonical (versioned) domain event types.
 * Always publish via the EVENTS registry in contracts/registry.ts.
 */
export const DOMAIN_EVENT_TYPES = [
  'booking.created.v1',
  'booking.confirmed.v1',
  'booking.completed.v1',
  'payment.succeeded.v1',
  'payment.expired.v1',
  'kyc.updated.v1',
  'listing.published.v1',
  'review.created.v1',
  'review.updated.v1',
  'review.deleted.v1',
] as const;

export type DomainEventType = (typeof DOMAIN_EVENT_TYPES)[number];

/** Unversioned names still accepted on the consumer side (normalized to .v1). */
export type LegacyDomainEventType =
  | 'booking.created'
  | 'booking.confirmed'
  | 'booking.completed'
  | 'payment.succeeded'
  | 'payment.expired'
  | 'kyc.updated'
  | 'listing.published'
  | 'review.created'
  | 'review.updated'
  | 'review.deleted';

export interface DomainEvent<T extends Record<string, unknown> = Record<string, unknown>> {
  id: string;
  type: DomainEventType;
  source: string;
  occurredAt: string;
  payload: T;
}

export interface BookingConfirmedPayload {
  bookingId: string;
  listingId: string;
  hostUserId: string;
  guestUserId: string;
  amount: string;
  currency: string;
}

export interface BookingCreatedPayload {
  bookingId: string;
  listingId: string;
  guestUserId: string;
}

export interface BookingCompletedPayload {
  bookingId: string;
  listingId: string;
  hostUserId: string;
  guestUserId: string;
  checkoutDate: string;
}

export interface PaymentExpiredPayload {
  bookingId: string;
  listingId: string;
  guestUserId: string;
}

export interface PaymentSucceededPayload {
  bookingId: string;
  provider: string;
  providerIntentId: string;
  amount: string;
  currency: string;
}

export interface KycUpdatedPayload {
  userId: string;
  unifiedIdentityId: string;
  kycStatus: string;
  kycTier: string;
  kycLevel: number;
}

export interface ListingPublishedPayload {
  listingId: string;
  hostUserId: string;
}

export interface ReviewCreatedPayload {
  reviewId: string;
  bookingId: string;
  listingId: string;
  hostUserId: string;
  guestUserId: string;
  rating: string;
}

export interface ReviewUpdatedPayload {
  reviewId: string;
  listingId: string;
  guestUserId: string;
}

export interface ReviewDeletedPayload {
  reviewId: string;
  listingId: string;
}

export interface NotificationRequestedPayload {
  userId: string;
  title: string;
  body: string;
  reference: string;
  amount: string;
  direction: string;
  event: string;
}
