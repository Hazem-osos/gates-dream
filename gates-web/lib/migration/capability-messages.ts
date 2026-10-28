/** User-facing Arabic explanations for migration-engine capability / safety errors. */
export function explainMigrationEngineAlert(message?: string): string {
  if (!message?.trim()) {
    return (
      'محرك الترحيل غير جاهز على هذا الخادم. فعّل المتغيرات على خدمة gates-backend (ور workers عند التنفيذ) ثم أعد تشغيل الخدمة.'
    );
  }
  const m = message.trim();
  if (/Migration engine is disabled/i.test(m)) {
    return (
      'المحرك معطّل عمداً. محلياً: في gates-backend/.env أضف MIGRATION_ENGINE_ENABLED=true و MIGRATION_RUN_INLINE=true ' +
      '(مع DATABASE_URL على localhost) ثم أعد تشغيل الـ backend. على Railway: نفس المتغيرات في Variables ثم Redeploy. ' +
      'بدون هذا لن يعمل Analyze / Dry-run / Execute.'
    );
  }
  if (/production|railway\.app|rlwy\.net/i.test(m) && /prohibited|Target DATABASE/i.test(m)) {
    return (
      'قاعدة البيانات الحالية تبدو إنتاجاً (Railway). الكتابة ممنوعة افتراضياً. للتجربة على نفس السيرفر: أنشئ MySQL منفصل للـ pilot، ' +
      'أو بعد موافقة المالك فقط: MIGRATION_ALLOW_PRODUCTION_TARGET=true (خطر — قد يغيّر بيانات حية).'
    );
  }
  if (/local\/disposable|MIGRATION_ALLOW_PRODUCTION_TARGET/i.test(m)) {
    return (
      'الهدف ليس بيئة pilot محلية. استخدم قاعدة MySQL للاختبار فقط، أو فعّل MIGRATION_ALLOW_PRODUCTION_TARGET=true بموافقة المالك (cutover).'
    );
  }
  if (/Invalid DATABASE_URL/i.test(m)) {
    return 'رابط قاعدة البيانات (DATABASE_URL) غير صالح على الخادم. تأكد من ربط MySQL في Railway.';
  }
  if (/Legacy source must remain read-only/i.test(m)) {
    return 'مصدر Legacy يجب أن يكون للقراءة فقط — أزل MIGRATION_LEGACY_WRITABLE إن كان مفعّلاً.';
  }
  if (/Migration target must be local\/disposable/i.test(m)) {
    return (
      'قاعدة الهدف ليست محلية/تجريبية. على Railway: إمّا MySQL pilot منفصل، أو بعد موافقة المالك فقط ' +
      'MIGRATION_ALLOW_PRODUCTION_TARGET=true على gates-backend و gates-workers.'
    );
  }
  if (/Failed to create migration job|Failed to enqueue|inline migration failed/i.test(m)) {
    return 'تعذّر تشغيل الترحيل — راجع تنبيه «محرك الترحيل» أعلى الصفحة ومتغيرات Railway ثم أعد المحاولة.';
  }
  if (/No legacy SQL source configured/i.test(m)) {
    return (
      'مصدر SQL القديم غير جاهز. احفظ الاتصال واضغط «اختبار الاتصال»، أو استعد ملف .bak على SQL Server ثم اربطه من «اتصال SQL مباشر».'
    );
  }
  if (/Isolated SQL Server host/i.test(m)) {
    return (
      'استعادة .bak من واجهة Gates تتم على SQL Server معزول (عامل restore)، وليست على حاوية MySQL. ' +
      'إن ظهرت هذه الرسالة فالخدمة غير مفعّلة بعد (MIGRATION_ISOLATED_MSSQL_HOST + MIGRATION_BAK_RESTORE_WORKER). ' +
      'العميل لا يستعيد الملف على جهازه. «اتصال SQL مباشر» مسار مشغّل فقط.'
    );
  }
  if (/Neither docker nor sqlcmd|Automated \.bak restore is disabled|Backup file missing/i.test(m)) {
    return (
      'لا يمكن تشغيل استعادة .bak على هذا الخادم. استعد النسخة يدوياً على SQL Server، ثم اربط المصدر (REMOTE_SQL / LEGACY_FORENSIC_URL) ونفّذ الترحيل من Analyze / Execute.'
    );
  }
  if (/cannot (run|dry-run|COA dry-run|run COA|run parties|run accounting|run items|run inventory|run commercial)/i.test(m) || /cannot run in status/i.test(m)) {
    return (
      'المهمة ليست في حالة تسمح بهذه الخطوة. اضغط «إيقاف التشغيل» ثم «تحليل المصدر» أو «معاينة جافة».'
    );
  }
  if (/locked by another runner|already running|شغالة الآن/i.test(m)) {
    return 'تشغيل واقف على نفس المهمة. اضغط «إيقاف التشغيل» ثم أعد التحليل أو المعاينة.';
  }
  if (/cannot pause job in status/i.test(m)) {
    return 'لا يمكن الإيقاف المؤقت في الحالة الحالية. اضغط «إيقاف التشغيل» لإلغاء التشغيل بالكامل.';
  }
  if (/cannot cancel job in status/i.test(m)) {
    return 'اضغط «إيقاف التشغيل» لإلغاء التشغيل الحالي ثم أعد المحاولة.';
  }
  if (/source fingerprint mismatch/i.test(m)) {
    return 'البصمة المؤقتة للمهمة اتبدلت ببصمة SQL الحقيقية. سيّب نافذة البرنامج مفتوحة واضغط «تحليل المصدر» مرة ثانية.';
  }
  if (/illegal migration job transition/i.test(m)) {
    return 'حالة المهمة لا تسمح بهذه الخطوة. اضغط «إيقاف التشغيل» ثم «تحليل المصدر» أو «معاينة جافة».';
  }
  if (/invalid column name ['']RemainingValue['']/i.test(m)) {
    return 'عمود RemainingValue غير موجود في فاتورة النظام القديم. المتبقي يُحسب من الصافي ناقص المدفوع. حدّث الصفحة وأعد المعاينة الجافة.';
  }
  if (/invalid column name ['']([^'']+)['']/i.test(m)) {
    const col = m.match(/invalid column name ['']([^'']+)['']/i)?.[1] ?? '';
    return `عمود «${col}» غير موجود في جدول SQL القديم. المعاينة وقفت عند قراءة الفواتير.`;
  }
  return m;
}

