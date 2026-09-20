import prisma from '../../../shared/database/prisma';
import { runWithoutTenantScoping } from '../../../shared/database/tenant-context';
import { purchaseOrderService } from '../../inventory/services/purchase-order.service';
import { AutomationPurchaseRequestService } from './automation-purchase-request.service';

export const automationPurchaseRequestService = new AutomationPurchaseRequestService(prisma, {
  createPurchaseOrder: (companyId, data) =>
    runWithoutTenantScoping(() =>
      purchaseOrderService.createPurchaseOrder(companyId, data as never)
    ),
  getPurchaseOrderById: (companyId, id) =>
    runWithoutTenantScoping(() => purchaseOrderService.getPurchaseOrderById(companyId, id)),
});
