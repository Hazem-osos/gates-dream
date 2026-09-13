import { Router, Response } from 'express';
import { validate } from '../../../shared/middleware/validate';
import { authenticate } from '../../../shared/middleware/auth.middleware';
import { authorize } from '../../../shared/middleware/authorize.middleware';
import { setTenantContext } from '../../../shared/middleware/tenant.middleware';
import {
  clothingColorSchema,
  clothingSizeSchema,
  replaceClothingCombosSchema,
} from '../schemas/clothing-matrix.schema';
import { clothingMatrixService } from '../services/clothing-matrix.service';
import { logger } from '../../../shared/logger';
import { AuthRequest } from '../../../shared/auth/types';

const router = Router();
router.use(authenticate);
router.use(setTenantContext);

const guard = (action: 'view' | 'edit' | 'delete') => authorize({ resource: 'item', action });

function company(req: AuthRequest) {
  return req.companyId || req.tenantId;
}

router.get('/colors', guard('view'), async (req: AuthRequest, res: Response) => {
  try {
    const companyId = company(req);
    if (!companyId) return void res.status(400).json({ status: 'error', message: 'Company ID is required' });
    const data = await clothingMatrixService.listColors(companyId);
    return void res.json({ status: 'success', data });
  } catch (error) {
    logger.error({ error }, 'Error listing clothing colors');
    return void res.status(500).json({ status: 'error', message: 'تعذر العرض' });
  }
});

router.post('/colors', guard('edit'), validate({ body: clothingColorSchema }), async (req: AuthRequest, res: Response) => {
  try {
    const companyId = company(req);
    if (!companyId) return void res.status(400).json({ status: 'error', message: 'Company ID is required' });
    const data = await clothingMatrixService.upsertColor(companyId, undefined, req.body);
    return void res.status(201).json({ status: 'success', data });
  } catch (error) {
    logger.error({ error }, 'Error creating clothing color');
    return void res.status(500).json({ status: 'error', message: error instanceof Error ? error.message : 'تعذر الحفظ' });
  }
});

router.put('/colors/:id', guard('edit'), validate({ body: clothingColorSchema }), async (req: AuthRequest, res: Response) => {
  try {
    const companyId = company(req);
    if (!companyId) return void res.status(400).json({ status: 'error', message: 'Company ID is required' });
    const data = await clothingMatrixService.upsertColor(companyId, req.params.id, req.body);
    return void res.json({ status: 'success', data });
  } catch (error) {
    const status = error instanceof Error && error.message === 'Color not found' ? 404 : 500;
    return void res.status(status).json({ status: 'error', message: error instanceof Error ? error.message : 'تعذر الحفظ' });
  }
});

router.delete('/colors/:id', guard('delete'), async (req: AuthRequest, res: Response) => {
  try {
    const companyId = company(req);
    if (!companyId) return void res.status(400).json({ status: 'error', message: 'Company ID is required' });
    await clothingMatrixService.removeColor(companyId, req.params.id);
    return void res.status(204).send();
  } catch (error) {
    const status = error instanceof Error && error.message === 'Color not found' ? 404 : 500;
    return void res.status(status).json({ status: 'error', message: error instanceof Error ? error.message : 'تعذر الحذف' });
  }
});

router.get('/sizes', guard('view'), async (req: AuthRequest, res: Response) => {
  try {
    const companyId = company(req);
    if (!companyId) return void res.status(400).json({ status: 'error', message: 'Company ID is required' });
    const data = await clothingMatrixService.listSizes(companyId);
    return void res.json({ status: 'success', data });
  } catch (error) {
    logger.error({ error }, 'Error listing clothing sizes');
    return void res.status(500).json({ status: 'error', message: 'تعذر العرض' });
  }
});

router.post('/sizes', guard('edit'), validate({ body: clothingSizeSchema }), async (req: AuthRequest, res: Response) => {
  try {
    const companyId = company(req);
    if (!companyId) return void res.status(400).json({ status: 'error', message: 'Company ID is required' });
    const data = await clothingMatrixService.upsertSize(companyId, undefined, req.body);
    return void res.status(201).json({ status: 'success', data });
  } catch (error) {
    return void res.status(500).json({ status: 'error', message: error instanceof Error ? error.message : 'تعذر الحفظ' });
  }
});

router.put('/sizes/:id', guard('edit'), validate({ body: clothingSizeSchema }), async (req: AuthRequest, res: Response) => {
  try {
    const companyId = company(req);
    if (!companyId) return void res.status(400).json({ status: 'error', message: 'Company ID is required' });
    const data = await clothingMatrixService.upsertSize(companyId, req.params.id, req.body);
    return void res.json({ status: 'success', data });
  } catch (error) {
    const status = error instanceof Error && error.message === 'Size not found' ? 404 : 500;
    return void res.status(status).json({ status: 'error', message: error instanceof Error ? error.message : 'تعذر الحفظ' });
  }
});

router.delete('/sizes/:id', guard('delete'), async (req: AuthRequest, res: Response) => {
  try {
    const companyId = company(req);
    if (!companyId) return void res.status(400).json({ status: 'error', message: 'Company ID is required' });
    await clothingMatrixService.removeSize(companyId, req.params.id);
    return void res.status(204).send();
  } catch (error) {
    const status = error instanceof Error && error.message === 'Size not found' ? 404 : 500;
    return void res.status(status).json({ status: 'error', message: error instanceof Error ? error.message : 'تعذر الحذف' });
  }
});

router.get('/combos', guard('view'), async (req: AuthRequest, res: Response) => {
  try {
    const companyId = company(req);
    if (!companyId) return void res.status(400).json({ status: 'error', message: 'Company ID is required' });
    const data = await clothingMatrixService.listCombos(companyId);
    return void res.json({ status: 'success', data });
  } catch (error) {
    logger.error({ error }, 'Error listing clothing combos');
    return void res.status(500).json({ status: 'error', message: 'تعذر العرض' });
  }
});

router.put('/combos', guard('edit'), validate({ body: replaceClothingCombosSchema }), async (req: AuthRequest, res: Response) => {
  try {
    const companyId = company(req);
    if (!companyId) return void res.status(400).json({ status: 'error', message: 'Company ID is required' });
    const data = await clothingMatrixService.replaceCombos(companyId, req.body);
    return void res.json({ status: 'success', data });
  } catch (error) {
    logger.error({ error }, 'Error saving clothing combos');
    return void res.status(500).json({ status: 'error', message: error instanceof Error ? error.message : 'تعذر الحفظ' });
  }
});

export default router;
