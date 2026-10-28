import {
  agentRestoreDatabaseName,
  assertAgentRestoreWillNotOverwrite,
  assertCustomerSqlLogin,
  buildAgentRestoreSql,
  parseFileListOnlyOutput,
  parseInstanceDefaultDirs,
  planAgentRestore,
  quoteNvarchar,
  quoteSqlIdentifier,
} from '../../../../gates-migration-connector/src/local-restore-plan';

const DATA_DIR = 'C:\\Program Files\\Microsoft SQL Server\\MSSQL16.MSSQLSERVER\\MSSQL\\DATA\\';
const LOG_DIR = 'C:\\Program Files\\Microsoft SQL Server\\MSSQL16.MSSQLSERVER\\MSSQL\\DATA\\';

function plan(overrides: Partial<Parameters<typeof planAgentRestore>[0]> = {}) {
  return planAgentRestore({
    targetDb: 'GatesAgentRestore_GSyn251025T1',
    bakPath: 'C:\\GatesMigrationTest\\GSyn251025T1.bak',
    files: [
      { logicalName: 'GatesSyntheticSrc_dat', physicalName: 'C:\\GatesMigrationTest\\data\\GatesSyntheticSrc.mdf', type: 'D' },
      { logicalName: 'GatesSyntheticSrc_log', physicalName: 'C:\\GatesMigrationTest\\data\\GatesSyntheticSrc_log.ldf', type: 'L' },
    ],
    dataDir: DATA_DIR,
    logDir: LOG_DIR,
    existingDatabaseNames: ['master', 'GatesSyntheticSrc'],
    existingPhysicalPaths: [
      'C:\\GatesMigrationTest\\data\\GatesSyntheticSrc.mdf',
      'C:\\GatesMigrationTest\\data\\GatesSyntheticSrc_log.ldf',
    ],
    ...overrides,
  });
}

