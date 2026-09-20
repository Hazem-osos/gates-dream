import pino from 'pino';
import { maskPIIInObject } from './utils/pii-masker';

const NODE_ENV = process.env.NODE_ENV || 'development';
const LOG_LEVEL = process.env.LOG_LEVEL || 'info';

// PII masking serializer for Pino
const piiSerializer = {
  serialize: (obj: any) => {
    return maskPIIInObject(obj);
  },
};

export const logger = pino({
  level: LOG_LEVEL,
  ...(NODE_ENV === 'development' && {
    transport: {
      target: 'pino-pretty',
      options: {
        colorize: true,
        translateTime: 'SYS:standard',
        ignore: 'pid,hostname',
      },
    },
  }),
  formatters: {
    level: (label) => {
      return { level: label.toUpperCase() };
    },
  },
  timestamp: pino.stdTimeFunctions.isoTime,
  serializers: {
    ...pino.stdSerializers,
    err: piiSerializer.serialize,
    error: piiSerializer.serialize,
    req: piiSerializer.serialize,
    res: piiSerializer.serialize,
  },
  // Redact sensitive fields
  redact: {
    // Defense-in-depth: the `req`/`res`/`err` serializers above already run
    // `maskPIIInObject` (which normalizes header names like `x-api-key` and
    // `authorization` before matching), but this second layer also covers
    // any future log call that passes headers directly instead of via a
    // serializer key (e.g. `logger.info({ headers }, ...)`).
    paths: [
      'password',
      'passwordHash',
      'password_hash',
      'token',
      'secret',
      'apiKey',
      'api_key',
      'accessToken',
      'access_token',
      'refreshToken',
      'refresh_token',
      'authorization',
      'cookie',
      'headers.authorization',
      'headers.cookie',
      'headers["x-api-key"]',
      'req.headers.authorization',
      'req.headers.cookie',
      'req.headers["x-api-key"]',
      '*.headers.authorization',
      '*.headers.cookie',
      '*.headers["x-api-key"]',
    ],
    censor: '***REDACTED***',
  },
});
