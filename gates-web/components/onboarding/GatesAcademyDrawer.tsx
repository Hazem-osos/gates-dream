'use client';

import { useEffect, useMemo, useState } from 'react';
import { CenteredOverlay } from '@/components/erp/CenteredOverlay';
import { AcademyTourCards } from '@/components/onboarding/AcademyTourCards';
import {
  ACADEMY_PROGRAMS,
  type AcademyCategory,
  type AcademyProgram,
  type AcademyProgramId,
} from '@/lib/onboarding/academyTours';
import { ACADEMY_MODULE_CARDS, type AcademyModuleCardData } from '@/lib/onboarding/toursData';
import {
  academyCategoryProgressPercent,
  academyProgressLabel,
  readAcademyProgress,
} from '@/lib/onboarding/academyProgress';

const SHORTCUTS = [
  { keys: 'Ctrl + Space', desc: 'فتح Gates Intelligence — الذكاء المالي' },
  { keys: 'Cmd + K', desc: 'البحث الشامل والمفضلة' },
  { keys: 'Cmd + Shift + H', desc: 'وضع خصوصية المدير (Stealth Mode)' },
  { keys: 'Tab / Enter', desc: 'إضافة سطر جديد سريع في الجداول' },
  { keys: 'Cmd + V', desc: 'لصق جدول أصناف كامل من Excel' },
];

/** Additive hub reorganization (plan item 7) — 4 role-based buckets + foundation intro + "أخرى". */
const CATEGORY_SECTIONS: { key: AcademyCategory; label: string; icon: string }[] = [
  { key: 'sales-cashier', label: 'المبيعات والكاشير', icon: '🧾' },
  { key: 'inventory-warehouse', label: 'المستودعات والمخزون', icon: '📦' },
  { key: 'general-accounting', label: 'الحسابات العامة', icon: '📚' },
  { key: 'treasury-cheques', label: 'الخزينة والشيكات', icon: '💰' },
  { key: 'other', label: 'أخرى', icon: '🗂️' },
];

/** Cards for the 12 newly authored programs are synthesized from their AcademyProgram data (no duplicate content authoring). */
function cardFromProgram(program: AcademyProgram): AcademyModuleCardData {
  const takeaways = program.steps
    .map((s) => (typeof s.popover?.title === 'string' ? s.popover.title : ''))
    .filter(Boolean)
    .slice(0, 3);
  return {
    programId: program.id,
    slug: program.id,
    emoji: program.emoji,
    iconBgClass: 'bg-sky-100 text-sky-700',
    title: program.title,
    durationLabel: `${program.steps.length} دقائق`,
    levelLabel: 'مبتدئ',
    stationCount: program.steps.length,
    overview: program.description,
    takeaways,
    sandboxRecommended: program.sandboxRecommended,
  };
}

const CARD_BY_PROGRAM: Partial<Record<AcademyProgramId, AcademyModuleCardData>> = Object.fromEntries(
  ACADEMY_MODULE_CARDS.map((c) => [c.programId, c])
);

function cardForProgram(id: AcademyProgramId): AcademyModuleCardData {
  return CARD_BY_PROGRAM[id] ?? cardFromProgram(ACADEMY_PROGRAMS[id]);
}

type Props = {
  open: boolean;
  onClose: () => void;
  onStartProgram: (id: AcademyProgramId) => void;
};

export function GatesAcademyDrawer({ open, onClose, onStartProgram }: Props) {
  const [progressLabel, setProgressLabel] = useState('أكملت 0% من المهارات');
  const [categoryPercents, setCategoryPercents] = useState<Record<string, number>>({});

  useEffect(() => {
    const sync = () => {
      const state = readAcademyProgress();
      setProgressLabel(academyProgressLabel(state));
      setCategoryPercents(
        Object.fromEntries(
          CATEGORY_SECTIONS.map((s) => [s.key, academyCategoryProgressPercent(s.key, state)])
        )
      );
    };
    sync();
    window.addEventListener('gates:academy-progress', sync);
    return () => window.removeEventListener('gates:academy-progress', sync);
  }, [open]);

  const sections = useMemo(() => {
    return CATEGORY_SECTIONS.map((section) => {
      const ids = (Object.keys(ACADEMY_PROGRAMS) as AcademyProgramId[]).filter(
        (id) => id !== 'foundation-8' && ACADEMY_PROGRAMS[id].category === section.key
      );
      return { ...section, modules: ids.map(cardForProgram) };
    }).filter((s) => s.modules.length > 0);
  }, []);

  const foundationCard = cardForProgram('foundation-8');

  return (
    <CenteredOverlay
      open={open}
      onClose={onClose}
      width="lg"
      zClass="z-[10950]"
      labelledBy="gates-academy-title"
    >
        <header className="shrink-0 border-b border-slate-100 px-5 py-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h2 id="gates-academy-title" className="text-lg font-bold text-slate-900">
                🎓 مركز تدريب جيتس (Gates Academy)
              </h2>
              <p className="text-xs font-medium text-sky-700 mt-1">{progressLabel}</p>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
              aria-label="إغلاق"
            >
              ✕
            </button>
          </div>
        </header>

        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-6">
          <section>
            <h3 className="text-sm font-bold text-slate-800 mb-3">🎓 جولة تأسيسية</h3>
            <AcademyTourCards modules={[foundationCard]} onStartProgram={onStartProgram} />
          </section>

          {sections.map((section) => (
            <section key={section.key}>
              <div className="mb-3 flex items-center justify-between gap-3">
                <h3 className="text-sm font-bold text-slate-800">
                  {section.icon} {section.label}
                </h3>
                <div className="flex items-center gap-2">
                  <div className="h-1.5 w-16 rounded-full bg-slate-100 overflow-hidden">
                    <div
                      className="h-full rounded-full bg-emerald-500 transition-all"
                      style={{ width: `${categoryPercents[section.key] ?? 0}%` }}
                    />
                  </div>
                  <span className="text-[10px] font-bold text-slate-500">
                    {categoryPercents[section.key] ?? 0}%
                  </span>
                </div>
              </div>
              <AcademyTourCards modules={section.modules} onStartProgram={onStartProgram} />
            </section>
          ))}

          <section>
            <h3 className="text-sm font-bold text-slate-800 mb-3">دليل الاختصارات السريعة</h3>
            <ul className="space-y-2">
              {SHORTCUTS.map((s) => (
                <li
                  key={s.keys}
                  className="flex items-center justify-between gap-3 rounded-lg border border-slate-100 px-3 py-2 text-sm"
                >
                  <span className="text-slate-600">{s.desc}</span>
                  <kbd className="shrink-0 rounded-md bg-slate-100 px-2 py-0.5 font-mono text-[11px] text-slate-800">
                    {s.keys}
                  </kbd>
                </li>
              ))}
            </ul>
          </section>
        </div>
    </CenteredOverlay>
  );
}
