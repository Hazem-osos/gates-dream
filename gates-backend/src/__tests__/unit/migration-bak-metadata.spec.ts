import {
  buildRestoreDatabaseSql,
  buildRestoreMoveClauses,
  parseDatabaseState,
  parseFileListOnlyOutput,
  parseHeaderOnlyOutput,
} from '../../modules/migration-engine/services/migration-bak-metadata.service';

describe('migration-bak-metadata', () => {
  it('parses FILELISTONLY pipe output', () => {
    const stdout = [
      'LogicalName|PhysicalName|Type',
      'LegacyForensic|C:\\data\\LegacyForensic.mdf|D',
      'LegacyForensic_log|C:\\data\\LegacyForensic_log.ldf|L',
    ].join('\n');
    const files = parseFileListOnlyOutput(stdout);
    expect(files).toHaveLength(2);
    expect(files[0].logicalName).toBe('LegacyForensic');
    expect(files[1].type).toBe('L');
  });

  it('builds dynamic MOVE clauses', () => {
    const { moveSql, dataLogical, logLogical } = buildRestoreMoveClauses('GatesLegacyRestore_abcd', [
      { logicalName: 'LegacyForensic', physicalName: 'x', type: 'D' },
      { logicalName: 'LegacyForensic_log', physicalName: 'y', type: 'L' },
    ]);
    expect(dataLogical).toBe('LegacyForensic');
    expect(logLogical).toBe('LegacyForensic_log');
    expect(moveSql).toContain("MOVE 'LegacyForensic'");
    expect(moveSql).toContain("MOVE 'LegacyForensic_log'");
  });

  it('parses HEADERONLY header row', () => {
    const stdout = ['DatabaseName|BackupSize|BackupType', 'MyLegacy|1048576|1'].join('\n');
    const h = parseHeaderOnlyOutput(stdout);
    expect(h.databaseName).toBe('MyLegacy');
    expect(h.backupSizeBytes).toBe(1048576);
    expect(h.backupType).toBe('1');
  });

  it('does not treat an online database as absent', () => {
    expect(parseDatabaseState('ONLINE')).toBe('ONLINE');
    expect(parseDatabaseState('ABSENT')).toBe('ABSENT');
    expect(parseDatabaseState('RESTORING')).toBe('RESTORING');
  });

  it('builds RESTORE DATABASE sql without hard-coded logical names', () => {
    const sql = buildRestoreDatabaseSql(
      'GatesLegacyRestore_abcd',
      '/var/opt/mssql/data/backups/p1.bak',
      "MOVE 'AnyLogical' TO N'/var/opt/mssql/data/GatesLegacyRestore_abcd.mdf'"
    );
    expect(sql).toContain('FROM DISK');
    expect(sql).not.toContain('REPLACE');
    expect(sql).not.toContain('LegacyForensic');
  });
});
