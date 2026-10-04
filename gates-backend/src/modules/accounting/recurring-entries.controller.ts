import { Router, type Response } from 'express';
import { validate } from '../../shared/middleware/validate';
import { authenticate } from '../../shared/middleware/auth.middleware';
import { authorize } from '../../shared/middleware/authorize.middleware';
import { setTenantContext } from '../../shared/middleware/tenant.middleware';
import { tenantAndFiscalContextMiddleware } from '../../shared/middleware/tenant-fiscal-context.middleware';
import { AppError } from '../../shared/middleware/error-handler';
import { logger } from '../../shared/logger';
import type { AuthRequest } from '../../shared/auth/types';
import {
  createRecurringEntrySchema,
  recurringEntryQuerySchema,
} from './schemas/recurring-entry.schema';
import { recurringEntriesService } from './services/recurring-entries.service';
import { journalPostingService } from './services/journal-posting.service';
import prisma from '../../shared/database/prisma';

const router = Router();

router.use(authenticate);
router.use(setTenantContext);
router.use(tenantAndFiscalContextMiddleware);

router.get(
  '/',
  authorize({ resource: 'journal-entry', action: 'view' }),
  validate({ query: recurringEntryQuerySchema }),
  async (req: AuthRequest, res: Response) => {
    try {
      const companyId = req.companyId || req.tenantId;
      if (!companyId) {
        return void res.status(400).json({ status: 'error', message: 'معرّف الشركة مطلوب' });
      }
      const data = await recurringEntriesService.list(companyId, {
        search: req.query.search as string | undefined,
        includeInactive: Boolean((req.query as { includeInactive?: boolean }).includeInactive),
      });
      return void res.json({ status: 'success', data });
    } catch (error) {
      logger.error({ err: error }, 'Error listing recurring journal entries');
      if (error instanceof AppError) {
        return void res.status(error.statusCode).json({ status: 'error', message: error.message });
      }
      return void res.status(500).json({
        status: 'error',
        message: 'تعذر تحميل القيود الدورية',
      });
    }
  }
);

router.post(
  '/',
  authorize({ resource: 'journal-entry', action: 'edit' }),
  validate({ body: createRecurringEntrySchema }),
  async (req: AuthRequest, res: Response) => {
    try {
      const companyId = req.companyId || req.tenantId;
      if (!companyId) {
        return void res.status(400).json({ status: 'error', message: 'معرّف الشركة مطلوب' });
      }
      const created = await recurringEntriesService.create(companyId, req.body);
      return void res.status(201).json({
        status: 'success',
        message: 'تم حفظ القيد الدوري',
        data: created,
      });
    } catch (error) {
      logger.error({ err: error }, 'Error creating recurring journal entry');
      if (error instanceof AppError) {
        return void res.status(error.statusCode).json({ status: 'error', message: error.message });
      }
      return void res.status(500).json({
        status: 'error',
        message: 'تعذر حفظ القيد الدوري',
      });
    }
  }
);

router.post(
  '/:id/generate',
  authorize({ resource: 'journal-entry', action: 'edit' }),
  async (req: AuthRequest, res: Response) => {
    try {
      const companyId = req.companyId || req.tenantId;
      const userId = req.user?.sub;
      if (!companyId) {
        return void res.status(400).json({ status: 'error', message: 'معرّف الشركة مطلوب' });
      }
      if (!userId) {
        return void res.status(401).json({ status: 'error', message: 'User context is required' });
      }
      const template = await recurringEntriesService.getActive(companyId, req.params.id);
      const settings = await prisma.companySettings.findFirst({
        where: { companyId },
        select: { defaultCurrency: true },
      });
      const entry = await journalPostingService.createJournalEntry(
        {
          companyId,
          branchId: req.branchId,
          fiscalYearId: req.fiscalYearId,
          userId,
        },
        {
          date: new Date(),
          description: template.templateNameAr,
          currencyCode: settings?.defaultCurrency || 'EGP',
          sourceType: 'RECURRING_TEMPLATE',
          sourceId: template.id,
          isRecurring: false,
          lines: template.lines.map((line, index) => ({
            accountId: line.accountId,
            costCenterId: line.costCenterId ?? undefined,
            description: line.description ?? undefined,
            debit: Number(line.debit),
            credit: Number(line.credit),
            lineOrder: index + 1,
          })),
        }
      );
      await recurringEntriesService.markGenerated(companyId, template.id);
      return void res.status(201).json({
        status: 'success',
        message: 'تم توليد القيد من القالب',
        data: entry,
      });
    } catch (error) {
      logger.error({ err: error }, 'Error generating recurring journal entry');
      if (error instanceof AppError) {
        return void res.status(error.statusCode).json({ status: 'error', message: error.message });
      }
      return void res.status(500).json({
        status: 'error',
        message: 'تعذر توليد القيد الدوري',
      });
    }
  }
);

export default router;
