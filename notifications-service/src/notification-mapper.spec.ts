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
      eventId: 'evt-1',
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
        event_id: 'evt-1',
      },
    });
  });
});

describe('notification-mapper booking/payment events (audit 067-069)', () => {
  const bookingPayload = {
    bookingId: 'booking-9',
    listingId: 'listing-9',
    guestUserId: 'guest-9',
    hostUserId: 'host-9',
  };

  it('maps BOOKING_CONFIRMED to guest + host notifications', () => {
    const inputs = mapDomainEventToNotifications({
      id: 'evt-bc',
      source: 'stays',
      type: EVENTS.BOOKING_CONFIRMED,
      payload: bookingPayload,
      occurredAt: new Date().toISOString(),
    });
    expect(inputs).toHaveLength(2);
    expect(inputs.map((i) => i.type).sort()).toEqual([
      'BOOKING_CONFIRMED',
      'HOST_NEW_BOOKING',
    ]);
    expect(inputs.find((i) => i.type === 'BOOKING_CONFIRMED')?.userId).toBe(
      'guest-9',
    );
    expect(inputs.find((i) => i.type === 'HOST_NEW_BOOKING')?.userId).toBe(
      'host-9',
    );
  });

  it('maps PAYMENT_SUCCEEDED to guest payment notification', () => {
    const inputs = mapDomainEventToNotifications({
      id: 'evt-pay',
      source: 'stays',
      type: EVENTS.PAYMENT_SUCCEEDED,
      payload: {
        bookingId: 'booking-9',
        guestUserId: 'guest-9',
        amount: 100,
        currency: 'MAD',
      },
      occurredAt: new Date().toISOString(),
    });
    expect(inputs).toHaveLength(1);
    expect(inputs[0]).toMatchObject({
      userId: 'guest-9',
      type: 'PAYMENT_RECEIVED',
      eventId: 'evt-pay',
    });
  });

  it('maps BOOKING_CANCELLED to guest + host notifications', () => {
    const inputs = mapDomainEventToNotifications({
      id: 'evt-cancel',
      source: 'stays',
      type: EVENTS.BOOKING_CANCELLED,
      payload: { ...bookingPayload, cancelledBy: 'guest' },
      occurredAt: new Date().toISOString(),
    });
    expect(inputs).toHaveLength(2);
    expect(inputs.map((i) => i.type).sort()).toEqual([
      'BOOKING_CANCELLED',
      'HOST_BOOKING_CANCELLED',
    ]);
  });
});
