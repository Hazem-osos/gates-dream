declare module 'mssql' {
  export interface IRequest {
    input(name: string, value: string | number): IRequest;
    query<T = unknown>(sql: string): Promise<{ recordset: T[] }>;
  }
  export interface ConnectionPool {
    connect(): Promise<ConnectionPool>;
    request(): IRequest;
    close(): Promise<void>;
  }
  type ConnectionPoolCtor = new (connectionString: string) => ConnectionPool;
  const sql: {
    connect(connectionString: string): Promise<ConnectionPool>;
    ConnectionPool: ConnectionPoolCtor;
    default: {
      connect(connectionString: string): Promise<ConnectionPool>;
      ConnectionPool: ConnectionPoolCtor;
    };
  };
  export default sql;
}
