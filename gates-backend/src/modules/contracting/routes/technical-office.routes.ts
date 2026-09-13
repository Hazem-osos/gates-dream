import type { Prisma } from '@prisma/client';
import { Router } from 'express';
import type { AuthRequest } from '../../../shared/auth/types';
import { asyncHandler } from '../../../shared/middleware/async-handler';
import { authenticate } from '../../../shared/middleware/auth.middleware';
import { authorize } from '../../../shared/middleware/authorize.middleware';
import { AppError } from '../../../shared/middleware/error-handler';
import { setTenantContext } from '../../../shared/middleware/tenant.middleware';
import { validateBody, validateParams } from '../../../shared/middleware/validate';
import {
  createMeasurementSheetSchema,
  createOwnerBoqItemSchema,
  idParamSchema,
  markupStructureSchema,
  notesOnlySchema,
  projectIdParamSchema,
  upsertRateAnalysisSchema,
} from '../schemas/contracting.validation';
import { technicalOfficeCommandService } from '../technical-office/services/technical-office-command.service';

const router = Router();
router.use(authenticate);
router.use(setTenantContext);

function requireCompanyId(req: AuthRequest): string {
  const companyId = req.companyId ?? req.tenantId;
  if (!companyId) throw new AppError(400, 'Company ID is required');
  return companyId;
}

router.post(
  '/projects/:projectId/boq',
  authorize({ resource: 'project', action: 'edit' }),
  validateParams(projectIdParamSchema),
  validateBody(createOwnerBoqItemSchema),
  asyncHandler(async (req, res) => {
    const data = await technicalOfficeCommandService.createOwnerBoqItem(
      requireCompanyId(req as AuthRequest),
      req.params.projectId,
      req.body
    );
    res.status(201).json({ status: 'success', data });
  })
);

router.get(
  '/projects/:projectId/boq',
  authorize({ resource: 'project', action: 'view' }),
  validateParams(projectIdParamSchema),
  asyncHandler(async (req, res) => {
    const data = await technicalOfficeCommandService.listProjectBoq(
      requireCompanyId(req as AuthRequest),
      req.params.projectId
    );
    res.json({ status: 'success', data });
  })
);

router.post(
  '/boq/:id/rate-analysis',
  authorize({ resource: 'project', action: 'edit' }),
  validateParams(idParamSchema),
  validateBody(upsertRateAnalysisSchema),
  asyncHandler(async (req, res) => {
    const data = await technicalOfficeCommandService.upsertRateAnalysis(
      requireCompanyId(req as AuthRequest),
      req.params.id,
      req.body
    );
    res.status(201).json({ status: 'success', data });
  })
);

router.post(
  '/boq/:id/markup',
  authorize({ resource: 'project', action: 'edit' }),
  validateParams(idParamSchema),
  validateBody(markupStructureSchema),
  asyncHandler(async (req, res) => {
    const data = await technicalOfficeCommandService.setMarkupAndComputeSellingPrice(
      requireCompanyId(req as AuthRequest),
      req.params.id,
      req.body
    );
    res.status(201).json({ status: 'success', data });
  })
);

router.get(
  '/boq/:id/measurements',
  authorize({ resource: 'project', action: 'view' }),
  validateParams(idParamSchema),
  asyncHandler(async (req, res) => {
    const data = await technicalOfficeCommandService.listMeasurementSheets(
      requireCompanyId(req as AuthRequest),
      req.params.id
    );
    res.json({ status: 'success', data });
  })
);

router.post(
  '/measurements',
  authorize({ resource: 'project', action: 'edit' }),
  validateBody(createMeasurementSheetSchema),
  asyncHandler(async (req, res) => {
    const body = req.body as {
      projectBOQItemId: string;
      sheetNumber: string;
      measurementDate: Date;
      locationZone?: string | null;
      axisGridRef?: string | null;
      statement?: string | null;
      multiplierCount?: string | number;
      dimensionLength?: string | number | null;
      dimensionWidth?: string | number | null;
      dimensionHeight?: string | number | null;
      deductionQty?: string | number;
      attachments?: Prisma.InputJsonValue | null;
    };
    const data = await technicalOfficeCommandService.createMeasurementSheet(
      requireCompanyId(req as AuthRequest),
      {
        projectBOQItemId: body.projectBOQItemId,
        sheetNumber: body.sheetNumber,
        measurementDate: body.measurementDate,
        locationZone: body.locationZone,
        axisGridRef: body.axisGridRef,
        statement: body.statement,
        multiplierCount: body.multiplierCount,
        dimensionLength: body.dimensionLength,
        dimensionWidth: body.dimensionWidth,
        dimensionHeight: body.dimensionHeight,
        deductionQty: body.deductionQty,
        attachments: body.attachments ?? null,
      }
    );
    res.status(201).json({ status: 'success', data });
  })
);

router.patch(
  '/measurements/:id/approve',
  authorize({ resource: 'invoice', action: 'approve' }),
  validateParams(idParamSchema),
  validateBody(notesOnlySchema),
  asyncHandler(async (req, res) => {
    const data = await technicalOfficeCommandService.approveMeasurementSheet(
      requireCompanyId(req as AuthRequest),
      req.params.id
    );
    res.json({ status: 'success', data });
  })
);

export default router;
