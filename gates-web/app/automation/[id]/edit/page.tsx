'use client';

import { useMemo } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { PageHeader, PageSkeleton } from '@/components/ui';
import { useAutomationRuleQuery, useUpdateAutomationRule } from '@/lib/hooks/useAutomationRules';
import { AutomationBuilder, emptyBuilderState, type BuilderState } from '@/components/automation/builder/AutomationBuilder';
import { useI18n } from '@/lib/i18n';

export default function EditAutomationPage() {
  const params = useParams<{ id: string }>();
  const ruleId = params.id;
  const router = useRouter();
  const { t } = useI18n();

  const { data, isLoading, isError } = useAutomationRuleQuery(ruleId);
  const rule = data?.data;
  const updateRule = useUpdateAutomationRule(ruleId);

  const initial: BuilderState = useMemo(() => {
    if (!rule) return emptyBuilderState();
    return {
      name: rule.name,
      description: rule.description ?? '',
      eventType: rule.eventType,
      conditions: rule.conditions,
      actions: rule.actions.map((action) => ({
        type: action.type,
        config: action.config ? { ...action.config } : {},
      })),
    };
  }, [rule]);

  if (isLoading || !rule) {
    return (
      <div className="mx-auto max-w-3xl p-4 sm:p-6">
        {isError ? <p className="text-sm text-danger">{t('automation.loadError')}</p> : <PageSkeleton variant="document" />}
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl p-4 sm:p-6">
      <PageHeader
        title={t('automation.editTitle', { name: rule.name })}
        breadcrumbs={[
          { label: t('automation.title'), href: '/automation' },
          { label: rule.name, href: `/automation/${ruleId}` },
          { label: t('automation.edit') },
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
