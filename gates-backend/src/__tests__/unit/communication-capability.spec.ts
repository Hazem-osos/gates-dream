import { buildAutomationCapabilities, buildAutomationMetadata } from '../../modules/automation/catalog/metadata.service';

jest.mock('../../modules/company/services/company-email.service', () => ({
  isCompanyEmailConfigured: jest.fn(),
}));

jest.mock('../../modules/whatsapp/whatsapp-connection.service', () => ({
  isCompanyWhatsappReady: jest.fn().mockResolvedValue(false),
  sendCompanyTemplate: jest.fn(),
  WhatsAppConnectionError: class WhatsAppConnectionError extends Error {
    statusCode = 400;
    constructor(public code: string, message: string, statusCode = 400) {
      super(message);
      this.statusCode = statusCode;
    }
  },
}));

import { isCompanyEmailConfigured } from '../../modules/company/services/company-email.service';
import { validateAutomationActions } from '../../modules/automation/catalog/action-validator';
import { whatsappActionHandler } from '../../modules/automation/services/automation-whatsapp-action.handler';
import { sendCompanyTemplate, WhatsAppConnectionError } from '../../modules/whatsapp/whatsapp-connection.service';

const COMPANY = '00000000-0000-0000-0000-000000000001';

describe('communication capabilities', () => {
  it('hides SMTP secrets from metadata and keeps WhatsApp unavailable', () => {
    const metadata = buildAutomationMetadata();
    const serialized = JSON.stringify(metadata);
    expect(serialized).not.toMatch(/password|smtpPass|accessToken/i);
    expect(metadata.capabilities.email.available).toBe(false);
    expect(metadata.capabilities.whatsapp.available).toBe(false);
    expect(buildAutomationCapabilities(true).email.available).toBe(true);
    expect(buildAutomationCapabilities(true).whatsapp.available).toBe(false);
  });

  it('rejects email rules when SMTP is missing and allows them when it is configured', async () => {
    (isCompanyEmailConfigured as jest.Mock).mockResolvedValue(false);
    await expect(
      validateAutomationActions(COMPANY, 'sales.invoice.created', [
        { type: 'email.send', config: { to: 'a@example.com', subject: 'Hi', body: 'Body' } },
      ])
    ).rejects.toMatchObject({ statusCode: 400 });

    (isCompanyEmailConfigured as jest.Mock).mockResolvedValue(true);
    await expect(
      validateAutomationActions(COMPANY, 'sales.invoice.created', [
        { type: 'email.send', config: { to: 'a@example.com', subject: 'Hi', body: 'Body' } },
      ])
    ).resolves.toBeUndefined();
  });

  it('rejects automated WhatsApp without a provider and does not build a wa.me link', async () => {
    await expect(
      validateAutomationActions(COMPANY, 'sales.invoice.created', [
        { type: 'whatsapp.send', config: { body: 'Hello' } },
      ])
    ).rejects.toMatchObject({ statusCode: 400 });

    (sendCompanyTemplate as jest.Mock).mockRejectedValue(
      new WhatsAppConnectionError('WHATSAPP_NOT_CONFIGURED', 'WhatsApp Business is not connected', 400)
    );
    await expect(
      whatsappActionHandler.execute({
        companyId: COMPANY,
        eventId: 'evt',
        ruleId: 'rule',
        correlationId: 'corr',
        eventType: 'sales.invoice.created',
        config: { recipientSource: 'manual', to: '01001234567', templateName: 'payment_reminder' },
      })
    ).rejects.toMatchObject({ statusCode: 400, code: 'WHATSAPP_NOT_CONFIGURED' });
  });

  it('sends two WhatsApp actions independently when the company is connected', async () => {
    (sendCompanyTemplate as jest.Mock).mockClear();
    (sendCompanyTemplate as jest.Mock).mockResolvedValue({
      provider: 'meta',
      messageId: 'wamid',
      recipient: '201******567',
      status: 'ACCEPTED',
    });
    const base = {
      companyId: COMPANY,
      eventId: 'evt',
      ruleId: 'rule',
      correlationId: 'corr',
      eventType: 'sales.invoice.created',
    };
    await whatsappActionHandler.execute({
      ...base,
      config: { recipientSource: 'manual', to: '01001234567', templateName: 'invoice_due', templateLanguage: 'ar' },
    });
    await whatsappActionHandler.execute({
      ...base,
      config: { recipientSource: 'manual', to: '01007654321', templateName: 'payment_reminder', templateLanguage: 'en' },
    });
    expect(sendCompanyTemplate).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({ templateName: 'invoice_due', language: 'ar' })
    );
    expect(sendCompanyTemplate).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({ templateName: 'payment_reminder', language: 'en' })
    );
  });
});
