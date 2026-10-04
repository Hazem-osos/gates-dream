import { Router, Response, Request } from 'express';
import { posCommercialService } from '../services/pos-commercial.service';

const router = Router();

router.get('/:token', async (req: Request, res: Response) => {
  const data = await posCommercialService.receiptByToken(req.params.token);
  return void res.json({ status: 'success', data });
});

export default router;
