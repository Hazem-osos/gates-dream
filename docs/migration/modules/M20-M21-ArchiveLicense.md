# M20 Document Archive & M21 SaaS Licensing

Wave 4/5 foundation: polymorphic attachments (legacy `smAppArchive.pas`) and tenant subscription / module entitlements (legacy `smAppLisence.pas`).

## Schema

### `DocumentAttachment` (M20)

| Field | Notes |
|-------|--------|
| `entityType` | `INVOICE`, `JOURNAL_ENTRY`, `TREASURY_VOUCHER`, `EMPLOYEE`, `REAL_ESTATE_CONTRACT`, `PROJECT`, `CHEQUE` |
| `entityId` | Target record UUID |
| `storagePath` | Relative path from storage root |
| `fileUrl` | Optional public/API URL |
| `tags` | JSON string array |

Migration: `20250816280000_wave4_m20_m21_archive_license`

### `TenantSubscription` (M21)

| Field | Notes |
|-------|--------|
| `planType` | `LIFETIME` \| `SUBSCRIPTION` |
| `status` | `ACTIVE` \| `TRIAL` \| `EXPIRED` \| `SUSPENDED` |
| `allowedModules` | JSON array of module codes |
| `maxBranches`, `maxUsers`, `maxStorageMb` | Resource limits |
| `licenseKeyHash` | SHA-256 of activation key |

**Default behavior:** If no `TenantSubscription` row exists, all modules are allowed (legacy tenants). Once activated, entitlements and limits apply.

## M20 — Storage & API

- **`StorageProvider`** — `put` / `delete`; **`LocalDiskStorageProvider`** (`ARCHIVE_STORAGE_PATH` or `./storage/archive`).
- **`DocumentArchiveService`** — upload, list by entity, soft-delete + file purge; enforces `maxStorageMb` when subscription exists.

| Method | Path |
|--------|------|
| POST | `/api/v1/archive/upload` (JSON + `contentBase64`) |
| GET | `/api/v1/archive/:entityType/:entityId` |
| DELETE | `/api/v1/archive/:id` |

Permissions: `archive` resource (`view` / `edit` / `delete`).

## M21 — License service & guard

- **`LicenseSubscriptionService`** — `getCurrent`, `activate`, `assertModuleLicensed`.
- **`requireLicensedModule(code)`** — Express middleware; returns **403** when module not entitled or subscription inactive/expired.

Mounted on Real Estate and Schools route trees in `app.ts`.

| Method | Path |
|--------|------|
| GET | `/api/v1/subscriptions/current` |
| POST | `/api/v1/subscriptions/activate` |

Module codes: `ACCOUNTING`, `INVENTORY`, `POS`, `MANUFACTURING`, `CONTRACTING`, `REAL_ESTATE`, `SCHOOLS`, `PAYROLL`, `ETA`.

## Integration test

```bash
npm run prisma:generate && npm run prisma:deploy
npm run test:wave1-invoices   # if no posted invoice fixture
npm run test:wave4-archive-license
```

Validates invoice attachment lifecycle, restricted plan activation, and 403 on `REAL_ESTATE` / `SCHOOLS` via `assertModuleLicensed` (same logic as HTTP middleware).

## Follow-ups

- Multipart upload + S3 `StorageProvider` implementation.
- Global path-based guard using `ROUTE_MODULE_MAP` for remaining vertical prefixes.
- Branch/user count enforcement on create user/branch APIs.
