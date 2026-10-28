import { Router, Response, Request } from 'express';
import { asyncHandler } from '../../../shared/middleware/async-handler';
import { posCommercialService } from '../services/pos-commercial.service';

const router = Router();

// Public (no login). asyncHandler is required: an unknown token throws 404, and on
// Express 4 an unwrapped rejection reaches `unhandledRejection`, which exits the process.
router.get(
  '/:token',
  asyncHandler(async (req: Request, res: Response) => {
    const data = await posCommercialService.receiptByToken(req.params.token);
    return void res.json({ status: 'success', data });
  })
);

export default router;
