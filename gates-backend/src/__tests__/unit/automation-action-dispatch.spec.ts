import prisma from '../../shared/database/prisma';
import { emailService } from '../../shared/services/email.service';

jest.mock('../../shared/database/prisma', () => ({
  __esModule: true,
  default: {
    systemNotification: { create: jest.fn() },
    user: { findFirst: jest.fn() },
  },
}));

jest.mock('../../shared/services/email.service', () => ({
  __esModule: true,
  emailService: {
    isEmailConfigured: jest.fn(),
    sendEmail: jest.fn(),
  },
}));

import { AutomationActionRunService } from '../../modules/automation/services/automation-action-run.service';
import { AutomationActionDispatchService } from '../../modules/automation/services/automation-action-dispatch.service';
import { AutomationActionDispatchError } from '../../modules/automation/services/automation-action-dispatch.types';
import { notificationActionHandler } from '../../modules/automation/services/automation-notification-action.handler';
import { emailActionHandler } from '../../modules/automation/services/automation-email-action.handler';
import type { AutomationActionRunRecord, AutomationActionRunStore } from '../../modules/automation/services/automation-action-run.types';

const COMPANY_A = '00000000-0000-0000-0000-000000000001';

function createRunStore(seed: AutomationActionRunRecord[] = []): AutomationActionRunStore {
  const runs = [...seed];
  return {
    automationActionRun: {
      create: async ({ data }: { data: Partial<AutomationActionRunRecord> }) => {
        const dup = runs.find(
          (r) =>
            r.companyId === data.companyId &&
            r.eventId === data.eventId &&
            r.ruleId === data.ruleId &&
            r.actionType === data.actionType
        );
        if (dup) throw Object.assign(new Error('Unique constraint failed'), { code: 'P2002' });
        const now = new Date();
        const row: AutomationActionRunRecord = {
          id: `run-${runs.length + 1}`,
          companyId: data.companyId!,
          eventId: data.eventId!,
          ruleId: data.ruleId!,
          actionType: data.actionType!,
          correlationId: data.correlationId!,
          eventType: data.eventType ?? null,
          attemptCount: data.attemptCount ?? 1,
          startedAt: data.startedAt ?? now,
          completedAt: null,
          resultMetadata: null,
          lastErrorCode: null,
          status: 'PENDING',
          resultEntityType: null,
          resultEntityId: null,
          createdAt: now,
          updatedAt: now,
        };
        runs.push(row);
        return row;
      },
      findUnique: async ({ where }: { where: { companyId_eventId_ruleId_actionType: Record<string, string> } }) => {
        const k = where.companyId_eventId_ruleId_actionType;
        return runs.find((r) => r.companyId === k.companyId && r.eventId === k.eventId && r.ruleId === k.ruleId && r.actionType === k.actionType) ?? null;
      },
      findFirst: async ({ where }: { where: { id?: string; companyId?: string } }) =>
        runs.find((r) => (!where.id || r.id === where.id) && (!where.companyId || r.companyId === where.companyId)) ?? null,
      findMany: async () => runs,
      count: async () => runs.length,
      update: async () => {
        throw new Error('not used');
      },
      updateMany: async ({ where, data }: { where: { id: string; companyId: string; status?: string }; data: Record<string, unknown> }) => {
        const row = runs.find((r) => r.id === where.id && r.companyId === where.companyId && (!where.status || r.status === where.status));
        if (!row) return { count: 0 };
        Object.assign(row, data, { updatedAt: new Date() });
        return { count: 1 };
      },
    },
  };
}

const alwaysActiveGate = { assertActive: jest.fn().mockResolvedValue(undefined) };

beforeEach(() => {
  jest.clearAllMocks();
  alwaysActiveGate.assertActive.mockResolvedValue(undefined);
});

describe('gates.createNotification handler', () => {
  it('creates a SystemNotification, resolving bound fields from event data', async () => {
    (prisma.systemNotification.create as jest.Mock).mockResolvedValue({ id: 'notif-1' });

    const result = await notificationActionHandler.execute({
      companyId: COMPANY_A,
      eventId: 'evt-1',
      ruleId: 'rule-1',
      correlationId: 'corr-1',
      eventType: 'sales.invoice.created',
      config: { title: 'Large invoice', message: { source: 'event', field: 'invoiceNumber' } },
      eventData: { invoiceNumber: 'INV-100' },
    });

    expect(result.resultEntityType).toBe('SystemNotification');
    expect(result.resultEntityId).toBe('notif-1');
    expect(prisma.systemNotification.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ companyId: COMPANY_A, title: 'Large invoice', message: 'INV-100' }),
      })
    );
  });

  it('rejects when a targeted userId does not belong to the company', async () => {
    (prisma.user.findFirst as jest.Mock).mockResolvedValue(null);

    await expect(
      notificationActionHandler.execute({
        companyId: COMPANY_A,
        eventId: 'evt-2',
        ruleId: 'rule-1',
        correlationId: 'corr-2',
        eventType: 'sales.invoice.created',
        config: { title: 'Hi', message: 'Body', userId: 'foreign-user-id' },
      })
    ).rejects.toBeInstanceOf(AutomationActionDispatchError);
  });
});

