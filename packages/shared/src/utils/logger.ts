/**
 * Structured Logger with JSON output
 */

import pino from 'pino';

const logLevel = process.env.LOG_LEVEL || 'info';

export const logger = pino({
  level: logLevel,
  formatters: {
    level: (label) => ({ level: label }),
  },
  timestamp: pino.stdTimeFunctions.isoTime,
  base: {
    service: process.env.SERVICE_NAME || 'solana-signal',
  },
});

export function createLogger(name: string) {
  return logger.child({ module: name });
}

export type Logger = pino.Logger;
