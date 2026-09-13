import prisma from '../../../shared/database/prisma';
import { persistChatAudit } from '../security/ai-chat-audit';
import type { ConversationActor } from '../services/ai-conversation.store';
import type {
  CompanyGuardSettings,
  DiagnoseErrorInput,
  DiagnoseErrorResult,
  DiagnoseQuickFix,
} from './error-diagnostic.types';

function num(value: unknown): number | undefined {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && value.trim()) {
    const parsed = Number(value.replace(/,/g, ''));
    return Number.isFinite(parsed) ? parsed : undefined;
  }
  return undefined;
}

function money(value: number): string {
  if (Number.isInteger(value)) return String(value);
  return value.toLocaleString('ar-EG', { maximumFractionDigits: 2 });
}

function normalizeCode(code: string, message?: string): string {
  const blob = `${code} ${message ?? ''}`.toUpperCase();
  if (/PRICE_BELOW_COST|BELOW_COST|أقل من(?: سعر)? التكلفة|بيع بخسارة|البيع بأقل/.test(blob)) {
    return 'PRICE_BELOW_COST';
  }
  if (/NEGATIVE_STOCK|رصيد سالب|غير متوفر/.test(blob)) return 'NEGATIVE_STOCK_ERROR';
  if (/DOCUMENT_IS_POSTED|IS_POSTED|مرحّل|مرحل/.test(blob)) return 'DOCUMENT_IS_POSTED';
  if (/READ_ONLY|عرض فقط|السابق/.test(blob)) return 'DOCUMENT_READ_ONLY';
  if (/SAVE_DISABLED|REQUIRED|إلزام|الحفظ معطل/.test(blob)) return 'SAVE_DISABLED';
  return code.trim().toUpperCase() || 'UNKNOWN';
}

function settingsHref(route?: string): string {
  if (route?.includes('purchase')) return '/inventory/settings/transactions/purchase-invoice';
  if (route?.includes('return')) return '/inventory/settings/transactions/sales-return';
  return '/inventory/settings/transactions/sales-invoice';
}

async function loadGuards(companyId: string): Promise<CompanyGuardSettings> {
  const row = await prisma.companySettings.findFirst({
    where: { companyId },
    select: { preventSellingBelowCost: true, preventNegativeStock: true },
  });
  return {
    preventSellingBelowCost: row?.preventSellingBelowCost === true,
    preventNegativeStock: row?.preventNegativeStock !== false,
  };
}

