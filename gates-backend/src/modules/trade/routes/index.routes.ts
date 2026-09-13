import { Router } from 'express';
import letterOfCreditRoutes from './letter-of-credit.routes';
import letterOfGuaranteeRoutes from './letter-of-guarantee.routes';

const router = Router();

router.use('/letters-of-credit', letterOfCreditRoutes);
router.use('/letters-of-guarantee', letterOfGuaranteeRoutes);

export default router;
