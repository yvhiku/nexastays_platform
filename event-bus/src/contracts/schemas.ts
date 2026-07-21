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
      guestUserId: nonEmpty,
      provider: nonEmpty,
      providerIntentId: nonEmpty,
      amount: nonEmpty,
      currency: nonEmpty,
    })
    .passthrough(),

  'booking.cancelled.v1': z
    .object({
      bookingId: nonEmpty,
      listingId: nonEmpty,
      guestUserId: nonEmpty,
      hostUserId: nonEmpty,
      cancelledBy: z.enum(['guest', 'host']),
    })
    .passthrough(),

  'booking.host_approved.v1': z
    .object({
      bookingId: nonEmpty,
      listingId: nonEmpty,
      guestUserId: nonEmpty,
      hostUserId: nonEmpty,
    })
    .passthrough(),

  'review.reminder.v1': z
    .object({
      bookingId: nonEmpty,
      listingId: nonEmpty,
      guestUserId: nonEmpty,
      listingTitle: z.string().optional(),
    })
    .passthrough(),

  'booking.checkout_reminder.v1': z
    .object({
      bookingId: nonEmpty,
      listingId: nonEmpty,
      guestUserId: nonEmpty,
      listingTitle: z.string().optional(),
      checkoutAt: z.string().optional(),
    })
    .passthrough(),

  'review.reply.v1': z
    .object({
      reviewId: nonEmpty,
      bookingId: nonEmpty,
      listingId: nonEmpty,
      recipientUserId: nonEmpty,
      authorUserId: nonEmpty,
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

  'message.received.v1': z
    .object({
      messageId: nonEmpty,
      conversationId: nonEmpty,
      recipientUserId: nonEmpty,
      senderUserId: nonEmpty,
      preview: z.string(),
    })
    .passthrough(),

  'message.sent.v1': z
    .object({
      messageId: nonEmpty,
      conversationId: nonEmpty,
      senderUserId: nonEmpty,
    })
    .passthrough(),

  'message.read.v1': z
    .object({
      conversationId: nonEmpty,
      readerUserId: nonEmpty,
    })
    .passthrough(),

  'conversation.archived.v1': z
    .object({
      bookingId: nonEmpty,
      listingId: nonEmpty,
      conversationId: nonEmpty,
      guestUserId: nonEmpty,
      hostUserId: nonEmpty,
      listingTitle: z.string().optional(),
    })
    .passthrough(),
};
