'use client';

import { ShieldCheck } from 'lucide-react';
import type { VipPersona } from '@/lib/onboarding/vip-onboarding-storage';

const HERO: Record<
  VipPersona,
  { title: string; points: string[]; accent: string }
> = {
  OWNER: {
    title: 'لوحة القيادة التنفيذية',
    accent: 'from-emerald-400/30 to-sky-400/20',
    points: [
      'مراقبة السيولة والخزينة لحظة بلحظة مع حارس تنبيهات المالك.',
      'حماية الربحية من الخصومات الشاذة قبل أن تخرج عن السيطرة.',
      'محادثة تنفيذية خاصة مع Gates Intelligence — أرقام الشركة فقط.',
    ],
  },
  ACCOUNTANT: {
    title: 'منصة الالتزام المحاسبي المصري',
    accent: 'from-sky-400/30 to-indigo-400/20',
    points: [
      'شجرة حسابات متوافقة مع المعايير المصرية والرصيد الافتتاحي.',
      'نموذج ٤١ للخصم من المنبع يُجهَّز تلقائياً من القيود المرحلة.',
      'توزيع التكلفة الجمركية (Landed Cost) على فواتير الاستيراد.',
    ],
  },
  CASHIER: {
    title: 'نقطة البيع الفورية',
    accent: 'from-amber-300/30 to-sky-300/20',
    points: [
      'وضع POS فوري: بيع، قبض، وإغلاق الوردية في شاشة واحدة.',
      'طباعة إيصال حراري عبر البلوتوث خلال ثوانٍ.',
      'كشف رصيد المخزن قبل إتمام البيع حتى لا تُباع كمية غير موجودة.',
    ],
  },
  WAREHOUSE: {
    title: 'غرفة عمليات المخزن',
    accent: 'from-teal-300/30 to-sky-300/20',
    points: [
      'كشف أرصدة الأصناف والمستودعات في لمحة واحدة.',
      'حد الطلب ودفعات الصلاحية تظهر قبل أن ينفد المخزون.',
      'إذن صرف وإضافة سريع مع طباعة تجريبية للإيصال.',
    ],
  },
};

export function VipWelcomeModal({
  open,
  displayName,
  companyName,
  persona,
  onExplore,
  onSandbox,
  onDismiss,
}: {
  open: boolean;
  displayName: string;
  companyName: string;
  persona: VipPersona;
  onExplore: () => void;
  onSandbox: () => void;
  onDismiss: () => void;
}) {
  if (!open) return null;
  const hero = HERO[persona];

  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center p-4" dir="rtl" role="dialog" aria-modal="true" aria-labelledby="vip-welcome-title">
      <div className="absolute inset-0 overflow-hidden bg-[#041820]/70 backdrop-blur-xl">
        <div className="absolute -right-24 -top-16 h-80 w-80 animate-pulse rounded-full bg-emerald-400/20 blur-3xl" />
        <div className="absolute -bottom-20 -left-16 h-96 w-96 animate-pulse rounded-full bg-sky-500/25 blur-3xl [animation-delay:400ms]" />
      </div>

      <div className="relative w-full max-w-xl overflow-hidden rounded-3xl border border-white/20 bg-white/10 p-1 shadow-[0_30px_80px_rgba(4,24,32,0.45)] backdrop-blur-2xl">
        <div className="rounded-[1.35rem] bg-gradient-to-br from-[#062A3A]/90 via-[#0A4A66]/85 to-[#083044]/90 p-6 text-white sm:p-8">
          <div className="mb-5 flex items-center gap-3">
            <div className="relative flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-emerald-300 to-sky-400 text-2xl font-black text-[#062A3A] shadow-lg shadow-emerald-400/30">
              G
              <span className="absolute -inset-1 -z-10 animate-ping rounded-2xl bg-emerald-300/30" />
            </div>
            <div>
              <p className="flex items-center gap-1.5 text-[11px] font-semibold text-emerald-200">
                <ShieldCheck className="h-3.5 w-3.5" aria-hidden />
                تم التحقق من الاتصال المشفر 256-bit
              </p>
              <p className="text-xs text-white/60">Gates ERP · جلسة مؤمَّنة</p>
            </div>
          </div>

          <h2 id="vip-welcome-title" className="text-2xl font-black leading-snug sm:text-[1.7rem]">
            مرحباً بك يا {displayName} في عائلة Gates ERP
          </h2>
          <p className="mt-2 text-sm leading-relaxed text-white/75">
            منظومة {companyName} جاهزة بالكامل لإدارة عملياتك الذكية.
          </p>

          <div className={`mt-5 rounded-2xl border border-white/15 bg-gradient-to-l ${hero.accent} p-4`}>
            <p className="text-sm font-bold text-white">{hero.title}</p>
            <ul className="mt-2 space-y-1.5 text-xs leading-relaxed text-white/85">
              {hero.points.map((point) => (
                <li key={point}>• {point}</li>
              ))}
            </ul>
          </div>

          <div className="mt-6 flex flex-col gap-2">
            <button
              type="button"
              onClick={onExplore}
              className="rounded-xl bg-gradient-to-l from-emerald-400 to-sky-400 px-4 py-3 text-sm font-black text-[#062A3A] shadow-lg shadow-emerald-400/20 transition hover:brightness-110"
            >
              🚀 استكشاف النظام في 60 ثانية
            </button>
            <button
              type="button"
              onClick={onSandbox}
              className="rounded-xl border border-white/25 bg-white/10 px-4 py-3 text-sm font-bold text-white transition hover:bg-white/15"
            >
              ⚡ تجربة النظام ببيانات استعراضية (Sandbox)
            </button>
            <button
              type="button"
              onClick={onDismiss}
              className="py-2 text-xs font-medium text-white/55 hover:text-white"
            >
              تخطي والبدء مباشرة
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
