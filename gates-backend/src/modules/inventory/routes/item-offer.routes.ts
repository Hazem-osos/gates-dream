import { Router, Response } from 'express';
import { validate } from '../../../shared/middleware/validate';
import { authenticate } from '../../../shared/middleware/auth.middleware';
import { authorize } from '../../../shared/middleware/authorize.middleware';
import { setTenantContext } from '../../../shared/middleware/tenant.middleware';
import {
  itemOfferSchema,
  updateItemOfferSchema,
  itemOfferQuerySchema,
} from '../schemas/item-offer.schema';
import { itemOfferService } from '../services/item-offer.service';
import { logger } from '../../../shared/logger';
import { AuthRequest } from '../../../shared/auth/types';

const router = Router();

router.use(authenticate);
router.use(setTenantContext);

/**
 * POST /api/v1/inventory/item-offers
 * Create item offer
 */
router.post(
  '/',
  authorize({ resource: 'invoice', action: 'edit' }),
  validate({ body: itemOfferSchema }),
  async (req: AuthRequest, res: Response) => {
    try {
      const companyId = req.companyId || req.tenantId;
      if (!companyId) {
        return void res.status(400).json({
          status: 'error',
          message: 'Company ID is required',
        });
      }

      const offer = await itemOfferService.createItemOffer(companyId, {
        companyId,
        branchId: req.body.branchId || req.branchId || undefined,
        nameAr: req.body.nameAr,
        description: req.body.description,
        serial: req.body.serial,
        how: req.body.how,
        type: req.body.type,
        source: req.body.source,
        fromItemId: req.body.fromItemId,
        quantity: req.body.quantity,
        percentage: req.body.percentage,
        offerQuantity: req.body.offerQuantity,
        toItemId: req.body.toItemId || undefined,
        invoiceValue: req.body.invoiceValue,
        supplierId: req.body.supplierId || undefined,
        unitId: req.body.unitId || undefined,
        applyToAllParties: req.body.applyToAllParties,
        applyToAllPatterns: req.body.applyToAllPatterns,
        targetPartyIds: req.body.targetPartyIds,
        targetPatternIds: req.body.targetPatternIds,
        fromDate: req.body.fromDate,
        toDate: req.body.toDate,
        fromDateHijri: req.body.fromDateHijri,
        toDateHijri: req.body.toDateHijri,
        isActive: req.body.isActive,
      });

      logger.info({ companyId, offerId: offer.id }, 'Item offer created');

      return void res.status(201).json({
        status: 'success',
        message: 'Item offer created successfully',
        data: offer,
      });
    } catch (error) {
      logger.error({ error }, 'Error creating item offer');
      const status =
        error instanceof Error &&
        (error.message.includes('not found') ||
          error.message.includes('does not belong') ||
          error.message.includes('must be') ||
          error.message.includes('required'))
          ? 400
          : 500;
      return void res.status(status).json({
        status: 'error',
        message:
          error instanceof Error
            ? error.message
            : 'Failed to create item offer',
      });
    }
  }
);

/**
 * GET /api/v1/inventory/item-offers
 * List item offers
 */
router.get(
  '/',
  authorize({ resource: 'invoice', action: 'view' }),
  validate({ query: itemOfferQuerySchema }),
  async (req: AuthRequest, res: Response) => {
    try {
      const companyId = req.companyId || req.tenantId;
      if (!companyId) {
        return void res.status(400).json({
          status: 'error',
          message: 'Company ID is required',
        });
      }

      const result = await itemOfferService.listItemOffers(companyId, {
        branchId: req.query.branchId as string | undefined,
        how: req.query.how as any,
        type: req.query.type as any,
        source: req.query.source as any,
        fromItemId: req.query.fromItemId as string | undefined,
        isActive: req.query.isActive as boolean | undefined,
        fromDate: req.query.fromDate as string | undefined,
        toDate: req.query.toDate as string | undefined,
        skip: req.query.skip as number | undefined,
        take: req.query.take as number | undefined,
      });

      return void res.json({
        status: 'success',
        data: result.data,
        pagination: {
          total: result.total,
          skip: result.skip,
          take: result.take,
        },
      });
    } catch (error) {
      logger.error({ error }, 'Error listing item offers');
      return void res.status(500).json({
        status: 'error',
        message:
          error instanceof Error
            ? error.message
            : 'Failed to list item offers',
      });
    }
  }
);

/**
 * GET /api/v1/inventory/item-offers/applicable
 * Must be registered before `/:id`.
 */
