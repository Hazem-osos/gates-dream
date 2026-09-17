import { AppError } from '../../../shared/middleware/error-handler';
import { transactionSettingsService } from '../../transaction-settings/transaction-settings.service';

export async function resolveSecuritiesPaperNumbers(params: {
  companyId: string;
  kind: 'RECEIPT' | 'PAYMENT';
  serial?: string | null;
  documentNumber?: string | null;
  allocate: () => Promise<string | undefined>;
}): Promise<{ serial: string; documentNumber: string }> {
  const documentType = params.kind === 'RECEIPT' ? 'SECURITIES_RECEIPT' : 'SECURITIES_PAYMENT';
  const settings = await transactionSettingsService.getOrCreate(params.companyId, documentType);
  const typed = params.serial?.trim() || params.documentNumber?.trim() || '';

  if (settings.numberingMode === 'MANUAL') {
    if (!typed) {
      throw new AppError(422, 'أدخل المسلسل يدوياً — الترقيم مضبوط على يدوي في إعدادات الورقة');
    }
    return { serial: typed, documentNumber: typed };
  }

  const allocated = typed || (await params.allocate()) || '';
  if (!allocated) {
    throw new AppError(422, 'تعذر توليد مسلسل الورقة تلقائياً');
  }
  return { serial: allocated, documentNumber: allocated };
}
