import { NodeSDK } from '@opentelemetry/sdk-node';
import { getNodeAutoInstrumentations } from '@opentelemetry/auto-instrumentations-node';
import { resourceFromAttributes } from '@opentelemetry/resources';
import { SEMRESATTRS_SERVICE_NAME, SEMRESATTRS_SERVICE_VERSION } from '@opentelemetry/semantic-conventions';
import { logger } from '../logger';
import { env } from '../config/env';

/**
 * OpenTelemetry Tracing Setup
 * Provides distributed tracing for the application
 */
let sdk: NodeSDK | null = null;

export function initializeTracing(): void {
  // Only initialize in production or if explicitly enabled
  if (env.NODE_ENV !== 'production' && process.env.ENABLE_TRACING !== 'true') {
    logger.info('Tracing disabled in development mode');
    return;
  }

  try {
    sdk = new NodeSDK({
      resource: resourceFromAttributes({
        [SEMRESATTRS_SERVICE_NAME]: 'gates-backend',
        [SEMRESATTRS_SERVICE_VERSION]: '1.0.0',
      }),
      instrumentations: [
        getNodeAutoInstrumentations({
          // Disable fs instrumentation to reduce noise
          '@opentelemetry/instrumentation-fs': {
            enabled: false,
          },
        }),
      ],
    });

    sdk.start();
    logger.info('OpenTelemetry tracing initialized');
  } catch (error) {
    logger.error({ error }, 'Failed to initialize OpenTelemetry tracing');
  }
}

export function shutdownTracing(): Promise<void> {
  if (sdk) {
    return sdk.shutdown();
  }
  return Promise.resolve();
}

// Initialize tracing on module load if enabled
if (process.env.ENABLE_TRACING === 'true' || env.NODE_ENV === 'production') {
  initializeTracing();
}

