import {
  EVENTS,
  type EventBusConsumer,
  type PaymentSucceededPayload,
} from '@nexa/event-bus';
import { StructuredLogger } from '@nexa/telemetry';

const logger = new StructuredLogger('fraud-detection-consumer');

/**
 * Fraud detection consumer — STUB.
 * Watches payment/booking events; real rules (velocity, amount anomaly,
 * device signals) plug in here without touching product services.
 */
export async function registerFraudDetectionConsumer(
  consumer: EventBusConsumer,
): Promise<void> {
  await consumer.subscribe(
    [EVENTS.PAYMENT_SUCCEEDED, EVENTS.BOOKING_CREATED],
    async (event) => {
      if (event.type === EVENTS.PAYMENT_SUCCEEDED) {
        const p = event.payload as unknown as PaymentSucceededPayload;
        const amount = Number(p.amount);
        if (Number.isFinite(amount) && amount >= 50_000) {
          logger.warn('fraud.high_value_payment', {
            eventId: event.id,
            bookingId: p.bookingId,
            amount: p.amount,
            currency: p.currency,
          });
        }
      }
    },
  );
}
