import { Prisma } from '@prisma/client';
import { AppError } from '../../shared/middleware/error-handler';
import {
  stockMutationMessage,
  stockMutationStatus,
} from '../../modules/inventory/utils/stock-route-error';

describe('stock route errors', () => {
  it('keeps AppError status and Arabic message', () => {
    const error = new AppError(422, 'السنة المالية مغلقة');
    expect(stockMutationStatus(error)).toBe(422);
    expect(stockMutationMessage(error, 'fallback')).toBe('السنة المالية مغلقة');
  });

  it('hides Prisma-looking English from the client', () => {
    const error = new Error('Invalid `prisma.receipt.create()` invocation');
    expect(stockMutationMessage(error, 'تعذّر الحفظ')).toBe(
      'تعذّر حفظ البيانات. الحل: راجع الحقول وأعد المحاولة.'
    );
  });

  it('maps duplicate activeSourceKey to 409 with Arabic text', () => {
    const error = new Prisma.PrismaClientKnownRequestError('duplicate', {
      code: 'P2002',
      clientVersion: 'test',
      meta: { target: ['activeSourceKey'] },
    });
    expect(stockMutationStatus(error)).toBe(409);
    expect(stockMutationMessage(error, 'fallback')).toContain('قيد محاسبي');
  });
});
