import { logger } from '../logger';

export interface RetryOptions {
  maxAttempts: number;
  initialDelay: number; // Initial delay in ms
  maxDelay: number; // Maximum delay in ms
  factor: number; // Exponential backoff factor
  jitter: boolean; // Add random jitter to delays
  retryable?: (error: Error) => boolean; // Function to determine if error is retryable
}

const DEFAULT_OPTIONS: RetryOptions = {
  maxAttempts: 3,
  initialDelay: 1000,
  maxDelay: 30000,
  factor: 2,
  jitter: true,
  retryable: (error: Error) => {
    // Default: retry on network errors, timeouts, and 5xx errors
    const retryableMessages = ['ECONNREFUSED', 'ETIMEDOUT', 'ENOTFOUND', 'timeout'];
    return retryableMessages.some((msg) => error.message.includes(msg));
  },
};

/**
 * Retry a function with exponential backoff
 */
export async function retry<T>(
  fn: () => Promise<T>,
  options: Partial<RetryOptions> = {}
): Promise<T> {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  let lastError: Error | null = null;

  for (let attempt = 1; attempt <= opts.maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));

      // Check if error is retryable
      if (opts.retryable && !opts.retryable(lastError)) {
        logger.warn({ error: lastError, attempt }, 'Error is not retryable');
        throw lastError;
      }

      // Don't retry on last attempt
      if (attempt === opts.maxAttempts) {
        logger.error(
          { error: lastError, attempts: attempt },
          'Max retry attempts reached'
        );
        throw lastError;
      }

      // Calculate delay with exponential backoff
      const baseDelay = Math.min(
        opts.initialDelay * Math.pow(opts.factor, attempt - 1),
        opts.maxDelay
      );

      const delay = opts.jitter
        ? baseDelay + Math.random() * baseDelay * 0.1 // Add 10% jitter
        : baseDelay;

      logger.warn(
        { error: lastError, attempt, maxAttempts: opts.maxAttempts, delay },
        'Retrying operation'
      );

      await sleep(delay);
    }
  }

  throw lastError || new Error('Retry failed');
}

/**
 * Sleep utility
 */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Retry decorator for async functions
 */
export function withRetry<T extends (...args: any[]) => Promise<any>>(
  fn: T,
  options?: Partial<RetryOptions>
): T {
  return (async (...args: Parameters<T>) => {
    return retry(() => fn(...args), options);
  }) as T;
}

