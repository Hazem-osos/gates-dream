'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { GraduationCap, Play } from 'lucide-react';
import { fetchAcademyStatus } from '@/lib/academy/api';
import { ACADEMY_MISSIONS, academyLaunchHref } from '@/lib/academy/module-map';

export function AcademyMissionsHub() {
  const router = useRouter();
  const [done, setDone] = useState<Record<string, boolean>>({});

  useEffect(() => {
    let cancelled = false;
    void Promise.all(
      ACADEMY_MISSIONS.map(async (mission) => {
        const status = await fetchAcademyStatus(mission.slug, mission.href);
        return [mission.slug, Boolean(status?.isCompleted)] as const;
      })
    ).then((rows) => {
      if (cancelled) return;
      setDone(Object.fromEntries(rows));
    });
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="mx-auto max-w-5xl space-y-6 p-6" dir="rtl">
      <header className="flex items-start gap-3">
        <div className="rounded-xl bg-[#0E79AA]/10 p-2.5 text-[#0E79AA]">
          <GraduationCap className="h-6 w-6" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-[#094C6B]">أكاديمية Gates الذكية</h1>
          <p className="mt-1 text-sm text-slate-500">
            مهام محاكاة عملية على الشاشات الحقيقية — بدون فيديوهات ثابتة. كل جولة مربوطة بدستور التشغيل.
          </p>
        </div>
      </header>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        {ACADEMY_MISSIONS.map((mission) => {
          const completed = done[mission.slug];
          return (
            <article
              key={mission.slug}
              className="rounded-2xl border border-[#D6EAF3] bg-white p-4 shadow-sm"
            >
              <div className="mb-3 flex items-start justify-between gap-2">
                <h2 className="text-base font-bold text-[#094C6B]">{mission.titleAr}</h2>
                {completed ? (
                  <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-semibold text-emerald-700">
                    مكتمل ✓
                  </span>
                ) : (
                  <span className="rounded-full bg-amber-50 px-2 py-0.5 text-[11px] font-semibold text-amber-700">
                    مهمة تدريبية جديدة ⚡
                  </span>
                )}
              </div>
              <p className="text-sm leading-6 text-slate-600">{mission.descriptionAr}</p>
              <button
                type="button"
                onClick={() => router.push(academyLaunchHref(mission.slug))}
                className="mt-4 inline-flex items-center gap-1.5 rounded-lg bg-[#0E79AA] px-3 py-1.5 text-xs font-semibold text-white"
              >
                <Play className="h-3.5 w-3.5" />
                ابدأ المحاكاة
              </button>
            </article>
          );
        })}
      </div>
    </div>
  );
}
