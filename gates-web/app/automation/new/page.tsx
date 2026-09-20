'use client';

import { useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { PageHeader } from '@/components/ui';
import { useOwnTabSearchParams } from '@/lib/navigation/tab-route-lock';
import { useCreateAutomationRule } from '@/lib/hooks/useAutomationRules';
import { findTemplate } from '@/lib/automation/templates';
import { AutomationBuilder, emptyBuilderState, type BuilderState } from '@/components/automation/builder/AutomationBuilder';

export default function NewAutomationPage() {
  const router = useRouter();
  const searchParams = useOwnTabSearchParams();
  const templateId = searchParams.get('template');
  const createRule = useCreateAutomationRule();

  const initial: BuilderState = useMemo(() => {
    const template = findTemplate(templateId);
    if (!template) return emptyBuilderState();
    return {
      name: template.name,
      description: template.description,
      eventType: template.eventType,
      conditions: template.conditions,
      actions: template.actions,
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- resolve once from the URL template id
  }, [templateId]);

  return (
    <div className="mx-auto max-w-3xl p-4 sm:p-6" dir="rtl">
      <PageHeader
        title="إنشاء أتمتة"
        breadcrumbs={[{ label: 'أتمتة Gates', href: '/automation' }, { label: 'إنشاء أتمتة' }]}
        description="عرّف متى تبدأ الأتمتة، وما الشروط التي يجب توافرها، وما الذي يجب أن تفعله GATES تلقائيًا."
      />
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
