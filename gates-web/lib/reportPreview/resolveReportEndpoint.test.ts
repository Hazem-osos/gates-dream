import { resolveReportApiPath, ensureReportPreviewDates } from './resolveReportEndpoint';

function assert(cond: unknown, message: string) {
  if (!cond) throw new Error(message);
}

assert(resolveReportApiPath('pos/daily') === '/pos/daily-report', 'pos daily api path');
assert(
  ensureReportPreviewDates({}, 'pos/daily').date?.length === 10,
  'pos daily fills date'
);
assert(
  ensureReportPreviewDates({ date: '2026-09-17' }, 'pos/daily').date === '2026-09-17',
  'pos daily keeps date'
);

console.log('resolveReportEndpoint.test.ts ok');
