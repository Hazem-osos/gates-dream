// Polls a job until it has changed since <sinceIso> and is no longer running.
// Usage: node poll.mjs <jobId> <tokenFile> <sinceIso>
import fs from 'node:fs';

const [jobId, tokenFile, sinceIso] = process.argv.slice(2);
const since = Date.parse(sinceIso ?? new Date(0).toISOString());
const token = fs.readFileSync(tokenFile, 'utf8').trim();
const end = Date.now() + 25 * 60 * 1000;
let last = '';
for (;;) {
  const r = await fetch(`http://127.0.0.1:4055/api/v1/migration-engine/jobs/${jobId}`, {
    headers: { authorization: `Bearer ${token}` },
    signal: AbortSignal.timeout(120000),
  }).catch((e) => ({ ok: false, json: async () => ({ error: String(e) }) }));
  const body = await r.json();
  const j = body.data?.job ?? body.data ?? {};
  const ui = j.progress?.ui ?? {};
  const updated = Date.parse(j.updatedAt ?? 0);
  const running = /RUNNING|QUEUED|ANALYZING|EXECUTING|RECONCILING|PENDING|IN_PROGRESS/i.test(String(j.status));
  const line = `${j.status} stage=${j.currentStage} phase=${j.progress?.lifecycle?.phase} mode=${ui.pipelineMode} err=${ui.lastError ? String(ui.lastError).slice(0, 300) : '-'}`;
  if (line !== last) {
    console.log(new Date().toISOString().slice(11, 19), line);
    last = line;
  }
  const finishedAfterStart = updated > since && !running && (ui.workerFinishedAt || ui.lastFailedAt || ui.lastError || Date.now() - updated > 8000);
  if (finishedAfterStart) {
    fs.writeFileSync(`${process.env.GATES_E2E_WORK ?? `${process.env.HOME}/.gates-migration-e2e`}/e2e-out/job-final.json`, JSON.stringify(j, null, 2));
    break;
  }
  if (Date.now() > end) {
    console.log('POLL TIMEOUT');
    break;
  }
  await new Promise((res) => setTimeout(res, 3000));
}
