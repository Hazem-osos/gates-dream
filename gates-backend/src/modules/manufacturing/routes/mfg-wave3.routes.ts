import { Router } from 'express';
import bomRoutes from './bom.routes';
import productionOrderRoutes from './production-order.routes';

const router = Router();

router.use('/boms', bomRoutes);
router.use('/orders', productionOrderRoutes);

export default router;