const BLOCKED_MODULE_AR: Record<string, string> = {
  'SettlementTrxHeader (non-catalog) — BLOCKER when rows exist':
    'تسويات SettlementTrxHeader غير موجودة في الكatalog — يُوقف الترحيل إن وُجدت صفوف',
  'PKTrxDetailSub multi-collect on payment cheques':
    'شيكات دفع متعددة التحصيل (PKTrxDetailSub) — محدودة / تحتاج مراجعة',
  'Legacy modules outside critical path (~500+ tables) — see LEGACY_TO_NEW_MAPPING.md':
    'وحدات legacy خارج المسار الحرج (~500+ جدول) — غير مشمولة في هذه المرحلة',
  'Inventory valuation / inventory-to-GL — owner policy (FULL_CUTOVER_READINESS)':
    'تقييم المخزون وربطه بالGL — يتطلب قرار مالك (سياسة cutover)',
  '.bak restore — requires configured SQL Server tooling (assessment API returns steps)':
    'استعادة .bak تحتاج أدوات SQL Server على الخادم — اتبع خطوات التقييم في الواجهة',
};

export function blockedModuleLabelAr(english: string): string {
  return BLOCKED_MODULE_AR[english] ?? english;
}

/** Plain Arabic for core-area gap lines (operator view — not blockers by default). */
const CORE_COVERAGE_GAP_AR: Record<string, string> = {
  'Wide CompanySettings row (logo/theme) — not all keys have typed targets':
    'بعض إعدادات الشركة (شعار/مظهر) تُحفظ كما هي — بدون حقول منفصلة في النظام الجديد',
  'BalanceAccounts monetary amounts live in GL — header slots preserved only':
    'أرصدة الحسابات الافتتاحية من القيود؛ خانات الرأس في القديم تُحفظ للمرجع فقط',
  'Party opening balances from subledger only if not in GL — not fabricated':
    'رصيد العميل/المورد من القيود فقط — لا يُختلق رصيد من دفتر مساعد منفصل',
  'Reversed invoice semantics — no reversalOf column in legacy header':
    'فواتير المرتجع تُربط بالأصل عند توفر البيانات — بدون عمود reversal في القديم',
  'Landed cost / expense invoices — separate legacy types may BLOCK':
    'فواتير مصاريف/تكلفة وصول قد تتطلب مراجعة إن وُجدت في المصدر',
  'Inter-safe transfers without CashTrxHeader evidence':
    'تحويلات بين الخزائن بدون سند واضح في القديم — قد لا تُرحّل',
  'Advance/unapplied cash without invoice columns — not fabricated':
    'دفعات غير مطبّقة على فواتير لا تُختلق — تُرحّل فقط عند وجود أعمدة الربط',
  'Securities PKTrx beyond PK01 cheque lifecycle':
    'أوراق مالية خارج دورة شيك PK01 القياسية — قد تحتاج مراجعة',
  'Extra sub-collections logged as INFO only':
    'تحصيلات فرعية إضافية تُسجّل كمعلومة فقط',
  'Inventory valuation GL cutover — owner policy (FULL_CUTOVER_READINESS)':
    'تقييم المخزون في GL يتبع السياسة المحفوظة على المهمة (افتراضي: دوري بدون إعادة ترحيل GL)',
};

export function coreCoverageGapAr(english: string): string {
  return CORE_COVERAGE_GAP_AR[english] ?? 'ملاحظة للفريق التقني — لا تمنع الترحيل في أغلب الحالات';
}

export function supportedLegacyEngineAr(english?: string): string {
  if (!english) return '';
  if (english.includes('LEGACY_GATES_SQLSERVER')) {
    return 'مصدر مدعوم: SQL Server قديم (Gates) — قراءة فقط عبر LEGACY_FORENSIC_URL على الخادم';
  }
  return english;
}
