import { Router } from 'express';
import buildingsRoutes from './buildings.routes';
import unitsRoutes from './units.routes';
import contractsRoutes from './contracts.routes';
import installmentsRoutes from './installments.routes';
import portfolioRoutes from './portfolio.routes';

const router = Router();

router.use(portfolioRoutes);
router.use('/buildings', buildingsRoutes);
router.use('/units', unitsRoutes);
router.use('/contracts', contractsRoutes);
router.use('/installments', installmentsRoutes);

export default router;
