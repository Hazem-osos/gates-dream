import { Router } from 'express';
import documentaryCreditDefinitionRoutes from './documentary-credit-definition.routes';
import documentaryCreditRoutes from './documentary-credit.routes';
import letterOfGuaranteeSettingsRoutes from './letter-of-guarantee-settings.routes';
import letterOfGuaranteeRoutes from './letter-of-guarantee.routes';
import reportsRoutes from './reports.routes';

const router = Router();

// Accreditation routes
router.use('/accreditations/documentary-credit-definitions', documentaryCreditDefinitionRoutes);
router.use('/accreditations/documentary-credits', documentaryCreditRoutes);
router.use('/accreditations/letter-of-guarantee-settings', letterOfGuaranteeSettingsRoutes);
router.use('/accreditations/letters-of-guarantee', letterOfGuaranteeRoutes);

// Report routes
router.use('/reports', reportsRoutes);

export default router;

