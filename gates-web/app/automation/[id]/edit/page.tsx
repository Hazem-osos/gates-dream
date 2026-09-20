'use client';

import { useMemo } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { PageHeader, PageSkeleton } from '@/components/ui';
import { useAutomationRuleQuery, useUpdateAutomationRule } from '@/lib/hooks/useAutomationRules';
import { AutomationBuilder, emptyBuilderState, type BuilderState } from '@/components/automation/builder/AutomationBuilder';

export default function EditAutomationPage() {
  const params = useParams<{ id: string }>();
  const ruleId = params.id;
  const router = useRouter();

  const { data, isLoading } = useAutomationRuleQuery(ruleId);
  const rule = data?.data;
  const updateRule = useUpdateAutomationRule(ruleId);

  const initial: BuilderState = useMemo(() => {
    if (!rule) return emptyBuilderState();
    return {
      name: rule.name,
      description: rule.description ?? '',
      eventType: rule.eventType,
      conditions: rule.conditions,
      actions: rule.actions,
    };
  }, [rule]);

  if (isLoading || !rule) {
    return (
      <div className="mx-auto max-w-3xl p-4 sm:p-6" dir="rtl">
        <PageSkeleton variant="document" />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl p-4 sm:p-6" dir="rtl">
      <PageHeader
        title={`تعديل: ${rule.name}`}
        breadcrumbs={[
          { label: 'أتمتة Gates', href: '/automation' },
          { label: rule.name, href: `/automation/${ruleId}` },
          { label: 'تعديل' },
        ]}
      />
      <AutomationBuilder
        initial={initial}
        isEditing
        initialEnabled={rule.enabled}
        saving={updateRule.isPending}
        onSave={async (payload) => {
          await updateRule.mutateAsync(payload);
          router.push(`/automation/${ruleId}`);
        }}
      />
    </div>
  );
}
