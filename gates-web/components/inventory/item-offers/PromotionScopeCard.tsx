'use client';

import { SearchableMultiSelect, type MultiSelectOption } from './SearchableMultiSelect';

export type PromotionTargetType = 'SALES' | 'PURCHASES';

type Props = {
  targetType: PromotionTargetType;
  applyToAllParties: boolean;
  setApplyToAllParties: (value: boolean) => void;
  targetPartyIds: string[];
  setTargetPartyIds: (ids: string[]) => void;
  applyToAllPatterns: boolean;
  setApplyToAllPatterns: (value: boolean) => void;
  targetPatternIds: string[];
  setTargetPatternIds: (ids: string[]) => void;
  customersList: MultiSelectOption[];
  suppliersList: MultiSelectOption[];
  entryPatternsList: MultiSelectOption[];
  disabled?: boolean;
  partyError?: string;
  patternError?: string;
};

export function PromotionScopeCard({
  targetType,
  applyToAllParties,
  setApplyToAllParties,
  targetPartyIds,
  setTargetPartyIds,
  applyToAllPatterns,
  setApplyToAllPatterns,
  targetPatternIds,
  setTargetPatternIds,
  customersList,
  suppliersList,
  entryPatternsList,
  disabled,
  partyError,
  patternError,
}: Props) {
  const isSales = targetType === 'SALES';
  const partyList = isSales ? customersList : suppliersList;
  const partyLabel = isSales ? 'العملاء' : 'الموردين';
  const partyPlaceholder = isSales
    ? 'ابحث واختر العملاء المشمولين بالعرض...'
    : 'ابحث واختر الموردين...';

  return (
    <div className="mb-4 space-y-4 rounded-xl border border-border/80 bg-card p-4 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border/60 pb-2">
        <h3 className="text-xs font-bold text-foreground">نطاق سريان العرض (تطبق على)</h3>
        <span className="text-[11px] text-muted-foreground">
          حدد جهات التعامل وأنماط الفواتير التي ينطبق عليها العرض
        </span>
      </div>

      <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
        <div className="space-y-2">
          <div className="flex items-center justify-between gap-2">
            <label className="text-xs font-semibold text-foreground">وحدات الإدخال (أنماط الفواتير)</label>
            <label className="flex cursor-pointer items-center gap-1.5 text-xs text-primary">
              <input
                type="checkbox"
                checked={applyToAllPatterns}
                disabled={disabled}
                onChange={(e) => {
                  setApplyToAllPatterns(e.target.checked);
                  if (e.target.checked) setTargetPatternIds([]);
                }}
                className="h-3.5 w-3.5 rounded border-input text-primary focus:ring-primary"
              />
              <span className="font-medium">تطبيق على كافة وحدات الإدخال</span>
            </label>
          </div>
          {!applyToAllPatterns ? (
            <SearchableMultiSelect
              options={entryPatternsList}
              selectedValues={targetPatternIds}
              onChange={setTargetPatternIds}
              placeholder="اختر أنماط الفواتير المشمولة (نقدي، آجل، POS...)"
              disabled={disabled}
            />
          ) : (
            <div className="rounded-lg border border-border/60 bg-muted/40 p-2.5 text-center text-xs text-muted-foreground">
              العرض سارٍ على جميع أنماط وشاشات الإدخال
            </div>
          )}
          {patternError ? <p className="text-xs text-destructive">{patternError}</p> : null}
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between gap-2">
            <label className="text-xs font-semibold text-foreground">{partyLabel} المشمولين</label>
            <label className="flex cursor-pointer items-center gap-1.5 text-xs text-primary">
              <input
                type="checkbox"
                checked={applyToAllParties}
                disabled={disabled}
                onChange={(e) => {
                  setApplyToAllParties(e.target.checked);
                  if (e.target.checked) setTargetPartyIds([]);
                }}
                className="h-3.5 w-3.5 rounded border-input text-primary focus:ring-primary"
              />
              <span className="font-medium">تطبيق على كافة {partyLabel}</span>
            </label>
          </div>
          {!applyToAllParties ? (
            <SearchableMultiSelect
              options={partyList}
              selectedValues={targetPartyIds}
              onChange={setTargetPartyIds}
              placeholder={partyPlaceholder}
              disabled={disabled}
            />
          ) : (
            <div className="rounded-lg border border-border/60 bg-muted/40 p-2.5 text-center text-xs text-muted-foreground">
              العرض متاح لجميع {partyLabel} دون استثناء
            </div>
          )}
          {partyError ? <p className="text-xs text-destructive">{partyError}</p> : null}
        </div>
      </div>
    </div>
  );
}
