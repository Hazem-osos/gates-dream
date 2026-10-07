# Payroll Localization

## Architecture

```
Global payroll core (rule engine + context)
        +
Country pack (HcmPayrollLocalizationConfig + provider hooks)
```

`payroll-localization.service.ts` builds `statutory_*` facts from:

1. Company `HrSettings` (existing insurance/tax rates — compatibility)
2. Effective-dated `HcmPayrollLocalizationConfig` rows (`configKey` + `configJson`)

## Egypt / Saudi foundation

- **No invented legal rates** in source code.
- Tables: `TAX_BRACKETS`, `INSURANCE_CAP`, GOSI keys (SA) via config JSON.
- Country from employment snapshot (`countryCode`; default `EG` until legal entity model wired).

## Multi-country

Same engine; rules may set `localizationKey` to scope statutory rule sets.
