/**
 * Circuit Breaker for handling unstable providers
 */

import { createLogger } from './logger.js';

const logger = createLogger('circuit-breaker');

export enum CircuitState {
  CLOSED = 'CLOSED',
  OPEN = 'OPEN',
  HALF_OPEN = 'HALF_OPEN',
}

export interface CircuitBreakerConfig {
  name: string;
  failureThreshold: number; // Failures before opening
  successThreshold: number; // Successes in half-open to close
  timeout: number; // ms before trying again (half-open)
}

export class CircuitBreaker {
  private name: string;
  private state: CircuitState = CircuitState.CLOSED;
  private failureCount: number = 0;
  private successCount: number = 0;
  private lastFailureTime: number = 0;

  private failureThreshold: number;
  private successThreshold: number;
  private timeout: number;

  constructor(config: CircuitBreakerConfig) {
    this.name = config.name;
    this.failureThreshold = config.failureThreshold;
    this.successThreshold = config.successThreshold;
    this.timeout = config.timeout;
  }

  async execute<T>(fn: () => Promise<T>): Promise<T> {
    if (!this.canExecute()) {
      throw new CircuitOpenError(this.name);
    }

    try {
      const result = await fn();
      this.onSuccess();
      return result;
    } catch (error) {
      this.onFailure();
      throw error;
    }
  }

  canExecute(): boolean {
    if (this.state === CircuitState.CLOSED) {
      return true;
    }

    if (this.state === CircuitState.OPEN) {
      // Check if timeout has passed
      if (Date.now() - this.lastFailureTime >= this.timeout) {
        this.state = CircuitState.HALF_OPEN;
        this.successCount = 0;
        logger.info({ name: this.name }, 'Circuit breaker entering half-open state');
        return true;
      }
      return false;
    }

    // HALF_OPEN - allow execution
    return true;
  }

  private onSuccess(): void {
    if (this.state === CircuitState.HALF_OPEN) {
      this.successCount++;
      if (this.successCount >= this.successThreshold) {
        this.state = CircuitState.CLOSED;
        this.failureCount = 0;
        logger.info({ name: this.name }, 'Circuit breaker closed after recovery');
      }
    } else {
      // Reset failure count on success in closed state
      this.failureCount = 0;
    }
  }

  private onFailure(): void {
    this.failureCount++;
    this.lastFailureTime = Date.now();

    if (this.state === CircuitState.HALF_OPEN) {
      this.state = CircuitState.OPEN;
      logger.warn({ name: this.name }, 'Circuit breaker re-opened after half-open failure');
    } else if (this.failureCount >= this.failureThreshold) {
      this.state = CircuitState.OPEN;
      logger.warn(
        { name: this.name, failures: this.failureCount },
        'Circuit breaker opened due to failures'
      );
    }
  }

  getState(): CircuitState {
    return this.state;
  }

  getStats() {
    return {
      name: this.name,
      state: this.state,
      failureCount: this.failureCount,
      successCount: this.successCount,
      lastFailureTime: this.lastFailureTime,
    };
  }

  reset(): void {
    this.state = CircuitState.CLOSED;
    this.failureCount = 0;
    this.successCount = 0;
    this.lastFailureTime = 0;
  }
}

export class CircuitOpenError extends Error {
  constructor(circuitName: string) {
    super(`Circuit breaker '${circuitName}' is open`);
    this.name = 'CircuitOpenError';
  }
}

// Create circuit breakers for providers
export function createProviderCircuitBreakers() {
  return {
    rpc: new CircuitBreaker({
      name: 'rpc',
      failureThreshold: 5,
      successThreshold: 2,
      timeout: 30000,
    }),
    dexscreener: new CircuitBreaker({
      name: 'dexscreener',
      failureThreshold: 3,
      successThreshold: 2,
      timeout: 60000,
    }),
    geckoterminal: new CircuitBreaker({
      name: 'geckoterminal',
      failureThreshold: 3,
      successThreshold: 2,
      timeout: 60000,
    }),
    jupiter: new CircuitBreaker({
      name: 'jupiter',
      failureThreshold: 5,
      successThreshold: 2,
      timeout: 30000,
    }),
    birdeye: new CircuitBreaker({
      name: 'birdeye',
      failureThreshold: 3,
      successThreshold: 2,
      timeout: 60000,
    }),
    telegram: new CircuitBreaker({
      name: 'telegram',
      failureThreshold: 3,
      successThreshold: 2,
      timeout: 60000,
    }),
    twitter: new CircuitBreaker({
      name: 'twitter',
      failureThreshold: 3,
      successThreshold: 2,
      timeout: 120000,
    }),
    discord: new CircuitBreaker({
      name: 'discord',
      failureThreshold: 3,
      successThreshold: 2,
      timeout: 60000,
    }),
  };
}
