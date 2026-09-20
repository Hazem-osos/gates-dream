'use client';

import { useParams, useRouter } from 'next/navigation';
import { Pencil, Power } from 'lucide-react';
import { Button, PageHeader, PageSkeleton, StatusBadge } from '@/components/ui';
import { confirmAction } from '@/lib/feedback/confirm';
import {
  useAutomationRuleQuery,
  useCreateAutomationRule,
  useDeleteAutomationRule,
  useSetAutomationRuleEnabled,
} from '@/lib/hooks/useAutomationRules';
import { AutomationDetailsView } from '@/components/automation/AutomationDetailsView';
import { AutomationHistoryList } from '@/components/automation/AutomationHistoryList';

export default function AutomationDetailsPage() {
  const params = useParams<{ id: string }>();
  const ruleId = params.id;
  const router = useRouter();

  const { data, isLoading } = useAutomationRuleQuery(ruleId);
  const rule = data?.data;
  const setEnabled = useSetAutomationRuleEnabled(ruleId);
  const deleteRule = useDeleteAutomationRule(ruleId);
  const createRule = useCreateAutomationRule();

  if (isLoading || !rule) {
    return (
      <div className="mx-auto max-w-4xl p-4 sm:p-6" dir="rtl">
        <PageSkeleton variant="document" />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-4xl p-4 sm:p-6" dir="rtl">
      <PageHeader
        title={rule.name}
        description={rule.description ?? undefined}
        breadcrumbs={[{ label: 'أتمتة Gates', href: '/automation' }, { label: rule.name }]}
        statusBadge={
          <StatusBadge tone={rule.enabled ? 'success' : 'neutral'} label={rule.enabled ? 'مفعّلة' : 'متوقفة'} compact />
        }
        onEdit={() => router.push(`/automation/${ruleId}/edit`)}
        actions={
          <Button
            variant="secondary"
            size="sm"
            iconStart={<Power className="h-4 w-4" />}
            onClick={() => setEnabled.mutate({ enabled: !rule.enabled })}
            isLoading={setEnabled.isPending}
          >
            {rule.enabled ? 'إيقاف' : 'تشغيل'}
          </Button>
        }
        menuItems={[
          {
            id: 'edit',
            label: 'تعديل',
            icon: <Pencil className="h-4 w-4" />,
            onClick: () => router.push(`/automation/${ruleId}/edit`),
          },
          {
            id: 'duplicate',
            label: 'نسخ',
            onClick: async () => {
              const result = await createRule.mutateAsync({
                name: `${rule.name} (نسخة)`,
                description: rule.description ?? undefined,
                eventType: rule.eventType,
                enabled: false,
                conditions: rule.conditions,
                actions: rule.actions,
              });
              const newId = result.data?.id;
              if (newId) router.push(`/automation/${newId}`);
            },
          },
          {
            id: 'delete',
            label: 'حذف',
            destructive: true,
            onClick: async () => {
              const ok = await confirmAction(`هل تريد حذف أتمتة «${rule.name}»؟ لا يمكن التراجع عن هذا الإجراء.`);
              if (!ok) return;
              await deleteRule.mutateAsync();
              router.push('/automation');
            },
          },
        ]}
      />

      <div className="flex flex-col gap-6">
        <AutomationDetailsView rule={rule} />

        <section>
          <h2 className="mb-3 text-base font-bold text-slate-900 dark:text-white">سجل التشغيل</h2>
          <AutomationHistoryList ruleId={ruleId} />
        </section>
      </div>
    </div>
  );
}
