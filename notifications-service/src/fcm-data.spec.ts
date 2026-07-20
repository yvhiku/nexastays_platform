import { toFcmDataFields } from './fcm-data';

describe('toFcmDataFields', () => {
  it('stringifies rich messaging sync fields for FCM', () => {
    expect(
      toFcmDataFields({
        conversation_id: 'conv-1',
        message_id: 'msg-1',
        last_message_id: 'msg-1',
        conversation_version: 7,
        last_message_sequence: 42,
        preview: 'Hello',
        listing_title: 'Riad',
        sender_name: 'Host',
        action_url: '/inbox/conv-1',
      }),
    ).toEqual({
      conversation_id: 'conv-1',
      message_id: 'msg-1',
      last_message_id: 'msg-1',
      conversation_version: '7',
      last_message_sequence: '42',
      preview: 'Hello',
      listing_title: 'Riad',
      sender_name: 'Host',
      action_url: '/inbox/conv-1',
    });
  });

  it('omits null and empty values', () => {
    expect(toFcmDataFields({ a: null, b: '', c: 'ok' })).toEqual({ c: 'ok' });
  });
});
