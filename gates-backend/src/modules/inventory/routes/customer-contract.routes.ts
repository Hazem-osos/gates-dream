import { Router } from 'express';
import { authenticate } from '../../../shared/middleware/auth.middleware';
import { authorize } from '../../../shared/middleware/authorize.middleware';
import { setTenantContext } from '../../../shared/middleware/tenant.middleware';
import { validate } from '../../../shared/middleware/validate';
import {
  createCustomerContractSchema,
  updateCustomerContractSchema,
  customerContractQuerySchema,
} from '../schemas/customer-contract.schema';
import { customerContractService } from '../services/customer-contract.service';
import { AuthRequest } from '../../../shared/auth/types';

const router = Router();

// All routes require authentication and tenant context
router.use(authenticate);
router.use(setTenantContext);

/**
 * @route   POST /api/v1/inventory/customer-contracts
 * @desc    Create a new customer contract
 * @access  Private
 */
router.post(
  '/',
  authorize({ resource: 'customer-contract', action: 'edit' }),
  validate({ body: createCustomerContractSchema }),
  async (req: AuthRequest, res, next) => {
    try {
      const companyId = req.companyId!;
      const contract = await customerContractService.createCustomerContract(
        companyId,
        req.body
      );
      return void res.status(201).json({ status: 'success', data: contract });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * @route   GET /api/v1/inventory/customer-contracts
 * @desc    List customer contracts with pagination and filters
 * @access  Private
 */
router.get(
  '/',
  authorize({ resource: 'customer-contract', action: 'view' }),
  validate({ query: customerContractQuerySchema }),
  async (req: AuthRequest, res, next) => {
    try {
      const companyId = req.companyId!;
      const result = await customerContractService.listCustomerContracts(
        companyId,
        {
          page: req.query.page as number | undefined,
          limit: req.query.limit as number | undefined,
          search: req.query.search as string | undefined,
          customerId: req.query.customerId as string | undefined,
          contractType: req.query.contractType as string | undefined,
          isActive: req.query.isActive as boolean | undefined,
        }
      );
      return void res.json({
        status: 'success',
        data: result.contracts,
        pagination: result.pagination,
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * @route   GET /api/v1/inventory/customer-contracts/:id
 * @desc    Get customer contract by ID
 * @access  Private
 */
router.get('/:id', authorize({ resource: 'customer-contract', action: 'view' }), async (req: AuthRequest, res, next) => {
  try {
    const companyId = req.companyId!;
    const contract = await customerContractService.getCustomerContractById(
      companyId,
      req.params.id
    );
    return void res.json({ status: 'success', data: contract });
  } catch (error) {
    next(error);
  }
});

/**
 * @route   PUT /api/v1/inventory/customer-contracts/:id
 * @desc    Update customer contract
 * @access  Private
 */
router.put(
  '/:id',
  authorize({ resource: 'customer-contract', action: 'edit' }),
  validate({ body: updateCustomerContractSchema }),
  async (req: AuthRequest, res, next) => {
    try {
      const companyId = req.companyId!;
      const contract = await customerContractService.updateCustomerContract(
        companyId,
        req.params.id,
        req.body
      );
      return void res.json({ status: 'success', data: contract });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * @route   DELETE /api/v1/inventory/customer-contracts/:id
 * @desc    Delete customer contract (soft delete)
 * @access  Private
 */
router.delete('/:id', authorize({ resource: 'customer-contract', action: 'delete' }), async (req: AuthRequest, res, next) => {
  try {
    const companyId = req.companyId!;
    await customerContractService.deleteCustomerContract(
      companyId,
      req.params.id
    );
    return void res.json({ success: true });
  } catch (error) {
    next(error);
  }
});

export default router;

