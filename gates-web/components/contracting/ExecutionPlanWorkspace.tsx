'use client';

import { useMemo, useState } from 'react';
import { useApiMutation, useApiQuery, useInvalidateQuery } from '@/lib/hooks/useApi';
import { queryKeys, staleTimes } from '@/lib/query/query-keys';
import { formatEgp } from '@/lib/subcontracts/money';

type Plan = {
  id: string;
  planName: string;
  versionNumber: number;
  status: string;
  plannedStart: string;
  plannedFinish: string;
  activities: Array<{
    id: string;
    code: string;
    nameAr: string;
    plannedStart: string;
    plannedFinish: string;
    weight: string | null;
    boqAllocations: Array<{ projectBOQItemId: string; plannedQuantity: string }>;
  }>;
};

type BoqItem = {
  id: string;
  itemCode: string;
  descriptionAr: string;
  contractQuantity: string;
  unitSellingPrice: string;
  directCostEstimated: string;
};

type AllocationSummary = {
  items: Array<{
    projectBOQItemId: string;
    itemCode: string;
    effectiveQuantity: number;
    allocatedQuantity: number;
    remainingToAllocate: number;
    plannedUnitCost: number | null;
    plannedCost: number | null;
  }>;
};

type Milestone = {
  id: string;
  nameAr: string;
  plannedDate: string;
  status: string;
};

