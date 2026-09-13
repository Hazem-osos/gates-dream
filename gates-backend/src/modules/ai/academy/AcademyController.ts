import { Response } from 'express';
import type { AuthRequest } from '../../../shared/auth/types';
import { AppError } from '../../../shared/middleware/error-handler';
import type { AcademyModuleQuery, AcademyProgressBody } from './academy.schema';
import type { AcademyTourService } from './AcademyTourService';

function requireActor(req: AuthRequest): { userId: string; companyId: string; role?: string } {
  const userId = req.user?.sub;
  const companyId = req.companyId ?? req.tenantId;
  if (!userId) throw new AppError(401, 'Authentication required');
  if (!companyId) throw new AppError(400, 'Company ID is required');
  const role = req.user?.role || req.user?.realm_access?.roles?.[0];
  return { userId, companyId, role };
}

export class AcademyController {
  constructor(private readonly academyTourService: AcademyTourService) {}

  checkStatus = async (req: AuthRequest, res: Response) => {
    const actor = requireActor(req);
    const query = req.query as AcademyModuleQuery;
    const data = await this.academyTourService.checkStatus({
      ...actor,
      moduleSlug: query.moduleSlug,
      currentPath: query.currentPath,
    });
    return void res.json({ status: 'success', data });
  };

  getTour = async (req: AuthRequest, res: Response) => {
    const actor = requireActor(req);
    const query = req.query as AcademyModuleQuery;
    const data = await this.academyTourService.getTour({
      ...actor,
      moduleSlug: query.moduleSlug,
      currentPath: query.currentPath,
    });
    return void res.json({ status: 'success', data });
  };

  recordProgress = async (req: AuthRequest, res: Response) => {
    const actor = requireActor(req);
    const body = req.body as AcademyProgressBody;
    const data = await this.academyTourService.recordProgress({
      ...actor,
      progress: body,
    });
    return void res.json({ status: 'success', data });
  };
}
