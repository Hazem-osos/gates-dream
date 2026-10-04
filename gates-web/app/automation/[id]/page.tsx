'use client';

import { useParams, useRouter } from 'next/navigation';
import { Pencil, Power } from 'lucide-react';
import { Button, PageHeader, PageSkeleton, StatusBadge } from '@/components/ui';
import { confirmAction } from '@/lib/feedback/confirm';
import {
  useAutomationRuleQuery,
  useDeleteAutomationRule,
  useDuplicateAutomationRule,
  useSetAutomationRuleEnabled,
} from '@/lib/hooks/useAutomationRules';
import { AutomationDetailsView } from '@/components/automation/AutomationDetailsView';
import { AutomationHistoryList } from '@/components/automation/AutomationHistoryList';
import { useI18n } from '@/lib/i18n';

export default function AutomationDetailsPage() {
  const params = useParams<{ id: string }>();
  const ruleId = params.id;
  const router = useRouter();
  const { t } = useI18n();

  const { data, isLoading, isError } = useAutomationRuleQuery(ruleId);
  const rule = data?.data;
  const setEnabled = useSetAutomationRuleEnabled(ruleId);
  const deleteRule = useDeleteAutomationRule(ruleId);
  const duplicateRule = useDuplicateAutomationRule(ruleId);

  if (isError) {
    return (
      <div className="mx-auto max-w-4xl p-4 sm:p-6">
        <p className="text-sm text-danger">{t('automation.loadError')}</p>
      </div>
    );
  }

  if (isLoading || !rule) {
    return (
      <div className="mx-auto max-w-4xl p-4 sm:p-6">
        <PageSkeleton variant="document" />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-4xl p-4 sm:p-6">
      <PageHeader
        title={rule.name}
        description={rule.description ?? undefined}
        breadcrumbs={[{ label: t('automation.title'), href: '/automation' }, { label: rule.name }]}
        statusBadge={
          <StatusBadge
            tone={rule.enabled ? 'success' : 'neutral'}
            label={rule.enabled ? t('automation.enabled') : t('automation.disabled')}
            compact
          />
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
            {rule.enabled ? t('automation.disable') : t('automation.enable')}
          </Button>
        }
        menuItems={[
          {
            id: 'edit',
            label: t('automation.edit'),
            icon: <Pencil className="h-4 w-4" />,
            onClick: () => router.push(`/automation/${ruleId}/edit`),
          },
          {
            id: 'duplicate',
            label: t('automation.duplicate'),
            onClick: async () => {
              const result = await duplicateRule.mutateAsync({});
              const newId = result.data?.id;
              if (newId) router.push(`/automation/${newId}`);
            },
          },
          {
            id: 'delete',
            label: t('automation.delete'),
            destructive: true,
            onClick: async () => {
              const ok = await confirmAction(t('automation.confirmDelete', { name: rule.name }));
              if (!ok) return;
              await deleteRule.mutateAsync();
              router.push('/automation');
            },
          },
        ]}
      />

      <div className="flex flex-col gap-6">
        {rule.attention?.needsAttention ? (
          <div className="rounded-2xl border border-warning/40 bg-[var(--warning-soft,rgba(245,158,11,0.12))] p-4">
            <p className="text-sm font-bold text-foreground">{t('automation.needsAttention')}</p>
            <p className="mt-1 text-xs text-foreground-muted">{t('automation.needsAttentionHint')}</p>
            <ul className="mt-2 list-disc ps-5 text-xs text-foreground">
              {rule.attention.messages.map((message) => (
                <li key={message}>{message}</li>
              ))}
            </ul>
          </div>
        ) : null}
        <AutomationDetailsView rule={rule} />
        <section>
          <h2 className="mb-3 text-base font-bold text-foreground">{t('automation.history')}</h2>
          <AutomationHistoryList ruleId={ruleId} />
        </section>
      </div>
    </div>
  );
}
