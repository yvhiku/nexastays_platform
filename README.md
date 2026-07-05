# Nexa Platform Services

Shared infrastructure used across Nexa product backends (Stays, Pay, Go).

## Services & libraries

| Component | Port | Path | Purpose |
|-----------|------|------|---------|
| Event bus | — | `platform/event-bus/` | `@nexa/event-bus` — Redis Streams pub/sub, event contracts, retry queue + DLQ, circuit breaker utils |
| Telemetry | — | `platform/telemetry/` | `@nexa/telemetry` — structured JSON logging, traceId propagation, optional OpenTelemetry bootstrap |
| Identity read model | — | `platform/identity-read-model/` | `@nexa/identity-read-model` — Redis-cached identity snapshots with Identity API fallback |
| Notifications | 3003 | `platform/notifications-service/` | Multi-channel dispatcher (FCM live, email/SMS stubs); consumes booking/payment events |
| Media | 3004 | `platform/media-service/` | Upload API, metadata store, HMAC signed URLs, local/S3 storage backends |
| Consumers | — | `platform/consumers/` | Analytics, audit, fraud-detection (stub), identity-cache invalidation |

## Event governance

Events are **versioned and schema-validated**. Publish only via the registry:

```ts
import { EVENTS } from '@nexa/event-bus';

EVENTS.BOOKING_CREATED    // 'booking.created.v1'
EVENTS.BOOKING_CONFIRMED  // 'booking.confirmed.v1'
EVENTS.PAYMENT_SUCCEEDED  // 'payment.succeeded.v1'
EVENTS.KYC_UPDATED        // 'kyc.updated.v1'
EVENTS.LISTING_PUBLISHED  // 'listing.published.v1'
```

- Payloads are validated with Zod at publish time (`contracts/schemas.ts`).
- Invalid events **throw `EventValidationError`** — rejected and logged, never silently published.
- Unversioned legacy names are normalized to `.v1` on the consumer side.
- New event shape = new version (`booking.confirmed.v2`) added to the registry.

| Event | Publisher | Consumer(s) |
|-------|-----------|-------------|
| `booking.created.v1` | Stays | fraud-detection, analytics, audit |
| `booking.confirmed.v1` | Stays | notifications-service, analytics, audit |
| `payment.succeeded.v1` | Stays | notifications-service, fraud-detection, analytics, audit |
| `listing.published.v1` | Stays admin | analytics, audit |
| `kyc.updated.v1` | Identity admin | identity-cache (invalidates read model), analytics, audit |

## Reliability

- **Publisher**: Redis outage → events buffered in a bounded in-memory queue, auto-flushed when Redis recovers. Overflow drops are logged.
- **Consumer**: handler failure → per-group Redis retry queue with exponential backoff (2s → 4s → 8s → …, max 5 attempts) → `nexa:events:dlq` dead-letter stream with structured error log.
- **HTTP calls** (identity snapshot, media, notifications fallback): retry with backoff + circuit breaker (`CircuitBreaker`, `retryWithBackoff` from `@nexa/event-bus`).

## Identity read model

Stays resolves KYC/identity state cache-first:

```
Stays → IdentityReadModel → Redis (nexa:identity:read-model:{userId}, TTL 120s)
                        ↘ miss/expiry → Identity GET /snapshots/me (retry + circuit breaker)
kyc.updated.v1 → identity-cache consumer → invalidates the Redis key
```

## Observability

Every service emits one JSON log line per request via `@nexa/telemetry`:

```json
{"level":"info","service":"nexa-stays","event":"http.request","traceId":"…","userId":"…","method":"POST","path":"/api/v1/bookings","status":201,"latencyMs":42,"ts":"…"}
```

- `x-trace-id` (or W3C `traceparent`) is propagated between services and echoed back on responses.
- Sinks are pluggable (`LogSink`) — console JSON now; Loki/Datadog/ELK shippers later without touching call sites.
- `initOpenTelemetry(service)` activates full OTel tracing when `@opentelemetry/sdk-node` + `@opentelemetry/auto-instrumentations-node` are installed; safe no-op otherwise.

## Quick start

### 1. Start Postgres + Redis

```powershell
docker compose -f database/docker-compose.yml up -d
```

### 2. Install + build platform packages

```powershell
cd platform
npm run install:all
```

### 3. Configure env

```powershell
copy backend\identity\.env.example backend\identity\.env
copy backend\stays\.env.example backend\stays\.env
copy platform\notifications-service\.env.example platform\notifications-service\.env
copy platform\media-service\.env.example platform\media-service\.env
```

Required shared variables:

```env
REDIS_URL=redis://127.0.0.1:6379
NOTIFICATIONS_SERVICE_URL=http://127.0.0.1:3003
INTERNAL_SERVICE_KEY=dev-internal-key
# Optional — route Stays uploads through the media service instead of local disk:
# MEDIA_SERVICE_URL=http://127.0.0.1:3004
```

### 4. Run services

```powershell
# Terminal 1 — Identity (:3001)
cd backend\identity ; npm run start:dev

# Terminal 2 — Stays (:3002)
cd backend\stays ; npm run start:dev

# Terminal 3 — Notifications (:3003)
cd platform ; npm run start:notifications

# Terminal 4 — Media (:3004)
cd platform ; npm run start:media

# Terminal 5 — Event consumers (analytics/audit/fraud/identity-cache)
cd platform ; npm run start:consumers
```

### 5. FCM (optional)

Set `FCM_SERVICE_ACCOUNT_JSON` or `FCM_SERVICE_ACCOUNT_PATH` in notifications-service `.env`. Without Firebase credentials, push is skipped silently. Email/SMS channels activate with `EMAIL_PROVIDER` / `SMS_PROVIDER` (stub implementations until a provider is wired).

## Media service API

```
POST /api/v1/media/upload       multipart {file, ownerService, ownerUserId?, prefix?}   [X-Internal-Key]
POST /api/v1/media/signed-url   {storageKey, ttlSeconds?}                               [X-Internal-Key]
GET  /api/v1/media/file?key=&exp=&sig=    public download via HMAC signed URL
```

Storage backend is selected with `MEDIA_STORAGE_BACKEND` (`local` default, `s3` for S3/MinIO/R2 — install `@aws-sdk/client-s3`).

## Architecture rules (ESLint-enforced)

- **Identity** never imports Stays or product internals.
- **Stays** never imports Identity internals — only JWT, `IdentityReadModel`, events, and the snapshot API.
- **Legacy** Pay/Go code in `backend/identity/src/legacy/` is build-excluded and ESLint-blocked.
- **KYC** is never read from JWT — use the identity read model / snapshot API.
- Cross-service communication: events (preferred) or HTTP queries. No shared DB, no shared internal modules.

See [`docs/ECOSYSTEM_ARCHITECTURE.md`](../docs/ECOSYSTEM_ARCHITECTURE.md) for the full team reference.
