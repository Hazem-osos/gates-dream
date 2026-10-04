# Gates E-Sign Agent (download and detection)

Page: **Electronic invoices → Invoice settings** (`/electronic-invoices/settings`).

The page probes `https://127.0.0.1:17891/health` with a 1.5s timeout. It does **not** call `/sign`. Invoice send is unchanged.

Download:

1. Backend metadata `GET /api/v1/electronic-invoices/esign-agent/latest`
2. Else `NEXT_PUBLIC_GATES_ESIGN_DOWNLOAD_URL`
3. Else same-origin `/downloads/GatesESignSetup.exe`

Production should use a CDN/object-storage URL. Local/dev can use the file copied by the agent release script.
