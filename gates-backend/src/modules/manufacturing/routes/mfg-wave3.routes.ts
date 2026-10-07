import { Router } from 'express';
import bomRoutes from './bom.routes';
import productionOrderRoutes from './production-order.routes';
import manufacturingPlanRoutes from './manufacturing-plan.routes';
import itemAlternativeRoutes from './item-alternative.routes';
import manufacturingWorkOrderRoutes from './manufacturing-work-order.routes';

const router = Router();

router.use('/boms', bomRoutes);
router.use('/orders', productionOrderRoutes);
router.use('/plans', manufacturingPlanRoutes);
router.use('/item-alternatives', itemAlternativeRoutes);
router.use('/work-orders', manufacturingWorkOrderRoutes);

export default router;
