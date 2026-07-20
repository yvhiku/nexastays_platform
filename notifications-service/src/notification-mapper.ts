import type { CreateNotificationInput } from '@nexa/event-bus';
import {
  EVENTS,
  type BookingCancelledPayload,
  type BookingConfirmedPayload,
  type BookingHostApprovedPayload,
  type DomainEvent,
  type PaymentSucceededPayload,
  type ReviewCreatedPayload,
  type ReviewReminderPayload,
  type ReviewReplyPayload,
} from '@nexa/event-bus';

function bookingActionUrl(bookingId: string): string {
  return `/bookings/${bookingId}`;
}

function hostDashboardUrl(): string {
  return '/host/dashboard';
}

function guestBookingConfirmed(p: BookingConfirmedPayload): CreateNotificationInput {
  return {
    userId: p.guestUserId,
    type: 'BOOKING_CONFIRMED',
    title: 'Booking confirmed',
    body: 'Your booking is confirmed.',
    data: {
      action_url: bookingActionUrl(p.bookingId),
      booking_id: p.bookingId,
      listing_id: p.listingId,
    },
  };
}

function hostNewBooking(p: BookingConfirmedPayload): CreateNotificationInput {
  return {
    userId: p.hostUserId,
    type: 'HOST_NEW_BOOKING',
    title: 'New booking',
    body: 'You received a booking.',
    data: {
      action_url: hostDashboardUrl(),
      booking_id: p.bookingId,
      listing_id: p.listingId,
    },
  };
}

function guestPaymentReceived(p: PaymentSucceededPayload): CreateNotificationInput {
  return {
    userId: p.guestUserId,
    type: 'PAYMENT_RECEIVED',
    title: 'Payment successful',
    body: 'Payment successful.',
    data: {
      action_url: bookingActionUrl(p.bookingId),
      booking_id: p.bookingId,
    },
  };
}

function guestBookingCancelled(p: BookingCancelledPayload): CreateNotificationInput {
  return {
    userId: p.guestUserId,
    type: 'BOOKING_CANCELLED',
    title: 'Booking cancelled',
    body: 'Booking cancelled.',
    data: {
      action_url: bookingActionUrl(p.bookingId),
      booking_id: p.bookingId,
      listing_id: p.listingId,
    },
  };
}

function hostBookingCancelled(p: BookingCancelledPayload): CreateNotificationInput {
  const body =
    p.cancelledBy === 'guest'
      ? 'Guest cancelled reservation.'
      : 'Booking cancelled.';
  return {
    userId: p.hostUserId,
    type: 'HOST_BOOKING_CANCELLED',
    title: 'Booking cancelled',
    body,
    data: {
      action_url: hostDashboardUrl(),
      booking_id: p.bookingId,
      listing_id: p.listingId,
    },
  };
}

function guestHostApproved(p: BookingHostApprovedPayload): CreateNotificationInput {
  return {
    userId: p.guestUserId,
    type: 'HOST_BOOKING_APPROVED',
    title: 'Reservation accepted',
    body: 'Your reservation was accepted.',
    data: {
      action_url: bookingActionUrl(p.bookingId),
      booking_id: p.bookingId,
      listing_id: p.listingId,
    },
  };
}

function guestReviewReminder(p: ReviewReminderPayload): CreateNotificationInput {
  return {
    userId: p.guestUserId,
    type: 'REVIEW_REMINDER',
    title: 'Review your stay',
    body: 'Tell us about your stay.',
    data: {
      action_url: bookingActionUrl(p.bookingId),
      booking_id: p.bookingId,
      listing_id: p.listingId,
    },
  };
}

function hostGuestReview(p: ReviewCreatedPayload): CreateNotificationInput {
  return {
    userId: p.hostUserId,
    type: 'GUEST_REVIEW_RECEIVED',
    title: 'New review',
    body: 'A guest reviewed your stay.',
    data: {
      action_url: hostDashboardUrl(),
      booking_id: p.bookingId,
      listing_id: p.listingId,
      review_id: p.reviewId,
    },
  };
}

function reviewReply(p: ReviewReplyPayload): CreateNotificationInput {
  return {
    userId: p.recipientUserId,
    type: 'REVIEW_REPLY',
    title: 'Review reply',
    body: 'Someone replied to your review.',
    data: {
      action_url: bookingActionUrl(p.bookingId),
      booking_id: p.bookingId,
      listing_id: p.listingId,
      review_id: p.reviewId,
    },
  };
}

/** Map domain events to inbox notification inputs. */
export function mapDomainEventToNotifications(
  event: DomainEvent,
): CreateNotificationInput[] {
  switch (event.type) {
    case EVENTS.BOOKING_CONFIRMED: {
      const p = event.payload as unknown as BookingConfirmedPayload;
      return [guestBookingConfirmed(p), hostNewBooking(p)];
    }
    case EVENTS.PAYMENT_SUCCEEDED: {
      const p = event.payload as unknown as PaymentSucceededPayload;
      return [guestPaymentReceived(p)];
    }
    case EVENTS.BOOKING_CANCELLED: {
      const p = event.payload as unknown as BookingCancelledPayload;
      return [guestBookingCancelled(p), hostBookingCancelled(p)];
    }
    case EVENTS.BOOKING_HOST_APPROVED: {
      const p = event.payload as unknown as BookingHostApprovedPayload;
      return [guestHostApproved(p)];
    }
    case EVENTS.REVIEW_REMINDER: {
      const p = event.payload as unknown as ReviewReminderPayload;
      return [guestReviewReminder(p)];
    }
    case EVENTS.REVIEW_CREATED: {
      const p = event.payload as unknown as ReviewCreatedPayload;
      return [hostGuestReview(p)];
    }
    case EVENTS.REVIEW_REPLY: {
      const p = event.payload as unknown as ReviewReplyPayload;
      return [reviewReply(p)];
    }
    default:
      return [];
  }
}
