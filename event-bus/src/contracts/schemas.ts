import { z } from 'zod';
import type { DomainEventType } from '../event-types';

const nonEmpty = z.string().min(1);

export const EVENT_SCHEMAS: Record<DomainEventType, z.ZodType<Record<string, unknown>>> = {
  'booking.created.v1': z
    .object({
      bookingId: nonEmpty,
      listingId: nonEmpty,
      guestUserId: nonEmpty,
    })
    .passthrough(),

  'booking.confirmed.v1': z
    .object({
      bookingId: nonEmpty,
      listingId: nonEmpty,
      hostUserId: nonEmpty,
      guestUserId: nonEmpty,
      amount: nonEmpty,
      currency: nonEmpty,
    })
    .passthrough(),

  'payment.succeeded.v1': z
    .object({
      bookingId: nonEmpty,
      provider: nonEmpty,
      providerIntentId: nonEmpty,
      amount: nonEmpty,
      currency: nonEmpty,
    })
    .passthrough(),

  'booking.completed.v1': z
    .object({
      bookingId: nonEmpty,
      listingId: nonEmpty,
      hostUserId: nonEmpty,
      guestUserId: nonEmpty,
      checkoutDate: nonEmpty,
    })
    .passthrough(),

  'payment.expired.v1': z
    .object({
      bookingId: nonEmpty,
      listingId: nonEmpty,
      guestUserId: nonEmpty,
    })
    .passthrough(),

  'kyc.updated.v1': z
    .object({
      userId: nonEmpty,
      unifiedIdentityId: z.string(),
      kycStatus: nonEmpty,
      kycTier: z.string(),
      kycLevel: z.number(),
    })
    .passthrough(),

  'listing.published.v1': z
    .object({
      listingId: nonEmpty,
      hostUserId: nonEmpty,
    })
    .passthrough(),

  'review.created.v1': z
    .object({
      reviewId: nonEmpty,
      bookingId: nonEmpty,
      listingId: nonEmpty,
      hostUserId: nonEmpty,
      guestUserId: nonEmpty,
      rating: nonEmpty,
    })
    .passthrough(),

  'review.updated.v1': z
    .object({
      reviewId: nonEmpty,
      listingId: nonEmpty,
      guestUserId: nonEmpty,
    })
    .passthrough(),

  'review.deleted.v1': z
    .object({
      reviewId: nonEmpty,
      listingId: nonEmpty,
    })
    .passthrough(),
};
