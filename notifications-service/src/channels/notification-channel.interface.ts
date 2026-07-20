export interface NotificationPayload {
  userId: string;
  notificationId: string;
  type: string;
  title: string;
  body: string;
  reference: string;
  amount: string;
  direction: string;
  event: string;
  actionUrl?: string;
  /** Rich FCM data passthrough (conversation_id, conversation_version, …). */
  data?: Record<string, string>;
  /** Optional channel-specific extras (email address, phone number, …). */
  meta?: Record<string, string>;
}

export type NotificationChannelName = 'push' | 'email' | 'sms';

/**
 * One implementation per delivery channel.
 * The dispatcher fans a notification out to all enabled channels.
 */
export interface NotificationChannel {
  readonly name: NotificationChannelName;
  isEnabled(): boolean;
  send(notification: NotificationPayload): Promise<void>;
}
