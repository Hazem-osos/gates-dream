import { Router, Response } from 'express';
import { validate } from '../../../shared/middleware/validate';
import { authenticate } from '../../../shared/middleware/auth.middleware';
import { authorize } from '../../../shared/middleware/authorize.middleware';
import { setTenantContext } from '../../../shared/middleware/tenant.middleware';
import {
  createPersonSchema,
  updatePersonSchema,
  personQuerySchema,
  createPersonGroupSchema,
  updatePersonGroupSchema,
  createPersonItemPriceSchema,
  updatePersonItemPriceSchema,
  createCustomerCategorySchema,
  updateCustomerCategorySchema,
  createSupplierCategorySchema,
  updateSupplierCategorySchema,
} from '../schemas/party-masters.schema';
import {
  personService,
  personGroupService,
  personItemPriceService,
  customerCategoryService,
  supplierCategoryService,
} from '../services/party-masters.service';
import { AuthRequest } from '../../../shared/auth/types';

const router = Router();
router.use(authenticate);
router.use(setTenantContext);

function companyId(req: AuthRequest): string | undefined {
  return req.companyId || req.tenantId;
}

router.get(
  '/person-groups',
  authorize({ resource: 'customer', action: 'view' }),
  async (req: AuthRequest, res: Response) => {
    const cid = companyId(req);
    if (!cid) return void res.status(400).json({ status: 'error', message: 'Company ID is required' });
    const data = await personGroupService.list(cid);
    return void res.json({ status: 'success', data });
  }
);

router.post(
  '/person-groups',
  authorize({ resource: 'customer', action: 'edit' }),
  validate({ body: createPersonGroupSchema }),
  async (req: AuthRequest, res: Response) => {
    const cid = companyId(req);
    if (!cid) return void res.status(400).json({ status: 'error', message: 'Company ID is required' });
    const data = await personGroupService.create(cid, req.body);
    return void res.status(201).json({ status: 'success', data });
  }
);

router.put(
  '/person-groups/:id',
  authorize({ resource: 'customer', action: 'edit' }),
  validate({ body: updatePersonGroupSchema }),
  async (req: AuthRequest, res: Response) => {
    const cid = companyId(req);
    if (!cid) return void res.status(400).json({ status: 'error', message: 'Company ID is required' });
    const data = await personGroupService.update(cid, req.params.id, req.body);
    return void res.json({ status: 'success', data });
  }
);

router.get(
  '/persons',
  authorize({ resource: 'customer', action: 'view' }),
  validate({ query: personQuerySchema }),
  async (req: AuthRequest, res: Response) => {
    const cid = companyId(req);
    if (!cid) return void res.status(400).json({ status: 'error', message: 'Company ID is required' });
    const result = await personService.list(cid, {
      page: req.query.page as number | undefined,
      limit: req.query.limit as number | undefined,
      search: req.query.search as string | undefined,
      personGroupId: req.query.personGroupId as string | undefined,
      isActive: req.query.isActive as boolean | undefined,
    });
    return void res.json({ status: 'success', data: result.persons, pagination: result.pagination });
  }
);

router.post(
  '/persons',
  authorize({ resource: 'customer', action: 'edit' }),
  validate({ body: createPersonSchema }),
  async (req: AuthRequest, res: Response) => {
    const cid = companyId(req);
    if (!cid) return void res.status(400).json({ status: 'error', message: 'Company ID is required' });
    try {
      const data = await personService.create(cid, req.body);
      return void res.status(201).json({ status: 'success', data });
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Failed to create person';
      const status = msg.includes('already exists') ? 409 : 400;
      return void res.status(status).json({ status: 'error', message: msg });
    }
  }
);

router.get(
  '/persons/:id',
  authorize({ resource: 'customer', action: 'view' }),
  async (req: AuthRequest, res: Response) => {
    const cid = companyId(req);
    if (!cid) return void res.status(400).json({ status: 'error', message: 'Company ID is required' });
    try {
      const data = await personService.getById(cid, req.params.id);
      return void res.json({ status: 'success', data });
    } catch {
      return void res.status(404).json({ status: 'error', message: 'Person not found' });
    }
  }
);

router.put(
  '/persons/:id',
  authorize({ resource: 'customer', action: 'edit' }),
  validate({ body: updatePersonSchema }),
  async (req: AuthRequest, res: Response) => {
    const cid = companyId(req);
    if (!cid) return void res.status(400).json({ status: 'error', message: 'Company ID is required' });
    const data = await personService.update(cid, req.params.id, req.body);
    return void res.json({ status: 'success', data });
  }
);

router.delete(
  '/persons/:id',
  authorize({ resource: 'customer', action: 'delete' }),
  async (req: AuthRequest, res: Response) => {
    const cid = companyId(req);
    if (!cid) return void res.status(400).json({ status: 'error', message: 'Company ID is required' });
    await personService.delete(cid, req.params.id);
    return void res.status(204).send();
  }
);

