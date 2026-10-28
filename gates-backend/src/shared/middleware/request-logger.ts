import { Request } from 'express';
import pinoHttp from 'pino-http';
import { logger } from '../logger';

/** Probes and scrapes hit every few seconds per instance; logging them is noise. */
const UNLOGGED_PATHS = new Set(['/health', '/health/live', '/health/ready', '/metrics']);

export const requestLogger = pinoHttp({
  logger,
  autoLogging: {
    ignore: (req) => UNLOGGED_PATHS.has((req.url ?? '').split('?')[0]),
  },
  // One compact line per request. The default serializers copied every header
  // into each log line and then ran the PII masker over it — real CPU and log
  // volume at hundreds of requests per second. Headers are not logged at all now,
  // so tokens and cookies cannot leak through this path.
  wrapSerializers: false,
  serializers: {
    req: (req: { id?: unknown; method?: string; url?: string }) => ({
      id: req.id,
      method: req.method,
      url: req.url,
    }),
    res: (res: { statusCode?: number }) => ({ statusCode: res.statusCode }),
  },
  customLogLevel: (req, res, err) => {
    if (res.statusCode >= 400 && res.statusCode < 500) {
      return 'warn';
    } else if (res.statusCode >= 500 || err) {
      return 'error';
    }
    return 'info';
  },
  customSuccessMessage: (req, res) => {
    return `${req.method} ${req.url} completed with status ${res.statusCode}`;
  },
  customErrorMessage: (req, res) => {
    return `${req.method} ${req.url} failed with status ${res.statusCode}`;
  },
  customProps: (req: Request) => {
    return {
      user: (req as any).user?.sub || (req as any).user?.id || 'anonymous',
    };
  },
});
