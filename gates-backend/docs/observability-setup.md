# Observability setup

## Metrics

- The backend exposes `GET /metrics` (Prometheus format) when the metrics collector is enabled in code.
- Use `monitoring/prometheus.yml` in this repo as a starting scrape config.

## Logs

- Structured JSON logs via Pino — ship stdout to Loki, CloudWatch, or ELK.
- Avoid logging secrets; redaction is configured in `src/shared/logger.ts`.

## Tracing

- OpenTelemetry is initialized from `src/shared/monitoring/tracing.ts` when enabled.

## Alerts (recommended)

- API **5xx** rate, **latency p95**, **DB connection** failures, **Redis** down, **queue** depth (BullMQ).

## Dashboards

- Import service health from `/health` JSON (status, dependencies).