router.get(
  '/applicable',
  authorize({ resource: 'invoice', action: 'view' }),
  async (req: AuthRequest, res: Response) => {
    try {
      const companyId = req.companyId || req.tenantId;
      if (!companyId) {
        return void res.status(400).json({
          status: 'error',
          message: 'Company ID is required',
        });
      }

      const { itemId, quantity, invoiceType, supplierId, unitId, invoiceValue, date, partyId, patternId } =
        req.query;

      if (!itemId || !quantity || !invoiceType) {
        return void res.status(400).json({
          status: 'error',
          message: 'itemId, quantity, and invoiceType are required',
        });
      }

      const offers = await itemOfferService.getApplicableOffers(
        companyId,
        itemId as string,
        parseFloat(quantity as string),
        invoiceType as 'purchases' | 'sales',
        supplierId as string | undefined,
        unitId as string | undefined,
        invoiceValue ? parseFloat(invoiceValue as string) : undefined,
        date ? new Date(date as string) : undefined,
        (partyId as string | undefined) || (supplierId as string | undefined),
        patternId as string | undefined
      );

      return void res.json({
        status: 'success',
        data: offers,
        count: offers.length,
      });
    } catch (error) {
      logger.error({ error }, 'Error getting applicable offers');
      return void res.status(500).json({
        status: 'error',
        message:
          error instanceof Error
            ? error.message
            : 'Failed to get applicable offers',
      });
    }
  }
);

/**
 * GET /api/v1/inventory/item-offers/:id
 * Get item offer by ID
 */
router.get(
  '/:id',
  authorize({ resource: 'invoice', action: 'view' }),
  async (req: AuthRequest, res: Response) => {
    try {
      const companyId = req.companyId || req.tenantId;
      if (!companyId) {
        return void res.status(400).json({
          status: 'error',
          message: 'Company ID is required',
        });
      }

      const offer = await itemOfferService.getItemOfferById(
        companyId,
        req.params.id
      );

      return void res.json({
        status: 'success',
        data: offer,
      });
    } catch (error) {
      logger.error({ error }, 'Error getting item offer');
      const status =
        error instanceof Error && error.message === 'Item offer not found'
          ? 404
          : 500;
      return void res.status(status).json({
        status: 'error',
        message:
          error instanceof Error
            ? error.message
            : 'Failed to get item offer',
      });
    }
  }
);

/**
 * PUT /api/v1/inventory/item-offers/:id
 * Update item offer
 */
router.put(
  '/:id',
  authorize({ resource: 'invoice', action: 'edit' }),
  validate({ body: updateItemOfferSchema }),
  async (req: AuthRequest, res: Response) => {
    try {
      const companyId = req.companyId || req.tenantId;
      if (!companyId) {
        return void res.status(400).json({
          status: 'error',
          message: 'Company ID is required',
        });
      }

      const offer = await itemOfferService.updateItemOffer(
        companyId,
        req.params.id,
        req.body
      );

      logger.info({ companyId, offerId: req.params.id }, 'Item offer updated');

      return void res.json({
        status: 'success',
        message: 'Item offer updated successfully',
        data: offer,
      });
    } catch (error) {
      logger.error({ error }, 'Error updating item offer');
      const status =
        error instanceof Error &&
        (error.message === 'Item offer not found' ||
          error.message.includes('not found') ||
          error.message.includes('does not belong') ||
          error.message.includes('must be'))
          ? 400
          : 500;
      return void res.status(status).json({
        status: 'error',
        message:
          error instanceof Error
            ? error.message
            : 'Failed to update item offer',
      });
    }
  }
);

/**
 * DELETE /api/v1/inventory/item-offers/:id
 * Delete item offer
 */
router.delete(
  '/:id',
  authorize({ resource: 'invoice', action: 'delete' }),
  async (req: AuthRequest, res: Response) => {
    try {
      const companyId = req.companyId || req.tenantId;
      if (!companyId) {
        return void res.status(400).json({
          status: 'error',
          message: 'Company ID is required',
        });
      }

      await itemOfferService.deleteItemOffer(companyId, req.params.id);

      logger.info({ companyId, offerId: req.params.id }, 'Item offer deleted');

      return void res.json({
        status: 'success',
        message: 'Item offer deleted successfully',
      });
    } catch (error) {
      logger.error({ error }, 'Error deleting item offer');
      const status =
        error instanceof Error && error.message === 'Item offer not found'
          ? 404
          : 500;
      return void res.status(status).json({
        status: 'error',
        message:
          error instanceof Error
            ? error.message
            : 'Failed to delete item offer',
      });
    }
  }
);

export default router;

