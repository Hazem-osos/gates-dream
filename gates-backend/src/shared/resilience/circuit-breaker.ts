import { logger } from '../logger';

export enum CircuitState {
  CLOSED = 'CLOSED', // Normal operation
  OPEN = 'OPEN', // Failing, reject requests immediately
  HALF_OPEN = 'HALF_OPEN', // Testing if service recovered
}

export interface CircuitBreakerOptions {
  failureThreshold: number; // Number of failures before opening circuit
  resetTimeout: number; // Time in ms before attempting to close circuit
  monitoringWindow: number; // Time window in ms for tracking failures
  halfOpenMaxCalls: number; // Max calls in half-open state before deciding
}

const DEFAULT_OPTIONS: CircuitBreakerOptions = {
  failureThreshold: 5,
  resetTimeout: 60000, // 1 minute
  monitoringWindow: 60000, // 1 minute
  halfOpenMaxCalls: 3,
};

export class CircuitBreaker {
  private state: CircuitState = CircuitState.CLOSED;
  private failures: number[] = []; // Timestamps of failures
  private halfOpenCalls: number = 0;
  private lastFailureTime: number = 0;
  private options: CircuitBreakerOptions;

  constructor(options: Partial<CircuitBreakerOptions> = {}) {
    this.options = { ...DEFAULT_OPTIONS, ...options };
  }

  /**
   * Execute a function with circuit breaker protection
   */
  async execute<T>(
    fn: () => Promise<T>,
    fallback?: () => Promise<T> | T
  ): Promise<T> {
    // Check circuit state
    if (this.state === CircuitState.OPEN) {
      if (Date.now() - this.lastFailureTime >= this.options.resetTimeout) {
        this.state = CircuitState.HALF_OPEN;
        this.halfOpenCalls = 0;
        logger.info('Circuit breaker entering HALF_OPEN state');
      } else {
        logger.warn('Circuit breaker is OPEN, rejecting request');
        if (fallback) {
          return await Promise.resolve(fallback());
        }
        throw new Error('Circuit breaker is OPEN - service unavailable');
      }
    }

    try {
      const result = await fn();
      this.onSuccess();
      return result;
    } catch (error) {
      this.onFailure();
      if (fallback) {
        logger.warn({ error }, 'Operation failed, using fallback');
        return await Promise.resolve(fallback());
      }
      throw error;
    }
  }

  /**
   * Handle successful operation
   */
  private onSuccess(): void {
    // Clear failures on success
    this.failures = [];

    if (this.state === CircuitState.HALF_OPEN) {
      this.halfOpenCalls++;
      if (this.halfOpenCalls >= this.options.halfOpenMaxCalls) {
        this.state = CircuitState.CLOSED;
        this.halfOpenCalls = 0;
        logger.info('Circuit breaker CLOSED - service recovered');
      }
    } else if (this.state === CircuitState.OPEN) {
      // Shouldn't happen, but reset if it does
      this.state = CircuitState.CLOSED;
    }
  }

  /**
   * Handle failed operation
   */
  private onFailure(): void {
    const now = Date.now();
    this.lastFailureTime = now;
    this.failures.push(now);

    // Remove old failures outside monitoring window
    this.failures = this.failures.filter(
      (time) => now - time < this.options.monitoringWindow
    );

    if (this.state === CircuitState.HALF_OPEN) {
      // Any failure in half-open state opens the circuit
      this.state = CircuitState.OPEN;
      this.halfOpenCalls = 0;
      logger.warn('Circuit breaker OPENED - service still failing');
    } else if (
      this.state === CircuitState.CLOSED &&
      this.failures.length >= this.options.failureThreshold
    ) {
      this.state = CircuitState.OPEN;
      logger.error(
        {
          failures: this.failures.length,
          threshold: this.options.failureThreshold,
        },
        'Circuit breaker OPENED - too many failures'
      );
    }
  }

  /**
   * Get current circuit state
   */
  getState(): CircuitState {
    return this.state;
  }

  /**
   * Reset circuit breaker to closed state
   */
  reset(): void {
    this.state = CircuitState.CLOSED;
    this.failures = [];
    this.halfOpenCalls = 0;
    this.lastFailureTime = 0;
  }

  /**
   * Get failure count
   */
  getFailureCount(): number {
    return this.failures.length;
  }
}

/**
 * Create a circuit breaker instance
 */
export function createCircuitBreaker(
  options?: Partial<CircuitBreakerOptions>
): CircuitBreaker {
  return new CircuitBreaker(options);
}

