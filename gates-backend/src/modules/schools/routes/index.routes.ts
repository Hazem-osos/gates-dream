import { Router } from 'express';
import gradesRoutes from './grades.routes';
import studentsRoutes from './students.routes';
import contractsRoutes from './contracts.routes';
import installmentsRoutes from './installments.routes';
// Legacy list/create surfaces still used by report filters and construction pages.
import stageRoutes from './stage.routes';
import semesterRoutes from './semester.routes';
import collectorRoutes from './collector.routes';

const router = Router();

router.use('/grades', gradesRoutes);
router.use('/students', studentsRoutes);
router.use('/contracts', contractsRoutes);
router.use('/installments', installmentsRoutes);
router.use('/stages', stageRoutes);
router.use('/semesters', semesterRoutes);
router.use('/collectors', collectorRoutes);

export default router;
