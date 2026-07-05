/**
 * Optional OpenTelemetry bootstrap.
 *
 * Fully functional distributed tracing is enabled by installing:
 *   npm i @opentelemetry/sdk-node @opentelemetry/auto-instrumentations-node
 * and setting OTEL_EXPORTER_OTLP_ENDPOINT.
 *
 * Without those packages this is a safe no-op, so services can ship
 * OTel-ready today and turn tracing on via deployment config.
 */
export function initOpenTelemetry(serviceName: string): void {
  if (process.env.OTEL_DISABLED === 'true') return;
  try {
    // Dynamic require — optional dependency.
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { NodeSDK } = require('@opentelemetry/sdk-node');
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { getNodeAutoInstrumentations } = require('@opentelemetry/auto-instrumentations-node');

    const sdk = new NodeSDK({
      serviceName,
      instrumentations: [getNodeAutoInstrumentations()],
    });
    sdk.start();

    process.on('SIGTERM', () => {
      void sdk.shutdown();
    });

    console.log(
      JSON.stringify({
        level: 'info',
        service: serviceName,
        event: 'otel.started',
        ts: new Date().toISOString(),
      }),
    );
  } catch {
    // OTel packages not installed — structured logging still provides traceIds.
  }
}