export function ExecutionPlanWorkspace({ projectId }: { projectId: string }) {
  const invalidate = useInvalidateQuery();
  const [selectedActivityId, setSelectedActivityId] = useState<string | null>(null);

  const activeQ = useApiQuery<Plan | null>(
    queryKeys.contracting.executionPlan(projectId),
    `/contracting/execution/projects/${projectId}/plans/active`,
    undefined,
    { staleTime: staleTimes.transactionalMs }
  );
  const draftQ = useApiQuery<Plan | null>(
    ['contracting', 'execution-draft', projectId],
    `/contracting/execution/projects/${projectId}/plans/draft`,
    undefined,
    { staleTime: staleTimes.transactionalMs }
  );
  const boqQ = useApiQuery<BoqItem[]>(
    ['contracting', 'owner-boq', projectId],
    `/contracting/technical-office/projects/${projectId}/boq`,
    undefined,
    { staleTime: staleTimes.transactionalMs }
  );

  const editingPlan = draftQ.data?.data ?? null;
  const activePlan = activeQ.data?.data ?? null;
  const displayPlan = editingPlan ?? activePlan;
  const planStatus = editingPlan?.status ?? activePlan?.status;
  const isDraft = planStatus === 'DRAFT';
  const isApprovedPendingActivate = editingPlan?.status === 'APPROVED';
  const readOnly = !isDraft;

  const allocQ = useApiQuery<AllocationSummary>(
    ['contracting', 'execution-alloc', projectId, displayPlan?.id ?? ''],
    displayPlan
      ? `/contracting/execution/plans/${displayPlan.id}/allocation-summary?projectId=${projectId}`
      : '',
    undefined,
    { enabled: Boolean(displayPlan?.id), staleTime: staleTimes.transactionalMs }
  );

  const refresh = () => {
    invalidate(queryKeys.contracting.executionPlan(projectId));
    invalidate(['contracting', 'execution-draft', projectId]);
    if (displayPlan?.id) invalidate(['contracting', 'execution-alloc', projectId, displayPlan.id]);
  };

  const createPlan = useApiMutation<Plan, Record<string, unknown>>(
    `/contracting/execution/projects/${projectId}/plans`,
    'POST',
    { onSuccess: refresh }
  );
  const updatePlan = useApiMutation<Plan, Record<string, unknown>>(
    editingPlan ? `/contracting/execution/plans/${editingPlan.id}` : '',
    'PATCH',
    { onSuccess: refresh }
  );
  const addActivity = useApiMutation<unknown, Record<string, unknown>>(
    editingPlan ? `/contracting/execution/plans/${editingPlan.id}/activities` : '',
    'POST',
    { onSuccess: refresh }
  );
  const saveAllocation = useApiMutation<unknown, Record<string, unknown>>(
    selectedActivityId ? `/contracting/execution/activities/${selectedActivityId}/boq-allocations` : '',
    'POST',
    { onSuccess: refresh }
  );
  const approvePlan = useApiMutation<unknown, Record<string, unknown>>(
    editingPlan ? `/contracting/execution/plans/${editingPlan.id}/approve` : '',
    'POST',
    { onSuccess: refresh }
  );
  const activatePlan = useApiMutation<unknown, Record<string, unknown>>(
    editingPlan ? `/contracting/execution/plans/${editingPlan.id}/activate` : '',
    'POST',
    { onSuccess: refresh }
  );
  const revisionPlan = useApiMutation<Plan, Record<string, unknown>>(
    `/contracting/execution/projects/${projectId}/plans/revision`,
    'POST',
    { onSuccess: refresh }
  );
  const addMilestone = useApiMutation<Milestone, Record<string, unknown>>(
    `/contracting/execution/projects/${projectId}/milestones`,
    'POST',
    { onSuccess: refresh }
  );

  const [planForm, setPlanForm] = useState({ planName: 'مخطط التنفيذ', plannedStart: '2026-01-01', plannedFinish: '2026-12-31' });
  const [activityForm, setActivityForm] = useState({
    code: '',
    nameAr: '',
    plannedStart: '2026-01-01',
    plannedFinish: '2026-01-31',
    weight: '',
  });
  const [allocForm, setAllocForm] = useState({ projectBOQItemId: '', plannedQuantity: '' });
  const [milestoneForm, setMilestoneForm] = useState({ nameAr: '', plannedDate: '2026-06-01' });
  const [allocError, setAllocError] = useState<string | null>(null);

  const boqItems = boqQ.data?.data ?? [];
  const allocByBoq = useMemo(() => {
    const m = new Map<string, AllocationSummary['items'][0]>();
    for (const row of allocQ.data?.data?.items ?? []) m.set(row.projectBOQItemId, row);
    return m;
  }, [allocQ.data?.data?.items]);

  const selectedActivity = displayPlan?.activities.find((a) => a.id === selectedActivityId);

  return (
    <div className="space-y-6">
      {activePlan && !editingPlan && (
        <div className="rounded-xl border border-[#D6EAF3] bg-[#F6FBFD] p-4 text-sm text-[#094C6B]">
          المخطط النشط: <strong>{activePlan.planName}</strong> (v{activePlan.versionNumber}) — للتعديل أنشئ{' '}
          <button
            type="button"
            className="font-bold text-[#0E78AA] underline"
            onClick={() => revisionPlan.mutate({})}
          >
            مراجعة مسودة
          </button>
        </div>
      )}

      {!displayPlan && (
        <div className="rounded-xl border border-dashed border-[#D6EAF3] bg-white p-6 space-y-4">
          <p className="text-sm text-[#094C6B]">لا يوجد مخطط. أنشئ مسودة جديدة:</p>
          <div className="grid gap-3 sm:grid-cols-3">
            <input className="rounded-lg border px-3 py-2 text-sm" value={planForm.planName} onChange={(e) => setPlanForm({ ...planForm, planName: e.target.value })} placeholder="اسم المخطط" />
            <input type="date" className="rounded-lg border px-3 py-2 text-sm" value={planForm.plannedStart} onChange={(e) => setPlanForm({ ...planForm, plannedStart: e.target.value })} />
            <input type="date" className="rounded-lg border px-3 py-2 text-sm" value={planForm.plannedFinish} onChange={(e) => setPlanForm({ ...planForm, plannedFinish: e.target.value })} />
          </div>
          <button
            type="button"
            className="rounded-xl bg-[#0E78AA] px-4 py-2 text-sm font-bold text-white"
            onClick={() => createPlan.mutate(planForm)}
          >
            إنشاء مخطط مسودة
          </button>
        </div>
      )}

      {isDraft && editingPlan && (
        <div className="rounded-xl border border-[#D6EAF3] bg-white p-4 space-y-3">
          <div className="font-bold text-[#094C6B]">بيانات المسودة</div>
          <div className="grid gap-3 sm:grid-cols-3">
            <input className="rounded-lg border px-3 py-2 text-sm" value={planForm.planName} onChange={(e) => setPlanForm({ ...planForm, planName: e.target.value })} />
            <input type="date" className="rounded-lg border px-3 py-2 text-sm" value={planForm.plannedStart} onChange={(e) => setPlanForm({ ...planForm, plannedStart: e.target.value })} />
            <input type="date" className="rounded-lg border px-3 py-2 text-sm" value={planForm.plannedFinish} onChange={(e) => setPlanForm({ ...planForm, plannedFinish: e.target.value })} />
          </div>
          <button
            type="button"
            className="rounded-lg border border-[#0E78AA] px-3 py-1 text-sm font-bold text-[#0E78AA]"
            onClick={() => updatePlan.mutate(planForm)}
          >
            حفظ تواريخ المخطط
          </button>
        </div>
      )}

      {displayPlan && (
        <>
          <div className="flex flex-wrap gap-2">
            {isDraft && (
              <button type="button" className="rounded-xl bg-emerald-600 px-4 py-2 text-sm font-bold text-white" onClick={() => approvePlan.mutate({})}>
                اعتماد خط الأساس
              </button>
            )}
            {isApprovedPendingActivate && (
              <button type="button" className="rounded-xl bg-[#0E78AA] px-4 py-2 text-sm font-bold text-white" onClick={() => activatePlan.mutate({})}>
                تفعيل المخطط
              </button>
            )}
            {readOnly && activePlan && !editingPlan && (
              <button type="button" className="rounded-xl border px-4 py-2 text-sm font-bold" onClick={() => revisionPlan.mutate({})}>
                مراجعة بعد VO
              </button>
            )}
          </div>

          {isDraft && (
            <div className="rounded-xl border bg-white p-4 space-y-3">
              <div className="font-bold">إضافة نشاط</div>
              <div className="grid gap-2 sm:grid-cols-5">
                <input placeholder="الكود" className="rounded border px-2 py-1 text-sm" value={activityForm.code} onChange={(e) => setActivityForm({ ...activityForm, code: e.target.value })} />
                <input placeholder="اسم النشاط" className="rounded border px-2 py-1 text-sm sm:col-span-2" value={activityForm.nameAr} onChange={(e) => setActivityForm({ ...activityForm, nameAr: e.target.value })} />
                <input type="date" className="rounded border px-2 py-1 text-sm" value={activityForm.plannedStart} onChange={(e) => setActivityForm({ ...activityForm, plannedStart: e.target.value })} />
                <input type="date" className="rounded border px-2 py-1 text-sm" value={activityForm.plannedFinish} onChange={(e) => setActivityForm({ ...activityForm, plannedFinish: e.target.value })} />
              </div>
              <button
                type="button"
                className="rounded-lg bg-[#0E78AA] px-3 py-1 text-sm text-white"
                onClick={() => addActivity.mutate({ ...activityForm, weight: activityForm.weight ? Number(activityForm.weight) : undefined })}
              >
                إضافة نشاط
              </button>
            </div>
          )}

          <div className="overflow-x-auto rounded-xl border bg-white">
            <table className="min-w-full text-sm">
              <thead className="bg-[#F6FBFD]">
                <tr>
                  <th className="px-2 py-2 text-right">الكود</th>
                  <th className="px-2 py-2 text-right">النشاط</th>
                  <th className="px-2 py-2 text-right">من</th>
                  <th className="px-2 py-2 text-right">إلى</th>
                  {isDraft && <th className="px-2 py-2 text-right">توزيع BOQ</th>}
                </tr>
              </thead>
              <tbody>
                {displayPlan.activities.map((a) => (
                  <tr key={a.id} className="border-t">
                    <td className="px-2 py-2 font-mono">{a.code}</td>
                    <td className="px-2 py-2">{a.nameAr}</td>
                    <td className="px-2 py-2">{a.plannedStart.slice(0, 10)}</td>
                    <td className="px-2 py-2">{a.plannedFinish.slice(0, 10)}</td>
                    {isDraft && (
                      <td className="px-2 py-2">
                        <button type="button" className="text-[#0E78AA] underline" onClick={() => setSelectedActivityId(a.id)}>
                          بنود الأعمال ({a.boqAllocations.length})
                        </button>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {isDraft && selectedActivity && (
            <div className="rounded-xl border border-amber-200 bg-amber-50/40 p-4 space-y-3">
              <div className="font-bold">بنود الأعمال — {selectedActivity.nameAr}</div>
              <div className="grid gap-2 sm:grid-cols-2">
                <select
                  className="rounded border px-2 py-1 text-sm"
                  value={allocForm.projectBOQItemId}
                  onChange={(e) => setAllocForm({ ...allocForm, projectBOQItemId: e.target.value })}
                >
                  <option value="">اختر البند</option>
                  {boqItems.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.itemCode} — {b.descriptionAr}
                    </option>
                  ))}
                </select>
                <input
                  type="number"
                  placeholder="الكمية لهذا النشاط"
                  className="rounded border px-2 py-1 text-sm"
                  value={allocForm.plannedQuantity}
                  onChange={(e) => setAllocForm({ ...allocForm, plannedQuantity: e.target.value })}
                />
              </div>
              {allocForm.projectBOQItemId && (
                <div className="text-xs text-[#094C6B]">
                  {(() => {
                    const row = allocByBoq.get(allocForm.projectBOQItemId);
                    const boq = boqItems.find((b) => b.id === allocForm.projectBOQItemId);
                    if (!row || !boq) return null;
                    const sell = Number(boq.unitSellingPrice) * Number(allocForm.plannedQuantity || 0);
                    const cost = (row.plannedUnitCost ?? 0) * Number(allocForm.plannedQuantity || 0);
                    return (
                      <span>
                        الكمية الفعالة: {row.effectiveQuantity} · موزع سابقاً: {row.allocatedQuantity} · المتبقي:{' '}
                        {row.remainingToAllocate} · قيمة بيع مخططة: {formatEgp(sell)} · تكلفة مخططة:{' '}
                        {formatEgp(cost)}
                      </span>
                    );
                  })()}
                </div>
              )}
              {allocError && <p className="text-sm text-red-600">{allocError}</p>}
              <button
                type="button"
                className="rounded-lg bg-[#0E78AA] px-3 py-1 text-sm text-white"
                onClick={async () => {
                  setAllocError(null);
                  try {
                    await saveAllocation.mutateAsync({
                      projectBOQItemId: allocForm.projectBOQItemId,
                      plannedQuantity: Number(allocForm.plannedQuantity),
                    });
                  } catch (err: unknown) {
                    setAllocError(err instanceof Error ? err.message : 'فشل التوزيع');
                  }
                }}
              >
                حفظ التوزيع
              </button>
            </div>
          )}

          {isDraft && (
            <div className="rounded-xl border bg-white p-4 space-y-2">
              <div className="font-bold">معالم</div>
              <div className="flex flex-wrap gap-2">
                <input className="rounded border px-2 py-1 text-sm" placeholder="اسم المعلم" value={milestoneForm.nameAr} onChange={(e) => setMilestoneForm({ ...milestoneForm, nameAr: e.target.value })} />
                <input type="date" className="rounded border px-2 py-1 text-sm" value={milestoneForm.plannedDate} onChange={(e) => setMilestoneForm({ ...milestoneForm, plannedDate: e.target.value })} />
                <button
                  type="button"
                  className="rounded-lg border px-3 py-1 text-sm"
                  onClick={() => addMilestone.mutate({ ...milestoneForm, executionPlanId: editingPlan?.id })}
                >
                  إضافة معلم
                </button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
