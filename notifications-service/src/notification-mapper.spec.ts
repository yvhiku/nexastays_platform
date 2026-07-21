import { EVENTS } from '@nexa/event-bus';
import { mapDomainEventToNotifications } from './notification-mapper';

describe('notification-mapper MESSAGE_RECEIVED', () => {
  it('maps rich push payload with conversation_version and last_message_id', () => {
    const inputs = mapDomainEventToNotifications({
      id: 'evt-1',
      source: 'stays',
      type: EVENTS.MESSAGE_RECEIVED,
      payload: {
        messageId: 'msg-1',
        conversationId: 'conv-1',
        recipientUserId: 'user-1',
        senderUserId: 'user-2',
        senderName: 'Host Name',
        preview: 'See you at check-in',
        bookingId: 'booking-1',
        conversationVersion: 9,
        lastMessageId: 'msg-1',
        lastMessageSequence: 15,
        listingTitle: 'Riad Atlas',
      },
      occurredAt: new Date().toISOString(),
    });

    expect(inputs).toHaveLength(1);
    expect(inputs[0]).toMatchObject({
      userId: 'user-1',
      type: 'MESSAGE_RECEIVED',
      title: 'Host Name sent you a message',
      data: {
        action_url: '/inbox/conv-1',
        conversation_id: 'conv-1',
        message_id: 'msg-1',
        last_message_id: 'msg-1',
        last_message_sequence: 15,
        conversation_version: 9,
        listing_title: 'Riad Atlas',
        sender_name: 'Host Name',
        preview: 'See you at check-in',
      },
    });
  });
});
