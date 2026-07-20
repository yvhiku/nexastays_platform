/** Canonical notification types — never hardcode strings in services. */
export const NOTIFICATION_TYPES = [
  'BOOKING_CONFIRMED',
  'PAYMENT_RECEIVED',
  'BOOKING_CANCELLED',
  'HOST_BOOKING_APPROVED',
  'REVIEW_REMINDER',
  'HOST_NEW_BOOKING',
  'HOST_BOOKING_CANCELLED',
  'GUEST_REVIEW_RECEIVED',
  'REVIEW_REPLY',
  'MESSAGE_RECEIVED',
] as const;

export type NotificationType = (typeof NOTIFICATION_TYPES)[number];

export interface CreateNotificationInput {
  userId: string;
  type: NotificationType;
  title: string;
  body: string;
  data?: Record<string, unknown>;
}

export interface PersistedNotification extends CreateNotificationInput {
  id: string;
  isRead: boolean;
  createdAt: Date;
  readAt: Date | null;
}
