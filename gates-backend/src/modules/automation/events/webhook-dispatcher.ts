import { logger } from '../../../shared/logger';
import { companySettingService } from '../../platform/services/company-setting.service';
import { AUTOMATION_SETTING_KEYS } from '../types/automation-jobs.types';

export interface DispatchWebhookInput {
  companyId: string;
  event: string;
  payload: Record<string, unknown>;
  urlOverride?: string | null;
}

export async function dispatchInventoryWebhook(input: DispatchWebhookInput): Promise<boolean> {
  const url =
    input.urlOverride ??
    (await companySettingService.getEntry(input.companyId, AUTOMATION_SETTING_KEYS.crmInventoryWebhookUrl));
  if (!url) {
    logger.info({ companyId: input.companyId, event: input.event }, 'No CRM inventory webhook configured');
    return false;
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 10_000);
  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        event: input.event,
        companyId: input.companyId,
        occurredAt: new Date().toISOString(),
        payload: input.payload,
      }),
      signal: controller.signal,
    });
    if (!response.ok) {
      throw new Error(`Webhook responded ${response.status}`);
    }
    logger.info({ companyId: input.companyId, event: input.event, status: response.status }, 'Inventory webhook delivered');
    return true;
  } catch (error) {
    logger.warn({ error, companyId: input.companyId, event: input.event, url }, 'Inventory webhook delivery failed');
    throw error;
  } finally {
    clearTimeout(timer);
  }
}
