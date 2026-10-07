# HCM Time Device Adapters

Formal boundary: `TimeDeviceAdapter` in `services/time/adapters/time-device-adapter.types.ts`.

Implementations:

- `manual-device.adapter.ts` — API/manual punches
- `csv-device.adapter.ts` — CSV import rows → normalized punches

Core ingestion remains `punchIngestionService.ingest` (dedupe, mapping, logical work date, recalc).
