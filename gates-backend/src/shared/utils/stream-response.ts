import { Response } from 'express';
import { logger } from '../logger';

/**
 * Response Streaming Utilities
 * Streams large datasets to reduce memory usage
 */

/**
 * Stream JSON array response
 * Useful for large datasets that would consume too much memory
 */
export function streamJSONArray<T>(
  res: Response,
  dataStream: AsyncIterable<T>,
  options: {
    statusCode?: number;
    headers?: Record<string, string>;
    transform?: (item: T) => any;
  } = {}
): void {
  const { statusCode = 200, headers = {}, transform } = options;

  res.status(statusCode);
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Transfer-Encoding', 'chunked');

  Object.entries(headers).forEach(([key, value]) => {
    res.setHeader(key, value);
  });

  // Start streaming
  res.write('[');

  let firstItem = true;

  (async () => {
    try {
      for await (const item of dataStream) {
        if (!firstItem) {
          res.write(',');
        }
        firstItem = false;

        const transformed = transform ? transform(item) : item;
        res.write(JSON.stringify(transformed));
      }

      res.write(']');
      return void res.end();
    } catch (error) {
      logger.error({ error }, 'Error streaming JSON array');
      if (!res.headersSent) {
        return void res.status(500).json({
          status: 'error',
          message: 'Error streaming response',
        });
      } else {
        return void res.end();
      }
    }
  })();
}

/**
 * Stream CSV response
 */
export function streamCSV(
  res: Response,
  dataStream: AsyncIterable<Record<string, any>>,
  options: {
    headers?: string[];
    statusCode?: number;
    filename?: string;
  } = {}
): void {
  const { headers: csvHeaders, statusCode = 200, filename } = options;

  res.status(statusCode);
  res.setHeader('Content-Type', 'text/csv');
  res.setHeader('Transfer-Encoding', 'chunked');

  if (filename) {
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  }

  let headersWritten = false;

  (async () => {
    try {
      for await (const row of dataStream) {
        if (!headersWritten) {
          // Write CSV headers
          const headers = csvHeaders || Object.keys(row);
          res.write(headers.map((h) => escapeCSV(h)).join(',') + '\n');
          headersWritten = true;
        }

        // Write CSV row
        const values = csvHeaders
          ? csvHeaders.map((h) => row[h] ?? '')
          : Object.values(row);
        res.write(values.map((v) => escapeCSV(String(v))).join(',') + '\n');
      }

      return void res.end();
    } catch (error) {
      logger.error({ error }, 'Error streaming CSV');
      if (!res.headersSent) {
        return void res.status(500).json({
          status: 'error',
          message: 'Error streaming CSV',
        });
      } else {
        return void res.end();
      }
    }
  })();
}

/**
 * Escape CSV value
 */
function escapeCSV(value: string): string {
  if (value.includes(',') || value.includes('"') || value.includes('\n')) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

/**
 * Stream paginated response
 * Streams data in chunks with pagination metadata
 */
export async function streamPaginated<T>(
  res: Response,
  dataStream: AsyncIterable<T>,
  options: {
    page: number;
    limit: number;
    total?: number;
    transform?: (item: T) => any;
  }
): Promise<void> {
  const { page, limit, total, transform } = options;

  res.status(200);
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Transfer-Encoding', 'chunked');

  let count = 0;
  const items: any[] = [];

  try {
    for await (const item of dataStream) {
      if (count >= limit) {
        break;
      }

      const transformed = transform ? transform(item) : item;
      items.push(transformed);
      count++;
    }

    const response = {
      status: 'success',
      data: {
        items,
        pagination: {
          page,
          limit,
          total: total ?? count,
          hasMore: count === limit,
        },
      },
    };

    res.json(response);
    return;
  } catch (error) {
    logger.error({ error }, 'Error streaming paginated response');
    if (!res.headersSent) {
      res.status(500).json({
        status: 'error',
        message: 'Error streaming response',
      });
    }
    return;
  }
}

/**
 * Create async iterator from array (for testing)
 */
export async function* arrayToAsyncIterator<T>(array: T[]): AsyncIterable<T> {
  for (const item of array) {
    yield item;
  }
}

/**
 * Create async iterator from database cursor
 * Example: for Prisma findMany with cursor pagination
 */
export async function* cursorToAsyncIterator<T>(
  fetchPage: (cursor?: string) => Promise<{ items: T[]; nextCursor?: string }>
): AsyncIterable<T> {
  let cursor: string | undefined;
  let hasMore = true;

  while (hasMore) {
    const result = await fetchPage(cursor);
    for (const item of result.items) {
      yield item;
    }

    cursor = result.nextCursor;
    hasMore = !!cursor && result.items.length > 0;
  }
}

