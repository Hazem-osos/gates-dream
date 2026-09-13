import { Router } from 'express';
import prisma from '../../../shared/database/prisma';
import type { AuthRequest } from '../../../shared/auth/types';
import { asyncHandler } from '../../../shared/middleware/async-handler';
import { authenticate } from '../../../shared/middleware/auth.middleware';
import { authorize } from '../../../shared/middleware/authorize.middleware';
import { AppError } from '../../../shared/middleware/error-handler';
import { setTenantContext } from '../../../shared/middleware/tenant.middleware';
import { validateBody, validateParams, validateQuery } from '../../../shared/middleware/validate';
import { boqExcelService } from '../excel/boq-excel.service';
import { uploadExcelMemory } from '../excel/excel-upload.middleware';
import { sendXlsx } from '../excel/excel-workbook';
import { measurementSheetExcelService } from '../excel/measurement-sheet-excel.service';
import type { BoqExcelType, BoqRowDto, MeasurementRowDto } from '../excel/types';
import {
  commitBoqImportSchema,
  commitMeasurementImportSchema,
  excelBoqTypeQuerySchema,
  excelExportBoqQuerySchema,
  excelMeasurementQuerySchema,
  projectIdParamSchema,
} from '../schemas/contracting.validation';

const router = Router();
router.use(authenticate);
router.use(setTenantContext);

function requireCompanyId(req: AuthRequest): string {
  const companyId = req.companyId ?? req.tenantId;
  if (!companyId) throw new AppError(400, 'Company ID is required');
  return companyId;
}

function requireFile(req: AuthRequest) {
  if (!req.file?.buffer) throw new AppError(400, 'لم يتم رفع ملف Excel');
  return req.file;
}

async function resolveProjectId(companyId: string, projectId?: string, subcontractId?: string): Promise<string> {
  if (projectId) return projectId;
  if (!subcontractId) throw new AppError(400, 'معرّف المشروع مطلوب');
  const subcontract = await prisma.subcontract.findFirst({
    where: { id: subcontractId, companyId },
    select: { projectId: true },
  });
  if (!subcontract) throw new AppError(404, 'عقد الباطن غير موجود');
  return subcontract.projectId;
}

router.get(
  '/template/boq',
  authorize({ resource: 'project', action: 'view' }),
  validateQuery(excelBoqTypeQuerySchema),
  asyncHandler(async (req, res) => {
    const type = ((req.query.type as BoqExcelType | undefined) ?? 'OWNER') as BoqExcelType;
    const file = await boqExcelService.generateBoqTemplate(type);
    sendXlsx(res, file.filename, file.buffer);
  })
);

router.get(
  '/template/measurements',
  authorize({ resource: 'project', action: 'view' }),
  validateQuery(excelMeasurementQuerySchema),
  asyncHandler(async (req, res) => {
    const file = await measurementSheetExcelService.generateMeasurementTemplate(
      requireCompanyId(req as AuthRequest),
      String(req.query.projectId)
    );
    sendXlsx(res, file.filename, file.buffer);
  })
);

router.post(
  '/validate/boq',
  authorize({ resource: 'project', action: 'edit' }),
  validateQuery(excelBoqTypeQuerySchema),
  uploadExcelMemory,
  asyncHandler(async (req, res) => {
    const companyId = requireCompanyId(req as AuthRequest);
    const type = ((req.query.type as BoqExcelType | undefined) ?? 'OWNER') as BoqExcelType;
    const subcontractId = req.query.subcontractId ? String(req.query.subcontractId) : undefined;
    const projectId = await resolveProjectId(companyId, req.query.projectId ? String(req.query.projectId) : undefined, subcontractId);
    const file = requireFile(req as AuthRequest);
    const data = await boqExcelService.parseAndValidateBoqExcel(
      companyId,
      projectId,
      file.buffer,
      type,
      file.originalname,
      subcontractId
    );
    res.json({ status: 'success', data });
  })
);

router.post(
  '/commit/boq',
  authorize({ resource: 'project', action: 'edit' }),
  validateBody(commitBoqImportSchema),
  asyncHandler(async (req, res) => {
    const companyId = requireCompanyId(req as AuthRequest);
    const { type, subcontractId, rows } = req.body as {
      type: BoqExcelType;
      projectId?: string;
      subcontractId?: string;
      rows: BoqRowDto[];
    };
    const projectId = await resolveProjectId(companyId, req.body.projectId, subcontractId);
    const data = await boqExcelService.commitBoqImport(companyId, projectId, rows, type, subcontractId);
    res.status(201).json({ status: 'success', data });
  })
);

router.post(
  '/validate/measurements',
  authorize({ resource: 'project', action: 'edit' }),
  validateQuery(excelMeasurementQuerySchema),
  uploadExcelMemory,
  asyncHandler(async (req, res) => {
    const file = requireFile(req as AuthRequest);
    const data = await measurementSheetExcelService.parseAndValidateMeasurements(
      requireCompanyId(req as AuthRequest),
      String(req.query.projectId),
      file.buffer,
      file.originalname
    );
    res.json({ status: 'success', data });
  })
);

router.post(
  '/commit/measurements',
  authorize({ resource: 'project', action: 'edit' }),
  validateBody(commitMeasurementImportSchema),
  asyncHandler(async (req, res) => {
    const { projectId, rows, status } = req.body as {
      projectId: string;
      rows: MeasurementRowDto[];
      status?: 'DRAFT' | 'SITE_ENGINEER_VERIFIED';
    };
    const data = await measurementSheetExcelService.commitMeasurementImport(
      requireCompanyId(req as AuthRequest),
      projectId,
      rows,
      status ?? 'DRAFT'
    );
    res.status(201).json({ status: 'success', data });
  })
);

router.get(
  '/export/boq/:projectId',
  authorize({ resource: 'project', action: 'view' }),
  validateParams(projectIdParamSchema),
  validateQuery(excelExportBoqQuerySchema),
  asyncHandler(async (req, res) => {
    const file = await boqExcelService.exportProjectBoq(
      requireCompanyId(req as AuthRequest),
      req.params.projectId,
      req.query.subcontractId ? String(req.query.subcontractId) : undefined
    );
    sendXlsx(res, file.filename, file.buffer);
  })
);

export default router;
