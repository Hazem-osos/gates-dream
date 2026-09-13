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
    ],
    censor: '***REDACTED***',
  },
});
