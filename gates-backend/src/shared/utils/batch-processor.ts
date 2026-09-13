import { logger } from '../logger';

/**
 * Batch Processor
 * Processes items in batches with error handling
 */

export interface BatchProcessorOptions {
  batchSize?: number;
  concurrency?: number;
  stopOnError?: boolean;
}

const DEFAULT_OPTIONS: Required<BatchProcessorOptions> = {
  batchSize: 50,
  concurrency: 5,
  stopOnError: false,
};

export interface BatchResult<T> {
  successful: T[];
  failed: Array<{ item: any; error: Error }>;
  total: number;
}

/**
 * Process items in batches
 */
export async function processBatch<T, R>(
  items: T[],
  processor: (item: T) => Promise<R>,
  options: BatchProcessorOptions = {}
): Promise<BatchResult<R>> {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  const successful: R[] = [];
  const failed: Array<{ item: T; error: Error }> = [];

  // Process in batches
  for (let i = 0; i < items.length; i += opts.batchSize) {
    const batch = items.slice(i, i + opts.batchSize);

    // Process batch with concurrency limit
    const batchPromises = batch.map(async (item) => {
      try {
        const result = await processor(item);
        successful.push(result);
        return { success: true, result };
      } catch (error) {
        const err = error instanceof Error ? error : new Error(String(error));
        failed.push({ item, error: err });
        logger.error({ error: err, item }, 'Batch item processing failed');

        if (opts.stopOnError) {
          throw err;
        }

        return { success: false, error: err };
      }
    });

    await Promise.all(batchPromises);
  }

  return {
    successful,
    failed: failed as any,
    total: items.length,
  };
}