router.get(
  '/person-item-prices',
  authorize({ resource: 'customer', action: 'view' }),
  async (req: AuthRequest, res: Response) => {
    const cid = companyId(req);
    const personId = req.query.personId as string;
    if (!cid || !personId) {
      return void res.status(400).json({ status: 'error', message: 'companyId and personId required' });
    }
    const data = await personItemPriceService.listForPerson(cid, personId);
    return void res.json({ status: 'success', data });
  }
);

router.post(
  '/person-item-prices',
  authorize({ resource: 'customer', action: 'edit' }),
  validate({ body: createPersonItemPriceSchema }),
  async (req: AuthRequest, res: Response) => {
    const cid = companyId(req);
    if (!cid) return void res.status(400).json({ status: 'error', message: 'Company ID is required' });
    const data = await personItemPriceService.create(cid, req.body);
    return void res.status(201).json({ status: 'success', data });
  }
);

router.get(
  '/customer-categories',
  authorize({ resource: 'customer', action: 'view' }),
  async (req: AuthRequest, res: Response) => {
    const cid = companyId(req);
    if (!cid) return void res.status(400).json({ status: 'error', message: 'Company ID is required' });
    const data = await customerCategoryService.list(cid);
    return void res.json({ status: 'success', data });
  }
);

router.post(
  '/customer-categories',
  authorize({ resource: 'customer', action: 'edit' }),
  validate({ body: createCustomerCategorySchema }),
  async (req: AuthRequest, res: Response) => {
    const cid = companyId(req);
    if (!cid) return void res.status(400).json({ status: 'error', message: 'Company ID is required' });
    try {
      const data = await customerCategoryService.create(cid, req.body);
      return void res.status(201).json({ status: 'success', data });
    } catch (e) {
      return void res.status(409).json({
        status: 'error',
        message: e instanceof Error ? e.message : 'تعذر إنشاء مجموعة العميل',
      });
    }
  }
);

router.put(
  '/customer-categories/:id',
  authorize({ resource: 'customer', action: 'edit' }),
  validate({ body: updateCustomerCategorySchema }),
  async (req: AuthRequest, res: Response) => {
    const cid = companyId(req);
    if (!cid) return void res.status(400).json({ status: 'error', message: 'Company ID is required' });
    const data = await customerCategoryService.update(cid, req.params.id, req.body);
    return void res.json({ status: 'success', data });
  }
);

router.delete(
  '/customer-categories/:id',
  authorize({ resource: 'customer', action: 'delete' }),
  async (req: AuthRequest, res: Response) => {
    const cid = companyId(req);
    if (!cid) return void res.status(400).json({ status: 'error', message: 'Company ID is required' });
    await customerCategoryService.delete(cid, req.params.id);
    return void res.json({ status: 'success', message: 'تم حذف مجموعة العميل' });
  }
);

router.get(
  '/supplier-categories',
  authorize({ resource: 'supplier', action: 'view' }),
  async (req: AuthRequest, res: Response) => {
    const cid = companyId(req);
    if (!cid) return void res.status(400).json({ status: 'error', message: 'Company ID is required' });
    const data = await supplierCategoryService.list(cid);
    return void res.json({ status: 'success', data });
  }
);

router.post(
  '/supplier-categories',
  authorize({ resource: 'supplier', action: 'edit' }),
  validate({ body: createSupplierCategorySchema }),
  async (req: AuthRequest, res: Response) => {
    const cid = companyId(req);
    if (!cid) return void res.status(400).json({ status: 'error', message: 'Company ID is required' });
    try {
      const data = await supplierCategoryService.create(cid, req.body);
      return void res.status(201).json({ status: 'success', data });
    } catch (e) {
      return void res.status(409).json({
        status: 'error',
        message: e instanceof Error ? e.message : 'تعذر إنشاء مجموعة المورد',
      });
    }
  }
);

router.put(
  '/supplier-categories/:id',
  authorize({ resource: 'supplier', action: 'edit' }),
  validate({ body: updateSupplierCategorySchema }),
  async (req: AuthRequest, res: Response) => {
    const cid = companyId(req);
    if (!cid) return void res.status(400).json({ status: 'error', message: 'Company ID is required' });
    const data = await supplierCategoryService.update(cid, req.params.id, req.body);
    return void res.json({ status: 'success', data });
  }
);

router.delete(
  '/supplier-categories/:id',
  authorize({ resource: 'supplier', action: 'delete' }),
  async (req: AuthRequest, res: Response) => {
    const cid = companyId(req);
    if (!cid) return void res.status(400).json({ status: 'error', message: 'Company ID is required' });
    await supplierCategoryService.delete(cid, req.params.id);
    return void res.json({ status: 'success', message: 'تم حذف مجموعة المورد' });
  }
);

export default router;
