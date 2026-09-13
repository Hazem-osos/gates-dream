import { Router } from 'express';
import projectsRoutes from './projects.routes';
import clientExtractsRoutes from './client-extracts.routes';
import subcontractorExtractsRoutes from './subcontractor-extracts.routes';
import boqRoutes from './boq.routes';
import contractExtractsRoutes from './contract-extracts.routes';
import technicalOfficeRoutes from './technical-office.routes';
import clientBillingRoutes from './client-billing.routes';
import lettersOfGuaranteeRoutes from './letters-of-guarantee.routes';
import costControlRoutes from './cost-control.routes';
import dashboardRoutes from './dashboard.routes';
import excelRoutes from './excel.routes';

const router = Router();

router.use('/dashboard', dashboardRoutes);
router.use('/excel', excelRoutes);
router.use('/projects', projectsRoutes);
router.use('/client-extracts', clientExtractsRoutes);
router.use('/subcontractor-extracts', subcontractorExtractsRoutes);
router.use('/boq', boqRoutes);
router.use('/extracts', contractExtractsRoutes);
router.use('/technical-office', technicalOfficeRoutes);
router.use('/client-billing', clientBillingRoutes);
router.use('/letters-of-guarantee', lettersOfGuaranteeRoutes);
router.use('/cost-control', costControlRoutes);

export default router;
