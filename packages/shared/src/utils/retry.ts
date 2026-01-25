/**
 * Retry utilities with exponential backoff
 */

import { createLogger } from './logger.js';

const logger = createLogger('retry');

export interface RetryConfig {
  maxAttempts: number;
  initialDelayMs: number;
  maxDelayMs: number;
  backoffMultiplier: number;
  retryableErrors?: (error: Error) => boolean;
}

const defaultConfig: RetryConfig = {
  maxAttempts: 3,
  initialDelayMs: 1000,
  maxDelayMs: 30000,
  backoffMultiplier: 2,
};

export async function withRetry<T>(
  fn: () => Promise<T>,
  config: Partial<RetryConfig> = {}
): Promise<T> {
  const opts = { ...defaultConfig, ...config };
  let lastError: Error | undefined;
  let delay = opts.initialDelayMs;

  for (let attempt = 1; attempt <= opts.maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error as Error;

      // Check if error is retryable
      if (opts.retryableErrors && !opts.retryableErrors(lastError)) {
        throw lastError;
      }

      if (attempt < opts.maxAttempts) {
        const jitter = Math.random() * 0.3 * delay;
        const waitTime = Math.min(delay + jitter, opts.maxDelayMs);

        logger.debug(
          {
            attempt,
            maxAttempts: opts.maxAttempts,
            waitTime,
            error: lastError.message,
          },
          'Retrying after failure'
        );

        await sleep(waitTime);
        delay *= opts.backoffMultiplier;
      }
    }
  }

  throw lastError;
}

export function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// Common retryable error checks
export const isNetworkError = (error: Error): boolean => {
  const message = error.message.toLowerCase();
  return (
    message.includes('econnrefused') ||
    message.includes('econnreset') ||
    message.includes('etimedout') ||
    message.includes('socket hang up') ||
    message.includes('network') ||
    message.includes('fetch failed') ||
    message.includes('429') ||
    message.includes('503') ||
    message.includes('502')
  );
};

export const isRateLimitError = (error: Error): boolean => {
  const message = error.message.toLowerCase();
  return message.includes('429') || message.includes('rate limit') || message.includes('too many');
};
