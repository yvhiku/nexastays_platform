jest.mock('./services/notification-inbox.service', () => ({
  NotificationInboxService: class NotificationInboxService {},
}));
jest.mock('./notification-dispatcher.service', () => ({
  NotificationDispatcherService: class NotificationDispatcherService {},
}));

import { NotificationOrchestratorService } from './notification-orchestrator.service';

describe('NotificationOrchestratorService idempotency', () => {
  it('skips push when inbox returns an existing row', async () => {
    const existing = { id: 'n-1', type: 'BOOKING_CONFIRMED', user_id: 'u-1' };
    const inbox = {
      create: jest.fn().mockResolvedValue({ notification: existing, created: false }),
    };
    const dispatcher = { dispatchPush: jest.fn() };
    const orch = new NotificationOrchestratorService(
      inbox as never,
      dispatcher as never,
    );

    const result = await orch.process({
      userId: 'u-1',
      type: 'BOOKING_CONFIRMED',
      title: 't',
      body: 'b',
      eventId: 'evt-1',
    });

    expect(result).toBe(existing);
    expect(dispatcher.dispatchPush).not.toHaveBeenCalled();
  });

  it('dispatches push for newly created rows', async () => {
    const created = { id: 'n-2', type: 'BOOKING_CONFIRMED', user_id: 'u-1' };
    const inbox = {
      create: jest.fn().mockResolvedValue({ notification: created, created: true }),
    };
    const dispatcher = { dispatchPush: jest.fn().mockResolvedValue(undefined) };
    const orch = new NotificationOrchestratorService(
      inbox as never,
      dispatcher as never,
    );

    await orch.process({
      userId: 'u-1',
      type: 'BOOKING_CONFIRMED',
      title: 't',
      body: 'b',
      eventId: 'evt-2',
    });

    expect(dispatcher.dispatchPush).toHaveBeenCalledWith(created);
  });
});
