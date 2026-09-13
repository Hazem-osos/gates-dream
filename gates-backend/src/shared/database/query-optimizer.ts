import { logger } from '../logger';
import { prisma } from './prisma';

/**
 * Query Optimizer & Index Analyzer
 * Analyzes queries and suggests optimizations
 */

export interface QueryAnalysis {
  query: string;
  executionTime?: number;
  rowsExamined?: number;
  rowsReturned?: number;
  indexesUsed?: string[];
  suggestedIndexes?: string[];
  optimizationSuggestions?: string[];
}

/**
 * Analyze query performance (MySQL-specific)
 * Note: This is a simplified version - for production, use EXPLAIN ANALYZE
 */
export async function analyzeQuery(query: string): Promise<QueryAnalysis> {
  const analysis: QueryAnalysis = {
    query,
    optimizationSuggestions: [],
  };

  try {
    // Check for missing WHERE clause on large tables
    if (query.toUpperCase().includes('SELECT') && !query.toUpperCase().includes('WHERE')) {
      analysis.optimizationSuggestions?.push(
        'Query missing WHERE clause - may scan entire table'
      );
    }

    // Check for SELECT *
    if (query.includes('SELECT *')) {
      analysis.optimizationSuggestions?.push(
        'Consider selecting specific columns instead of SELECT *'
      );
    }

    // Check for missing LIMIT on large result sets
    if (
      query.toUpperCase().includes('SELECT') &&
      !query.toUpperCase().includes('LIMIT') &&
      !query.toUpperCase().includes('JOIN')
    ) {
      analysis.optimizationSuggestions?.push(
        'Consider adding LIMIT clause for large result sets'
      );
    }

    // Check for inefficient LIKE patterns
    if (query.includes("LIKE '%") && query.includes("'%'")) {
      analysis.optimizationSuggestions?.push(
        'LIKE pattern starting with % cannot use indexes - consider full-text search'
      );
    }

    // Check for ORDER BY without index
    const orderByMatch = query.match(/ORDER BY\s+(\w+)/i);
    if (orderByMatch) {
      analysis.optimizationSuggestions?.push(
        `Consider adding index on column: ${orderByMatch[1]}`
      );
    }

    // Check for multiple JOINs
    const joinCount = (query.match(/JOIN/gi) || []).length;
    if (joinCount > 3) {
      analysis.optimizationSuggestions?.push(
        `Query has ${joinCount} JOINs - consider denormalization or materialized views`
      );
    }

    logger.debug({ query: query.substring(0, 100), analysis }, 'Query analyzed');
  } catch (error) {
    logger.error({ error, query }, 'Query analysis failed');
  }

  return analysis;
}

/**
 * Get index usage statistics (MySQL-specific)
 */
export async function getIndexUsageStats(): Promise<any[]> {
  try {
    // MySQL query to get index usage
    const result = await prisma.$queryRaw<Array<{
      table_schema: string;
      table_name: string;
      index_name: string;
      seq_in_index: number;
      column_name: string;
      cardinality: number;
      index_type: string;
    }>>`
      SELECT 
        s.table_schema,
        s.table_name,
        s.index_name,
        s.seq_in_index,
        s.column_name,
        s.cardinality,
        s.index_type
      FROM information_schema.statistics s
      WHERE s.table_schema = DATABASE()
      ORDER BY s.table_name, s.index_name, s.seq_in_index
    `;

    return result;
  } catch (error) {
    logger.error({ error }, 'Failed to get index usage stats');
    return [];
  }
}

/**
 * Find unused indexes
 */
export async function findUnusedIndexes(): Promise<string[]> {
  try {
    // MySQL query to find unused indexes
    const result = await prisma.$queryRaw<Array<{
      table_schema: string;
      table_name: string;
      index_name: string;
    }>>`
      SELECT 
        s.table_schema,
        s.table_name,
        s.index_name
      FROM information_schema.statistics s
      LEFT JOIN performance_schema.table_io_waits_summary_by_index_usage p
        ON s.table_schema = p.object_schema
        AND s.table_name = p.object_name
        AND s.index_name = p.index_name
      WHERE s.table_schema = DATABASE()
        AND p.index_name IS NULL
        AND s.index_name != 'PRIMARY'
      GROUP BY s.table_schema, s.table_name, s.index_name
    `;

    const unused = result.map(
      (r) => `${r.table_schema}.${r.table_name}.${r.index_name}`
    );

    if (unused.length > 0) {
      logger.warn({ unused }, 'Unused indexes found');
    }

    return unused;
  } catch (error) {
    logger.error({ error }, 'Failed to find unused indexes');
    return [];
  }
}

/**
 * Suggest indexes based on query patterns
 */
export async function suggestIndexes(tableName: string, columns: string[]): Promise<string> {
  const indexName = `idx_${tableName}_${columns.join('_')}`;
  const columnsList = columns.join(', ');

  return `CREATE INDEX ${indexName} ON ${tableName} (${columnsList});`;
}

/**
 * Monitor slow queries
 */
export async function getSlowQueries(limit: number = 10): Promise<any[]> {
  try {
    // Enable slow query log analysis
    // This requires MySQL slow query log to be enabled
    logger.info('Slow query monitoring - ensure slow_query_log is enabled in MySQL');
    return [];
  } catch (error) {
    logger.error({ error }, 'Failed to get slow queries');
    return [];
  }
}

/**
 * Optimize table (MySQL-specific)
 */
export async function optimizeTable(tableName: string): Promise<void> {
  try {
    await prisma.$executeRawUnsafe(`OPTIMIZE TABLE ${tableName}`);
    logger.info({ tableName }, 'Table optimized');
  } catch (error) {
    logger.error({ error, tableName }, 'Table optimization failed');
    throw error;
  }
}

/**
 * Analyze all tables
 */
export async function analyzeAllTables(): Promise<void> {
  try {
    await prisma.$executeRawUnsafe('ANALYZE TABLE *');
    logger.info('All tables analyzed');
  } catch (error) {
    logger.error({ error }, 'Table analysis failed');
  }
}