describe('email.send handler', () => {
  it('rejects when SMTP is not configured (permanent, not transient)', async () => {
    (emailService.isEmailConfigured as jest.Mock).mockReturnValue(false);

    await expect(
      emailActionHandler.execute({
        companyId: COMPANY_A,
        eventId: 'evt-3',
        ruleId: 'rule-1',
        correlationId: 'corr-3',
        eventType: 'sales.invoice.created',
        config: { to: 'ops@example.com', subject: 'Hi', body: 'Body' },
      })
    ).rejects.toMatchObject({ statusCode: 400 });
  });

  it('rejects a malformed recipient address', async () => {
    (emailService.isEmailConfigured as jest.Mock).mockReturnValue(true);
    await expect(
      emailActionHandler.execute({
        companyId: COMPANY_A,
        eventId: 'evt-4',
        ruleId: 'rule-1',
        correlationId: 'corr-4',
        eventType: 'sales.invoice.created',
        config: { to: 'not-an-email', subject: 'Hi', body: 'Body' },
      })
    ).rejects.toMatchObject({ statusCode: 400 });
  });

  it('sends via the shared emailService when configured', async () => {
    (emailService.isEmailConfigured as jest.Mock).mockReturnValue(true);
    (emailService.sendEmail as jest.Mock).mockResolvedValue(undefined);

    const result = await emailActionHandler.execute({
      companyId: COMPANY_A,
      eventId: 'evt-5',
      ruleId: 'rule-1',
      correlationId: 'corr-5',
      eventType: 'sales.invoice.created',
      config: { to: 'ops@example.com', subject: 'Hi', body: 'Body' },
    });
    expect(result.resultEntityType).toBe('EmailSend');
    expect(emailService.sendEmail).toHaveBeenCalledWith(
      expect.objectContaining({ to: 'ops@example.com', subject: 'Hi' })
    );
  });
});

describe('AutomationActionDispatchService', () => {
  it('claims once, executes the handler, and marks the run succeeded', async () => {
    (prisma.systemNotification.create as jest.Mock).mockResolvedValue({ id: 'notif-1' });
    const runs = new AutomationActionRunService(createRunStore());
    const dispatch = new AutomationActionDispatchService([notificationActionHandler], runs, alwaysActiveGate);

    const result = await dispatch.execute({
      companyId: COMPANY_A,
      eventId: 'evt-1',
      ruleId: 'rule-1',
      actionType: 'gates.createNotification',
      correlationId: 'corr-1',
      eventType: 'sales.invoice.created',
      config: { title: 'Hi', message: 'Body' },
    });

    expect(result).toEqual({ success: true, duplicate: false, resultEntityType: 'SystemNotification', resultEntityId: 'notif-1' });
  });

  it('replays a duplicate request idempotently without re-running the handler', async () => {
    (prisma.systemNotification.create as jest.Mock).mockResolvedValue({ id: 'notif-1' });
    const runs = new AutomationActionRunService(createRunStore());
    const dispatch = new AutomationActionDispatchService([notificationActionHandler], runs, alwaysActiveGate);

    const input = {
      companyId: COMPANY_A,
      eventId: 'evt-1',
      ruleId: 'rule-1',
      actionType: 'gates.createNotification',
      correlationId: 'corr-1',
      eventType: 'sales.invoice.created',
      config: { title: 'Hi', message: 'Body' },
    };
    await dispatch.execute(input);
    (prisma.systemNotification.create as jest.Mock).mockClear();

    const replay = await dispatch.execute(input);
    expect(replay.duplicate).toBe(true);
    expect(prisma.systemNotification.create).not.toHaveBeenCalled();
  });

  it('marks the run FAILED and rethrows on a permanent handler error', async () => {
    const runs = new AutomationActionRunService(createRunStore());
    const dispatch = new AutomationActionDispatchService([emailActionHandler], runs, alwaysActiveGate);
    (emailService.isEmailConfigured as jest.Mock).mockReturnValue(false);

    await expect(
      dispatch.execute({
        companyId: COMPANY_A,
        eventId: 'evt-9',
        ruleId: 'rule-1',
        actionType: 'email.send',
        correlationId: 'corr-9',
        eventType: 'sales.invoice.created',
        config: { to: 'ops@example.com', subject: 'Hi', body: 'Body' },
      })
    ).rejects.toBeInstanceOf(AutomationActionDispatchError);

    const run = await runs.findByUnique({ companyId: COMPANY_A, eventId: 'evt-9', ruleId: 'rule-1', actionType: 'email.send' });
    expect(run?.status).toBe('FAILED');
  });

  it('rejects an actionType with no registered handler', async () => {
    const runs = new AutomationActionRunService(createRunStore());
    const dispatch = new AutomationActionDispatchService([notificationActionHandler], runs, alwaysActiveGate);

    await expect(
      dispatch.execute({
        companyId: COMPANY_A,
        eventId: 'evt-x',
        ruleId: 'rule-1',
        actionType: 'gates.unsupportedAction',
        correlationId: 'corr-x',
        eventType: 'sales.invoice.created',
        config: {},
      })
    ).rejects.toMatchObject({ statusCode: 400 });
  });
});
