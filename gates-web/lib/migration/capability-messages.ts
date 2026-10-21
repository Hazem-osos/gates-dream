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

export function supportedLegacyEngineAr(english?: string): string {
  if (!english) return '';
  if (english.includes('LEGACY_GATES_SQLSERVER')) {
    return 'مصدر مدعوم: SQL Server قديم (Gates) — قراءة فقط عبر LEGACY_FORENSIC_URL على الخادم';
  }
  return english;
}
