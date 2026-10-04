declare module 'mssql' {
  export interface IRequest {
    input(name: string, value: string | number): IRequest;
    query<T = unknown>(sql: string): Promise<{ recordset: T[] }>;
  }
  export interface ConnectionPool {
    request(): IRequest;
    close(): Promise<void>;
  }
  const sql: {
    connect(connectionString: string): Promise<ConnectionPool>;
    default: { connect(connectionString: string): Promise<ConnectionPool> };
  };
  export default sql;
}
