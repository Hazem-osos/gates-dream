import { describe, expect, it } from 'vitest';
import { normalizeSqlHostPort, parseMssqlConnectionString } from './parse-mssql-connection-string';

describe('normalizeSqlHostPort', () => {
  it('splits comma port', () => {
    expect(normalizeSqlHostPort('sql.office.local,1433', '1433')).toEqual({
      host: 'sql.office.local',
      port: '1433',
    });
  });

  it('splits colon port', () => {
    expect(normalizeSqlHostPort('203.0.113.10:14333', '')).toEqual({
      host: '203.0.113.10',
      port: '14333',
    });
  });

  it('keeps instance names with backslash', () => {
    expect(normalizeSqlHostPort('HOST\\SQLEXPRESS', '1433')).toEqual({
      host: 'HOST\\SQLEXPRESS',
      port: '1433',
    });
  });
});

describe('parseMssqlConnectionString', () => {
  it('fills host and port from Server=host,port', () => {
    const parsed = parseMssqlConnectionString(
      'Server=sql.office.local,1433;Database=Legacy;User Id=sa;Password=x;'
    );
    expect(parsed).toMatchObject({ host: 'sql.office.local', port: '1433', database: 'Legacy', user: 'sa' });
  });
});
