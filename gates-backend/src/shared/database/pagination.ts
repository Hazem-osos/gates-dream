/**
 * Pagination Utilities
 * Provides cursor-based and offset-based pagination
 */

export interface PaginationOptions {
  page?: number;
  limit?: number;
  cursor?: string;
}

export interface PaginationResult<T> {
  data: T[];
  pagination: {
    page?: number;
    limit?: number;
    total?: number;
    totalPages?: number;
    hasMore?: boolean;
    nextCursor?: string;
  };
}

/**
 * Cursor-based pagination for large datasets
 */
export class CursorPagination {
  /**
   * Create cursor from record
   */
  static createCursor(id: string, createdAt: Date): string {
    const timestamp = createdAt.getTime();
    return Buffer.from(`${id}:${timestamp}`).toString('base64');
  }

  /**
   * Parse cursor to get ID and timestamp
   */
  static parseCursor(cursor: string): { id: string; timestamp: number } | null {
    try {
      const decoded = Buffer.from(cursor, 'base64').toString('utf-8');
      const [id, timestamp] = decoded.split(':');
      return {
        id,
        timestamp: parseInt(timestamp, 10),
      };
    } catch {
      return null;
    }
  }

  /**
   * Apply cursor pagination to query
   */
  static applyCursor<T extends { id: string; createdAt: Date }>(
    items: T[],
    limit: number,
    cursor?: string
  ): { items: T[]; nextCursor?: string } {
    let startIndex = 0;

    if (cursor) {
      const parsed = this.parseCursor(cursor);
      if (parsed) {
        startIndex = items.findIndex(
          (item) => item.id === parsed.id || item.createdAt.getTime() > parsed.timestamp
        );
        if (startIndex === -1) {
          startIndex = 0;
        }
      }
    }

    const paginatedItems = items.slice(startIndex, startIndex + limit + 1);
    const hasMore = paginatedItems.length > limit;
    const result = hasMore ? paginatedItems.slice(0, limit) : paginatedItems;

    const nextCursor = hasMore && result.length > 0
      ? this.createCursor(result[result.length - 1].id, result[result.length - 1].createdAt)
      : undefined;

    return {
      items: result,
      nextCursor,
    };
  }
}

/**
 * Offset-based pagination
 */
export class OffsetPagination {
  /**
   * Calculate pagination metadata
   */
  static calculateMetadata(
    page: number,
    limit: number,
    total: number
  ): {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasMore: boolean;
  } {
    const totalPages = Math.ceil(total / limit);
    const hasMore = page < totalPages;

    return {
      page,
      limit,
      total,
      totalPages,
      hasMore,
    };
  }

  /**
   * Get skip value for database query
   */
  static getSkip(page: number, limit: number): number {
    return (page - 1) * limit;
  }
}

