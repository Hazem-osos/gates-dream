'use client';

import { useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { PageHeader, PageSkeleton } from '@/components/ui';
import { useOwnTabSearchParams } from '@/lib/navigation/tab-route-lock';
import { useCreateAutomationRule, useAutomationTemplatesQuery } from '@/lib/hooks/useAutomationRules';
import { catalogText } from '@/lib/automation/labels';
import { AutomationBuilder, emptyBuilderState, type BuilderState } from '@/components/automation/builder/AutomationBuilder';
import type { AutomationCondition, AutomationConditionOperator } from '@/lib/automation/types';
import { useI18n } from '@/lib/i18n';

export default function NewAutomationPage() {
  const router = useRouter();
  const searchParams = useOwnTabSearchParams();
  const templateId = searchParams.get('template');
  const eventParam = searchParams.get('event');
  const nameParam = searchParams.get('name') ?? '';
  const fieldParam = searchParams.get('field');
  const opParam = searchParams.get('op');
  const valueParam = searchParams.get('value');
  const actionParam = searchParams.get('action');
  const createRule = useCreateAutomationRule();
  const templatesQuery = useAutomationTemplatesQuery();
  const { t } = useI18n();

  const template = (templatesQuery.data?.data ?? []).find((item) => item.id === templateId);

  const initial: BuilderState = useMemo(() => {
    if (!template && eventParam) {
      const numeric = valueParam != null && valueParam !== '' && Number.isFinite(Number(valueParam)) ? Number(valueParam) : valueParam;
      const purchase = actionParam === 'gates.createPurchaseRequest';
      return {
        name: nameParam,
        description: '',
        eventType: eventParam,
        conditions:
          fieldParam && opParam
            ? [{ field: fieldParam, operator: opParam as AutomationConditionOperator, value: numeric }]
            : [],
        actions: purchase
          ? [
              {
                type: 'gates.createPurchaseRequest',
                config: {
                  itemId: { source: 'event', field: 'itemId' },
                  warehouseId: { source: 'event', field: 'warehouseId' },
                  quantity: { source: 'event', field: 'shortageQuantity' },
                },
              },
            ]
          : [{ type: 'gates.createNotification', config: { title: nameParam, message: nameParam } }],
      };
    }
    if (!template) return emptyBuilderState();
    return {
      name: catalogText(t, template.labelKey),
      description: catalogText(t, template.descriptionKey),
      eventType: template.eventType,
      conditions: template.conditions.map((condition) => ({
        field: condition.field,
        operator: condition.operator as AutomationConditionOperator,
        value: condition.value,
      })) satisfies AutomationCondition[],
      actions: template.actions.map((action) => ({
        type: action.type,
        config: action.config ? { ...action.config } : {},
      })),
    };
  }, [template, t, eventParam, nameParam, fieldParam, opParam, valueParam, actionParam]);

  if (templateId && templatesQuery.isLoading) {
    return (
      <div className="mx-auto max-w-4xl p-4 sm:p-6">
        <PageSkeleton variant="document" />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-4xl p-4 sm:p-6">
      <PageHeader
        title={t('automation.createTitle')}
        breadcrumbs={[{ label: t('automation.title'), href: '/automation' }, { label: t('automation.create') }]}
        description={t('automation.createDesc')}
      />
      {templateId && !template && !templatesQuery.isLoading ? (
        <p className="mb-4 rounded-xl border border-danger/20 px-4 py-2 text-sm text-danger">{t('automation.templateMissing')}</p>
      ) : null}
      {templatesQuery.isError ? (
        <p className="mb-4 rounded-xl border border-danger/20 px-4 py-2 text-sm text-danger">{t('automation.metadataError')}</p>
      ) : null}
      <AutomationBuilder
        initial={initial}
        saving={createRule.isPending}
        onSave={async (payload) => {
          const result = await createRule.mutateAsync(payload);
          const id = result.data?.id;
          if (id) router.push(`/automation/${id}`);
        }}
      />
    </div>
  );
}
