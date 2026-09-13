export type SentinelAlertLevel = 'info' | 'warn' | 'crit';

export type SentinelAlertDto = {
  id: string;
  level: SentinelAlertLevel;
  text: string;
  detail?: string;
  href?: string;
};

export type SentinelAlertsPayload = {
  mode: 'training' | 'live';
  engineEnabled: boolean;
  alerts: SentinelAlertDto[];
  updatedAt: string;
};

const TRAINING_ALERTS: SentinelAlertDto[] = [
  {
    id: 'train-1',
    level: 'warn',
    text: 'بيع بأقل من متوسط التكلفة — صنف #1042 (مسودة)',
    detail:
      'مثال تدريبي: سطر فاتورة بيع بسعر 95 بينما متوسط التكلفة 110 — Sentinel يوقف الترحيل أو يطلب موافقة مدير.',
    href: '/inventory/operations/sales-invoice',
  },
  {
    id: 'train-2',
    level: 'info',
    text: 'خصم 18% تجاوز حد السياسة — فاتورة #SI-2401',
    detail: 'مثال تدريبي: خصم أعلى من سقف العميل/السياسة — يُسجَّل في سجل الرقابة.',
  },
  {
    id: 'train-3',
    level: 'crit',
    text: 'تعديل حركة مخزنية بعد 22:00 — مستخدم admin',
    detail: 'مثال تدريبي: حركة مخزون خارج ساعات العمل — تنبيه فوري للمدير المالي.',
    href: '/inventory/operations/issue',
  },
];

function isEngineEnabled(): boolean {
  return String(process.env.SENTINEL_ENGINE_ENABLED ?? '').toLowerCase() === 'true';
}

/** Placeholder for production rules engine — extend with DB / rule pipeline. */
async function scanLiveAlerts(_params: {
  companyId: string;
  branchId?: string;
}): Promise<SentinelAlertDto[]> {
  return [];
}

export class SentinelAlertsService {
  async getAlerts(params: { companyId: string; branchId?: string }): Promise<SentinelAlertsPayload> {
    const engineEnabled = isEngineEnabled();
    const updatedAt = new Date().toISOString();

    if (!engineEnabled) {
      return {
        mode: 'training',
        engineEnabled: false,
        alerts: TRAINING_ALERTS,
        updatedAt,
      };
    }

    const live = await scanLiveAlerts(params);
    return {
      mode: 'live',
      engineEnabled: true,
      alerts: live,
      updatedAt,
    };
  }
}

export const sentinelAlertsService = new SentinelAlertsService();