describe('customer agent local restore plan', () => {
  it('names a new database and refuses sa and overwrite', () => {
    const name = agentRestoreDatabaseName('legacy.bak');
    expect(name.startsWith('GatesAgentRestore_')).toBe(true);
    expect(() => assertCustomerSqlLogin('sa')).toThrow(/sa/);
    expect(() => assertAgentRestoreWillNotOverwrite([name], name)).toThrow(/already exists/);
    expect(() => assertAgentRestoreWillNotOverwrite([], 'LegacyDb')).toThrow(/GatesAgentRestore_/);
  });

  it('parses FILELISTONLY pipe output including extra columns', () => {
    const stdout = [
      'LogicalName|PhysicalName|Type|FileGroupName|Size',
      'LegacyForensic|C:\\data\\LegacyForensic.mdf|D|PRIMARY|8192',
      'LegacyForensic_log|C:\\data\\LegacyForensic_log.ldf|L|NULL|8192',
      '(2 rows affected)',
    ].join('\n');
    const files = parseFileListOnlyOutput(stdout);
    expect(files).toHaveLength(2);
    expect(files[0]).toEqual({
      logicalName: 'LegacyForensic',
      physicalName: 'C:\\data\\LegacyForensic.mdf',
      type: 'D',
    });
    expect(files[1].type).toBe('L');
  });

  it('rejects duplicate logical names in FILELISTONLY', () => {
    const stdout = [
      'dup|C:\\a.mdf|D',
      'dup|C:\\b.ldf|L',
    ].join('\n');
    expect(() => parseFileListOnlyOutput(stdout)).toThrow(/same logical file/);
  });

  it('parses instance default directories and skips the header row', () => {
    const stdout = ['data_path|log_path', `${DATA_DIR}|${LOG_DIR}`].join('\n');
    expect(parseInstanceDefaultDirs(stdout)).toEqual({ dataDir: DATA_DIR, logDir: LOG_DIR });
  });

  it('treats NULL instance default paths as missing so older SQL can fall back', () => {
    expect(() => parseInstanceDefaultDirs('data_path|log_path\nNULL|NULL')).toThrow(/Could not read/);
  });

  it('moves every data and log file onto unique paths under the SQL data directory', () => {
    const result = plan({
      files: [
        { logicalName: 'data1', physicalName: 'D:\\old\\a.mdf', type: 'D' },
        { logicalName: 'data2', physicalName: 'D:\\old\\b.ndf', type: 'D' },
        { logicalName: 'log1', physicalName: 'D:\\old\\c.ldf', type: 'L' },
        { logicalName: 'log2', physicalName: 'D:\\old\\d.ldf', type: 'L' },
      ],
    });
    expect(result.destinations).toEqual([
      `${DATA_DIR}GatesAgentRestore_GSyn251025T1.mdf`,
      `${DATA_DIR}GatesAgentRestore_GSyn251025T1_2.ndf`,
      `${LOG_DIR}GatesAgentRestore_GSyn251025T1_log.ldf`,
      `${LOG_DIR}GatesAgentRestore_GSyn251025T1_log2.ldf`,
    ]);
    expect(result.sql).toContain("MOVE N'data1'");
    expect(result.sql).toContain("MOVE N'data2'");
    expect(result.sql).toContain("MOVE N'log1'");
    expect(result.sql).toContain("MOVE N'log2'");
    expect(result.sql).not.toMatch(/D:\\old\\/);
    expect(result.sql).not.toMatch(/\bREPLACE\b/i);
    expect(result.sql).not.toMatch(/\bDROP\s+DATABASE\b/i);
    expect(new Set(result.destinations).size).toBe(4);
  });

  it('moves FILESTREAM containers to unique folders, not the source path', () => {
    const result = plan({
      files: [
        { logicalName: 'data1', physicalName: 'D:\\old\\a.mdf', type: 'D' },
        { logicalName: 'fs1', physicalName: 'D:\\old\\fs', type: 'S' },
        { logicalName: 'log1', physicalName: 'D:\\old\\c.ldf', type: 'L' },
      ],
    });
    expect(result.destinations).toContain(`${DATA_DIR}GatesAgentRestore_GSyn251025T1_fs`);
    expect(result.sql).toContain("MOVE N'fs1'");
  });

  it('rejects an existing destination database', () => {
    expect(() =>
      plan({ existingDatabaseNames: ['master', 'GatesAgentRestore_GSyn251025T1'] })
    ).toThrow(/already exists/);
  });

  it('rejects a destination path that is already in sys.master_files', () => {
    expect(() =>
      plan({
        existingPhysicalPaths: [`${DATA_DIR}GatesAgentRestore_GSyn251025T1.mdf`],
      })
    ).toThrow(/already in use/);
  });

  it('escapes malicious logical names and bak paths inside string literals', () => {
    const result = plan({
      bakPath: "C:\\bak\\a'; DROP DATABASE master; --.bak",
      files: [
        { logicalName: "foo' TO N'C:\\evil.mdf", physicalName: 'C:\\old\\a.mdf', type: 'D' },
        { logicalName: "log']; DROP DATABASE master; --", physicalName: 'C:\\old\\a.ldf', type: 'L' },
      ],
    });
    expect(result.sql).toContain(quoteNvarchar("C:\\bak\\a'; DROP DATABASE master; --.bak"));
    expect(result.sql).toContain(quoteNvarchar("foo' TO N'C:\\evil.mdf"));
    expect(result.sql).toContain(quoteNvarchar("log']; DROP DATABASE master; --"));
    const sqlCode = result.sql.replace(/N?'(?:''|[^'])*'/g, "''");
    expect(sqlCode).not.toMatch(/\bDROP\s+DATABASE\b/i);
    expect(result.sql).toContain(quoteSqlIdentifier('GatesAgentRestore_GSyn251025T1'));
  });

  it('ignores path-traversal in the backup physical name when choosing destinations', () => {
    const result = plan({
      files: [
        { logicalName: 'data1', physicalName: 'C:\\data\\..\\Windows\\System32\\evil.mdf', type: 'D' },
        { logicalName: 'log1', physicalName: '\\\\evil\\share\\x.ldf', type: 'L' },
      ],
    });
    expect(result.destinations.every((d) => d.startsWith(DATA_DIR) || d.startsWith(LOG_DIR))).toBe(true);
    expect(result.sql).not.toContain('System32');
    expect(result.sql).not.toContain('\\\\evil\\share');
  });

  it('rejects empty FILELISTONLY, missing log files, and unknown file types', () => {
    expect(() => plan({ files: [] })).toThrow(/no files/);
    expect(() =>
      plan({
        files: [{ logicalName: 'data1', physicalName: 'C:\\a.mdf', type: 'D' }],
      })
    ).toThrow(/data file and one log file/);
    expect(() =>
      plan({
        files: [
          { logicalName: 'data1', physicalName: 'C:\\a.mdf', type: 'D' },
          { logicalName: 'weird', physicalName: 'C:\\a.bak', type: 'X' },
        ],
      })
    ).toThrow(/Unsupported backup file type/);
  });

  it('buildAgentRestoreSql still returns MOVE SQL with no REPLACE', () => {
    const sql = buildAgentRestoreSql({
      targetDb: 'GatesAgentRestore_abc',
      bakPath: 'C:\\bak\\a.bak',
      files: [
        { logicalName: 'a', physicalName: 'C:\\old\\a.mdf', type: 'D' },
        { logicalName: 'b', physicalName: 'C:\\old\\b.ldf', type: 'L' },
      ],
      dataDir: DATA_DIR,
      logDir: LOG_DIR,
      existingDatabaseNames: [],
      existingPhysicalPaths: [],
    });
    expect(sql).toContain('RESTORE DATABASE');
    expect(sql).toContain('MOVE');
    expect(sql).not.toContain('REPLACE');
  });
});
