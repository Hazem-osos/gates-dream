import { describe, expect, it } from 'vitest';
import { localizeApiErrorMessage } from '../api/localize-api-error-message';
import { explainMigrationEngineAlert } from './capability-messages';

describe('explainMigrationEngineAlert', () => {
  it('maps DRAFT execute and lock errors to Arabic', () => {
    expect(explainMigrationEngineAlert('Job abc cannot run in status DRAFT')).toMatch(/إيقاف التشغيل/);
    expect(explainMigrationEngineAlert('Job abc is locked by another runner.')).toMatch(/إيقاف التشغيل/);
  });

  it('maps missing legacy SQL and bak-restore-disabled', () => {
    expect(explainMigrationEngineAlert('No legacy SQL source configured for this company.')).toMatch(
      /مصدر SQL القديم غير جاهز/
    );
    expect(explainMigrationEngineAlert('Isolated SQL Server host not configured')).toMatch(/bak/i);
  });

  it('maps connector provisional fingerprint mismatch', () => {
    expect(
      explainMigrationEngineAlert(
        'Source fingerprint mismatch for job 4ecf3616-a274-40ab-a65d-a6ec87229bc8. Expected connector:e2395060-9224-4d9a-9b59-8e6d0da14589, got abc.'
      )
    ).toMatch(/تحليل المصدر/);
  });

  it('maps illegal dry-run stage transition', () => {
    expect(explainMigrationEngineAlert('Illegal migration job transition: READY → DRY_RUNNING')).toMatch(
      /إيقاف التشغيل/
    );
  });

  it('maps a mid-run lock to abort copy', () => {
    expect(explainMigrationEngineAlert('Migration job abc is already running')).toMatch(/إيقاف التشغيل/);
    expect(
      explainMigrationEngineAlert('مهمة الترحيل شغالة الآن. اضغط «إيقاف التشغيل» ثم أعد التحليل أو المعاينة.')
    ).toMatch(/إيقاف التشغيل/);
  });

  it('maps missing RemainingValue column', () => {
    expect(explainMigrationEngineAlert("Invalid column name 'RemainingValue'.")).toMatch(/الصافي/);
  });

  it('maps other missing SQL columns in Arabic', () => {
    expect(explainMigrationEngineAlert("Invalid column name 'NetValue'.")).toMatch(/NetValue/);
  });
});

describe('migration SQL host localization', () => {
  it('does not blame host,port when DNS of a clean hostname fails', () => {
    const ar = localizeApiErrorMessage(
      'SQL Server host «sql.office.local» could not be resolved from this server. Cloud/Railway cannot see office LAN names.'
    );
    expect(ar).toMatch(/Railway|موصل|bak/i);
    expect(ar).not.toMatch(/host,1433/);
  });

  it('maps packed host,port separately', () => {
    expect(
      localizeApiErrorMessage(
        'SQL Server host «sql.office.local,1433» looks like host,port in one field. Put hostname or IP in Host and the port in Port (not host,1433).'
      )
    ).toMatch(/خانة واحدة/);
  });

  it('maps a dead Windows agent timeout to keep-window Arabic', () => {
    expect(localizeApiErrorMessage('Connector command timed out waiting for result')).toMatch(
      /نافذة البرنامج|ويندوز/
    );
  });
});