function diagnoseCode(
  code: string,
  input: DiagnoseErrorInput,
  guards: CompanyGuardSettings
): Omit<DiagnoseErrorResult, 'errorCode' | 'settingsSnapshot'> {
  const values = input.formValues ?? {};
  const price = num(values.itemPrice ?? values.price ?? values.unitPrice);
  const cost = num(values.cost ?? values.averageCost ?? values.itemCost);

  if (code === 'PRICE_BELOW_COST') {
    const sellLabel = price != null ? ` (${money(price)} ج.م)` : '';
    const costLabel = cost != null ? ` (${money(cost)} ج.م)` : '';
    return {
      explanationAr: `سعر البيع المسجل${sellLabel} أقل من متوسط تكلفة الصنف${costLabel}، وإعدادات الفاتورة تمنع البيع بخسارة. يمكنك تعديل السعر أو مراجعة مسؤول النظام لإلغاء القفل من إعدادات الفاتورة ⚙️`,
      correctiveSteps: [
        'عدّل سعر البيع ليكون أكبر من أو يساوي متوسط التكلفة.',
        'أو اطلب من مسؤول النظام مراجعة قفل «منع البيع بأقل من التكلفة» من ترس إعدادات الفاتورة.',
      ],
      quickFixAction: {
        actionType: 'NAVIGATE_TO_SETTINGS',
        labelAr: 'فتح إعدادات الفاتورة ⚙️',
        href: settingsHref(input.currentRoute),
      } satisfies DiagnoseQuickFix,
    };
  }

  if (code === 'NEGATIVE_STOCK_ERROR') {
    const qty = num(values.quantity ?? values.qty);
    return {
      explanationAr: guards.preventNegativeStock
        ? `الكمية المطلوبة${qty != null ? ` (${money(qty)})` : ''} مش متاحة فعلياً في المخزن، وإعدادات الحركة تمنع الرصيد السالب.`
        : 'الكمية المطلوبة أكبر من الرصيد المتاح. راجع المخزن أو إذن التحويل قبل الحفظ.',
      correctiveSteps: [
        'قلّل الكمية أو اختر مخزناً فيه رصيد كافٍ.',
        'راجع كارت الصنف ومصفوفة أرصدة المخازن.',
      ],
      quickFixAction: {
        actionType: 'CHECK_STOCK',
        labelAr: 'فتح كارت الصنف',
        href: '/inventory/creations/item-card',
      },
    };
  }

  if (code === 'DOCUMENT_IS_POSTED') {
    return {
      explanationAr:
        'المستند مرحّل، فزر التعديل مقفول. لازم تلغي الترحيل أولاً من قائمة الثلاث نقاط (...) ثم تعدّل.',
      correctiveSteps: ['افتح قائمة (...).', 'اختر «إلغاء الترحيل».', 'بعدها اختر «تعديل».'],
      quickFixAction: { actionType: 'UNPOST_DOCUMENT', labelAr: 'إلغاء الترحيل ثم التعديل' },
    };
  }

  if (code === 'DOCUMENT_READ_ONLY') {
    return {
      explanationAr:
        'الشاشة دلوقتي في وضع العرض فقط لأن المستند ات فتح من زر «السابق». التعديل مش من هنا مباشرة.',
      correctiveSteps: ['اضغط قائمة الثلاث نقاط (...).', 'اختار «تعديل» عشان تخرج من وضع العرض.'],
      quickFixAction: { actionType: 'OPEN_EDIT_MODE', labelAr: 'تفعيل وضع التعديل' },
    };
  }

  if (code === 'SAVE_DISABLED') {
    return {
      explanationAr:
        'زر الحفظ مقفول لأن فيه خانة إلزامية فاضية: العميل أو المورد أو المخزن، أو مفيش سطور في الجدول.',
      correctiveSteps: [
        'أكّد اختيار الطرف (عميل/مورد) والمخزن.',
        'أضف بنداً واحداً على الأقل في شبكة الأصناف.',
      ],
      quickFixAction: { actionType: 'FILL_REQUIRED_FIELDS', labelAr: 'راجع الخانات الإلزامية' },
    };
  }

  return {
    explanationAr:
      input.errorMessage?.trim() ||
      'العملية اتقفلت بسبب قيد تشغيلي في Gates. راجع إعدادات الحركة أو حالة المستند قبل ما تطلب دعم فني.',
    correctiveSteps: [
      'راجع قائمة (...) وحالة الترحيل.',
      'لو الرسالة عن سعر أو رصيد، افتح ترس إعدادات الفاتورة ⚙️.',
    ],
  };
}

export class ErrorDiagnosticService {
  async diagnose(
    actor: ConversationActor,
    input: DiagnoseErrorInput,
    extras?: { userRole?: string }
  ): Promise<DiagnoseErrorResult> {
    const started = Date.now();
    const code = normalizeCode(input.errorCode, input.errorMessage);
    const guards = await loadGuards(actor.companyId);
    const diagnosed = diagnoseCode(code, input, guards);
    const result: DiagnoseErrorResult = {
      errorCode: code,
      ...diagnosed,
      settingsSnapshot: guards,
    };

    await persistChatAudit({
      actor,
      userRole: extras?.userRole,
      currentScreen: input.currentRoute,
      userPrompt: `diagnose-error ${code} ${input.errorMessage ?? ''}`.trim(),
      toolCalls: [{ toolName: 'diagnose_error', inputParams: { errorCode: code } }],
      toolResults: [{ toolName: 'diagnose_error', ok: true, data: { errorCode: code } }],
      aiResponse: result.explanationAr,
      latencyMs: Date.now() - started,
      action: 'diagnose.error',
    });

    return result;
  }
}

export const errorDiagnosticService = new ErrorDiagnosticService();
