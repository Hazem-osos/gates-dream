import { CircuitBreaker, CircuitState, createCircuitBreaker } from '../../shared/resilience/circuit-breaker';

describe('CircuitBreaker', () => {
  let circuitBreaker: CircuitBreaker;

  beforeEach(() => {
    circuitBreaker = createCircuitBreaker({
      failureThreshold: 3,
      resetTimeout: 1000,
      monitoringWindow: 5000,
      halfOpenMaxCalls: 2,
    });
  });

  describe('execute', () => {
    it('should execute function successfully when circuit is closed', async () => {
      const fn = jest.fn().mockResolvedValue('success');

      const result = await circuitBreaker.execute(fn);

      expect(result).toBe('success');
      expect(fn).toHaveBeenCalledTimes(1);
      expect(circuitBreaker.getState()).toBe(CircuitState.CLOSED);
    });

    it('should open circuit after threshold failures', async () => {
      const fn = jest.fn().mockRejectedValue(new Error('Service error'));

      // Trigger failures up to threshold
      for (let i = 0; i < 3; i++) {
        try {
          await circuitBreaker.execute(fn);
        } catch (e) {
          // Expected to fail
        }
      }

      expect(circuitBreaker.getState()).toBe(CircuitState.OPEN);
    });

    it('should use fallback when circuit is open', async () => {
      const fn = jest.fn().mockRejectedValue(new Error('Service error'));
      const fallback = jest.fn().mockReturnValue('fallback');

      // Open the circuit
      for (let i = 0; i < 3; i++) {
        try {
          await circuitBreaker.execute(fn);
        } catch (e) {
          // Expected to fail
        }
      }

      // Wait for reset timeout
      await new Promise((resolve) => setTimeout(resolve, 1100));

      const result = await circuitBreaker.execute(fn, fallback);

      expect(result).toBe('fallback');
      expect(fallback).toHaveBeenCalled();
    });
  });

  describe('reset', () => {
    it('should reset circuit to closed state', () => {
      circuitBreaker['state'] = CircuitState.OPEN;
      circuitBreaker.reset();

      expect(circuitBreaker.getState()).toBe(CircuitState.CLOSED);
      expect(circuitBreaker.getFailureCount()).toBe(0);
    });
  });
});

