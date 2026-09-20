'use client';

import { Input } from '@/components/ui';
import { SupplierSelect } from '@/app/components/form/PartySelect';
import { WarehouseSelect } from '@/app/components/form/WarehouseSelect';
import type { AutomationActionDef } from '@/lib/automation/catalog';

type Props = {
  action: AutomationActionDef;
  config: Record<string, unknown>;
  onChange: (config: Record<string, unknown>) => void;
  readOnly?: boolean;
};

/**
 * Generic, metadata-driven config form: renders one control per
 * `action.configFields` entry. Adding a new action type in `catalog.ts`
 * automatically gets a working form here — no per-action UI code needed
 * unless a genuinely new field *type* (beyond supplier/warehouse/text) shows up.
 */
export function ActionConfigForm({ action, config, onChange, readOnly }: Props) {
  const set = (key: string, value: unknown) => onChange({ ...config, [key]: value });

  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {action.configFields.map((field) => {
        const value = config[field.key];
        return (
          <div key={field.key} className={field.type === 'text' ? 'sm:col-span-2' : undefined}>
            <label className="mb-1 block text-xs font-semibold text-slate-600">
              {field.label}
              {field.required ? <span className="mr-1 text-rose-500">*</span> : null}
            </label>
            {field.type === 'supplier' ? (
              <SupplierSelect
                value={typeof value === 'string' ? value : ''}
                onChange={(id) => set(field.key, id)}
                disabled={readOnly}
              />
            ) : field.type === 'warehouse' ? (
              <WarehouseSelect
                value={typeof value === 'string' ? value : ''}
                onChange={(id) => set(field.key, id)}
                disabled={readOnly}
              />
            ) : (
              <Input
                value={typeof value === 'string' ? value : ''}
                onChange={(e) => set(field.key, e.target.value)}
                placeholder={field.placeholder}
                disabled={readOnly}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}
