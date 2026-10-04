import { logger } from '../../../shared/logger';
import { env } from '../../../shared/config/env';

export type AutomationDeliveryDiagnostic = {
  redisEnabled: boolean;
  eventIntakeConfigured: boolean;
  workersStarted: boolean;
  status: 'ready' | 'disabled' | 'no_intake';
  message: string;
};

/**
 * Read-only snapshot of event-delivery configuration. Never includes the
 * intake URL or API key. ERP operations must not depend on this.
 */
export function getAutomationDeliveryDiagnostic(): AutomationDeliveryDiagnostic {
  const redisEnabled = Boolean(env.REDIS_ENABLED);
  const eventIntakeConfigured = Boolean(env.N8N_EVENT_INTAKE_URL);

  if (!redisEnabled) {
    return {
      redisEnabled,
      eventIntakeConfigured,
      workersStarted: false,
      status: 'disabled',
      message:
        'Automation event delivery is disabled (REDIS_ENABLED=false). ERP operations still succeed; domain events are not queued.',
    };
  }
  if (!eventIntakeConfigured) {
    return {
      redisEnabled,
      eventIntakeConfigured,
      workersStarted: true,
      status: 'no_intake',
      message:
        'N8N_EVENT_INTAKE_URL is not set. Queued automation events complete as a no-op and are not delivered.',
    };
  }
  return {
    redisEnabled,
    eventIntakeConfigured,
    workersStarted: true,
    status: 'ready',
    message: 'Automation event delivery is configured (Redis + n8n intake).',
  };
}

export function logAutomationDeliveryDiagnostics(): AutomationDeliveryDiagnostic {
  const diagnostic = getAutomationDeliveryDiagnostic();
  if (diagnostic.status === 'ready') {
    logger.info({ automationDelivery: diagnostic }, diagnostic.message);
  } else {
    logger.warn({ automationDelivery: diagnostic }, diagnostic.message);
  }
  return diagnostic;
}
