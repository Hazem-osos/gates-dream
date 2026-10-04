# eReceipt security

Device client secrets and pre-shared keys are encrypted with the same AES-GCM helper as other Gates secrets. API responses return `secretsConfigured` and never the secret or the pre-shared key. Token requests happen on the server. The access token is cached in process memory and is not logged.

Logs pass through a redaction step for fields named like secret, token, preshared key, authorization or PIN.

Every query is scoped by the authenticated company. The terminal id on a device save must belong to that company. The POS client does not send the ETA serial or the previous UUID. Those come from the posted order's terminal and the locked chain.

Permissions:

- `ereceipt` `view` for the list, detail, submissions and readiness
- `ereceipt` `edit` for settings and devices
- `ereceipt` `post` for retry, sync and the drain
- `ereceipt` `approve` for correction, late reason and return without reference

Settings, device, retry and correction writes are logged with company, terminal or receipt id and user id.

A receipt frozen in `PREPRODUCTION` is submitted only with that device's pre-production identity and host.
