'use client';

import { BarChart3, FileText, Package, Wallet } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

export type AiBentoAction = {
  id: string;
  title: string;
  description: string;
  prompt: string;
  icon: LucideIcon;
};

export const GATES_INTELLIGENCE_BENTO: AiBentoAction[] = [
  {
    id: 'liquidity',
    title: 'السيولة والموقف المالي',
    description: 'ملخص السيولة والشيكات المستحقة',
    prompt: 'أعطني ملخص السيولة الحالي مع النقد والبنوك والشيكات والأوراق المستحقة خلال 14 يوماً.',
    icon: BarChart3,
  },
  {
    id: 'sales',
    title: 'المبيعات والعملاء',
    description: 'أكبر 5 عملاء مدينين والفواتير المتأخرة',
    prompt: 'من هم أكبر 5 عملاء مدينين حالياً؟ أظهر الرصيد والمتأخر إن وُجد، مع الذمم المدينة المتأخرة.',
    icon: Wallet,
  },
  {
    id: 'stock',
    title: 'مراقبة المخزون',
    description: 'الأصناف التي قاربت على النفاد وحركتها',
    prompt: 'ما هي نواقص المخزن والأصناف تحت حد الطلب حالياً مع حركة 30 يوماً؟',
    icon: Package,
  },
  {
    id: 'projects',
    title: 'العقود والمستخلصات',
    description: 'تحليل أرباح المشاريع والمستخلصات العالقة',
    prompt: 'حلّل أرباح المشاريع الحالية والمستخلصات العالقة، ووضّح أي تراجع في الهامش.',
    icon: FileText,
  },
];

export function AiWelcomeHero({
  disabled,
  onSelect,
}: {
  disabled?: boolean;
  onSelect: (prompt: string) => void;
}) {
  return (
    <div className="relative isolate overflow-hidden rounded-2xl">
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-tr from-[#0E79AA]/10 via-transparent to-emerald-500/5" />
      <div className="relative px-1 pb-1 pt-2">
        <p className="text-[15px] font-semibold leading-6 text-slate-900">
          مرحباً، أنا مستشارك المالي والتشغيلي المباشر
        </p>
        <p className="mt-1.5 text-[12px] leading-5 text-slate-500">
          اسأل عن السيولة، أرباح المشاريع، نواقص المستودعات، أو جهز عروض أسعار فورية.
        </p>

        <div className="mt-4 grid grid-cols-2 gap-2">
          {GATES_INTELLIGENCE_BENTO.map((card) => {
            const Icon = card.icon;
            return (
              <button
                key={card.id}
                type="button"
                disabled={disabled}
                onClick={() => onSelect(card.prompt)}
                className="group flex flex-col items-start rounded-xl border border-slate-200/90 bg-white/80 p-2.5 text-right shadow-sm transition-all hover:border-[#0E79AA] hover:shadow-md disabled:cursor-not-allowed disabled:opacity-50"
              >
                <span className="mb-2 inline-flex h-8 w-8 items-center justify-center rounded-lg bg-[#0E79AA]/10 text-[#0E79AA] transition group-hover:bg-[#0E79AA] group-hover:text-white">
                  <Icon className="h-4 w-4" />
                </span>
                <span className="text-[12px] font-semibold leading-5 text-slate-900">{card.title}</span>
                <span className="mt-0.5 text-[10px] leading-4 text-slate-500">{card.description}</span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
