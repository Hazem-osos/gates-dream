import { confirmAction } from '@/lib/feedback/confirm';

export const CONFIRM_NEGATIVE_STOCK_UNPOST = 'CONFIRM_NEGATIVE_STOCK_UNPOST';
export const CONFIRM_NEGATIVE_STOCK_POST = 'CONFIRM_NEGATIVE_STOCK_POST';

/** 409 / shortage that asks for explicit confirmation before allowing negative stock. */
export function isConfirmNegativeStockUnpostError(error: {
  code?: string;
  message?: string;
}): boolean {
  if (
    error.code === CONFIRM_NEGATIVE_STOCK_UNPOST ||
    error.code === CONFIRM_NEGATIVE_STOCK_POST
  ) {
    return true;
  }
  const message = error.message ?? '';
  if (message.includes('تحت مسؤوليتك') && message.includes('الرصيد سيصبح بالسالب')) {
    return true;
  }
  return message.includes('الكمية المتاحة لا تكفي، الرصيد سيصبح بالسالب');
}

export async function confirmNegativeStockOverride(message: string): Promise<boolean> {
  return confirmAction({
    title: 'تحذير: رصيد مخزني سالب',
    message,
    confirmLabel: 'المتابعة على مسؤوليتي',
    tone: 'warning',
  });
}

export function retryIfNegativeStockConfirm(
  error: { code?: string; message?: string },
  variables: Record<string, unknown> | undefined,
  retry: (body: Record<string, boolean>) => void,
  flag: 'confirmNegativeStockUnpost' | 'confirmNegativeStockPost' = 'confirmNegativeStockUnpost'
): boolean {
  if (!isConfirmNegativeStockUnpostError(error) || variables?.[flag] === true) {
    return false;
  }
  void (async () => {
    const ok = await confirmNegativeStockOverride(error.message ?? '');
    if (ok) retry({ [flag]: true });
  })();
  return true;
}
