import {
  LEGACY_SQL_CONNECT_ATTEMPTS,
  parseLegacyAdoUrl,
  parseLegacyServer,
} from '../../../../gates-migration-connector/src/mssql-connect';

describe('legacy SQL Server connection helpers', () => {
  it('parses default instance, named instance, and host,port', () => {
    expect(parseLegacyServer('localhost')).toEqual({ server: 'localhost' });
    expect(parseLegacyServer('localhost\\SQLEXPRESS')).toEqual({
      server: 'localhost',
      instanceName: 'SQLEXPRESS',
    });
    expect(parseLegacyServer('127.0.0.1,1433')).toEqual({ server: '127.0.0.1', port: 1433 });
  });

  it('parses an ADO connection string', () => {
    const parsed = parseLegacyAdoUrl(
      'Server=localhost\\SQL2008;Database=LegacyDb;User Id=gates_reader;Password=secret;Encrypt=false;TrustServerCertificate=true'
    );
    expect(parsed).toEqual({
      server: 'localhost\\SQL2008',
      database: 'LegacyDb',
      user: 'gates_reader',
      password: 'secret',
    });
  });

  it('tries unencrypted TDS before TLS, including SQL 2008 7.2', () => {
    expect(LEGACY_SQL_CONNECT_ATTEMPTS[0]).toEqual({ encrypt: false, label: 'encrypt=false' });
    expect(LEGACY_SQL_CONNECT_ATTEMPTS.some((a) => a.tdsVersion === '7_2')).toBe(true);
  });
});
