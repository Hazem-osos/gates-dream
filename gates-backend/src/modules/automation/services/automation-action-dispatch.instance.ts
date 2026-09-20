import prisma from '../../../shared/database/prisma';
import { AppError } from '../../../shared/middleware/error-handler';
import { automationActionRunService } from './automation-action-run.instance';
import { AutomationActionDispatchService } from './automation-action-dispatch.service';
import { notificationActionHandler } from './automation-notification-action.handler';
import { emailActionHandler } from './automation-email-action.handler';

export const automationActionDispatchService = new AutomationActionDispatchService(
  [notificationActionHandler, emailActionHandler],
  automationActionRunService,
  {
    async assertActive(companyId: string) {
      const company = await prisma.company.findUnique({
        where: { id: companyId },
        select: { id: true, isActive: true, deletedAt: true },
      });
      if (!company || company.deletedAt) {
        throw new AppError(404, 'Company not found');
      }
      if (!company.isActive) {
        throw new AppError(403, 'Company account is inactive');
      }
    },
  }
);
