import { GATES_ERP_CONSTITUTION } from '../constants/gates-constitution';
import { buildCfoSystemPrompt } from './cfo-system-prompt';

export type AiClientContext = {
  currentPath?: string;
  pageTitle?: string;
  documentId?: string;
  documentStatus?: string;
  formErrors?: string[];
};

export type GatesIntelligencePromptContext = {
  companyName?: string;
  companyId?: string;
  userLabel?: string;
  role?: string;
  permissions?: string[];
  fiscalYearName?: string;
  clientContext?: AiClientContext;
};

function summarizePermissions(permissions?: string[]): string {
  if (!permissions?.length) return 'غير محددة في الجلسة';
  if (permissions.includes('*')) return 'غير مقيّد (*)';
  const shown = permissions.slice(0, 24).join(', ');
  return permissions.length > 24 ? `${shown} … (+${permissions.length - 24})` : shown;
}

function screenBlock(clientContext?: AiClientContext): string {
  const path = clientContext?.currentPath?.trim();
  if (!path || !clientContext) return '';
  const title = clientContext.pageTitle?.trim() || 'شاشة غير معنونة';
  const doc = clientContext.documentId?.trim();
  const status = clientContext.documentStatus?.trim();
  const errors = clientContext.formErrors?.filter((row) => row.trim()).slice(0, 8) ?? [];
  return [
    `المستخدم يقف حالياً في الشاشة: [${title}] - المسار: (${path}).`,
    doc ? `المستند المفتوح: ${doc}.` : '',
    status ? `حالة المستند الحالية: ${status}.` : '',
    errors.length ? `أخطاء النموذج الحالية: ${errors.join(' | ')}.` : '',
    'إذا كان سؤاله عن إجراء في الصفحة الحالية أو أزرار معطلة، اشرح له بناءً على ضوابط هذه الشاشة المحددة في الدستور مباشرة.',
    'إذا سأل عن رصيد عميل أو كيف تكوّن الرقم، استدعِ customer_aging_tool مع customerId واعرض تفصيل الثلاث أسطر (آخر فواتير وسندات) دون تخمين.',
    'لا تسأل المستخدم عن الشاشة التي يقف عليها إذا كان المسار ممرراً لك في الجلسة.',
  ]
    .filter(Boolean)
    .join('\n');
}

export function buildGatesIntelligenceSystemPrompt(context: GatesIntelligencePromptContext = {}): string {
  const screenInfo = screenBlock(context.clientContext);
  const session = [
    'بيانات الجلسة الحالية:',
    `- الشركة: ${context.companyName || context.companyId || 'الشركة الحالية'}`,
    `- المستخدم: ${context.userLabel || 'مستخدم الجلسة'} (الصلاحية: ${context.role || 'غير محددة'})`,
    `- السنة المالية النشطة: ${context.fiscalYearName || 'السنة الحالية'}`,
    `- الصلاحيات: ${summarizePermissions(context.permissions)}`,
    screenInfo,
  ]
    .filter(Boolean)
    .join('\n');

  return [
    GATES_ERP_CONSTITUTION,
    '',
    buildCfoSystemPrompt({ companyName: context.companyName }),
    '',
    session,
    '',
    'إرشادات الرد:',
    '- أجب بالعربية بأسلوب تنفيذي مختصر وواضح مدعوماً بالخطوات والأرقام عند الحاجة.',
    '- التزم بالدستور أعلاه في مسارات الشيكات والمردودات والتكلفة الفعلية وأنماط المستندات.',
    '- الأرقام المحاسبية تأتي فقط من أدوات القراءة. الدستور يشرح السياسات والمسارات لا الأرصدة.',
    '- لا تخمّن أرصدة أو كميات. إن لم تُرجع الأداة سجلاً فقل حرفياً: لا توجد بيانات مسجلة مطابقة في شركتكم، أو قد لا تملك صلاحية الاطلاع على هذا السجل.',
    '- ارفض الشعر والأسئلة العامة والبرمجة خارج Gates ERP بالعبارة الدستورية لقفل النطاق.',
    '- مسودات الفواتير والسندات تُقترح ببطاقة إجراء فقط عبر propose_transaction_draft. لا تُحفظ إلا بعد اعتماد المستخدم.',
    '- المقارنات والاتجاهات تُعرض برسم تفاعلي عبر render_data_visualization وليس بجداول نصية طويلة.',
  ].join('\n');
}
