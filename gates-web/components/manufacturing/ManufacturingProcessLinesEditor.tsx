'use client';

import { useCallback, useMemo } from 'react';
import Link from 'next/link';
import { Plus, Trash2 } from 'lucide-react';
import { Button, compactControlClass } from '@/components/ui';
import { compactNumericControlClass } from '@/components/ui/forms/formTokens';
import { ItemAlternativesPeek } from '@/components/manufacturing/ItemAlternativesPeek';
import {
  MfgTableCard,
  mfgTableClass,
  mfgTdClass,
  mfgTdIdx,
  mfgTdNum,
  mfgThAvail,
  mfgThClass,
  mfgThIdx,
  mfgThItem,
  mfgThMoney,
  mfgThQty,
  mfgThUnit,
  mfgTheadStickyClass,
  mfgTrClass,
} from '@/components/manufacturing/ManufacturingPageChrome';
import { ManufacturingStockBalanceCell } from '@/components/manufacturing/ManufacturingStockBalanceCell';
import { AccountSelect } from '@/app/components/form/AccountSelect';
import { CostCenterSelect } from '@/app/components/form/CostCenterSelect';
import { cn } from '@/lib/utils';
import {
  emptyProcessAdditionalRow,
  emptyProcessOutputRow,
  emptyProcessRawRow,
  type LoadedManufacturingProcess,
  type ProcessVarianceRow,
} from '@/lib/manufacturing/process-from-bom';
import { computeAdditionalCostsTotal } from '@/lib/manufacturing/bom-cost-distribution';

type MfgItemOption = {
  id: string;
  arabicName: string;
  averageCost?: string | number | null;
};

function round4(n: number): number {
  return Math.round(n * 10000) / 10000;
}

function fmt(value: number): string {
  return value.toLocaleString('en-US', { maximumFractionDigits: 4 });
}

function fmtPct(value: number): string {
  return `${value.toLocaleString('en-US', { maximumFractionDigits: 2 })}%`;
}

function defaultUnitPrice(item?: MfgItemOption): number {
  if (!item) return 0;
  const avg = Number(item.averageCost);
  return Number.isFinite(avg) && avg > 0 ? avg : 0;
}

function varianceRowId(kind: 'out' | 'raw', itemId: string, index: number): string {
  return `${kind}:${itemId || 'row'}:${index}`;
}

export type WorkOrderOutputProgress = {
  completedByItemId: Record<string, number>;
  onCompletedChange: (itemId: string, completed: number) => void;
};

export type ManufacturingProcessLinesEditorProps = {
  process: LoadedManufacturingProcess | null;
  onProcessChange: (next: LoadedManufacturingProcess) => void;
  disabled?: boolean;
  items: MfgItemOption[];
  fromWarehouse: string;
  finishedWarehouseId: string;
  bomEditHref?: string;
  materialCostFromOrder?: number;
  /** عند true يُعرض إجمالي المواد المرحّل فعلياً بدل مجموع الأسطر */
  usePostedMaterialTotal?: boolean;
  emptyProcessSeed: () => LoadedManufacturingProcess;
  /** Same tables as operation; adds منجز/متبقي on outputs when workOrderProgress is set */
  layoutMode?: 'operation' | 'work-order';
  workOrderProgress?: WorkOrderOutputProgress;
  /** في أمر التصنيع: الأسعار من النظام ولا تُعدَّل يدوياً */
  unitPricesReadOnly?: boolean;
};

export function ManufacturingProcessLinesEditor({
  process,
  onProcessChange,
  disabled = false,
  items,
  fromWarehouse,
  finishedWarehouseId,
  bomEditHref,
  materialCostFromOrder = 0,
  usePostedMaterialTotal = false,
  emptyProcessSeed,
  layoutMode = 'operation',
  workOrderProgress,
  unitPricesReadOnly = layoutMode === 'operation',
}: ManufacturingProcessLinesEditorProps) {
  const workOrderMode = layoutMode === 'work-order';
  const showProgress = workOrderMode && Boolean(workOrderProgress);
  const itemById = useMemo(() => {
    const map = new Map<string, MfgItemOption>();
    for (const it of items) map.set(it.id, it);
    return map;
  }, [items]);

  const ensure = useCallback(
    (recipe: (p: LoadedManufacturingProcess) => LoadedManufacturingProcess) => {
      const base = process ?? emptyProcessSeed();
      onProcessChange(recipe(base));
    },
    [process, onProcessChange, emptyProcessSeed]
  );

  const mfgSelectItem = cn(compactControlClass, 'h-10 min-w-[12rem] w-full text-sm');
  const mfgInputQty = cn(compactNumericControlClass, 'max-w-none');

  const itemSelect = (
    value: string,
    onChange: (id: string, item?: MfgItemOption) => void
  ) => (
    <select
      value={value}
      disabled={disabled}
      onChange={(e) => {
        const id = e.target.value;
        onChange(id, id ? itemById.get(id) : undefined);
      }}
      className={mfgSelectItem}
    >
      <option value="">— اختر الصنف —</option>
      {items.map((it) => (
        <option key={it.id} value={it.id}>
          {it.arabicName}
        </option>
      ))}
    </select>
  );

  const outputs = process?.outputs ?? [emptyProcessOutputRow()];
  const raws = process?.raws ?? [emptyProcessRawRow()];
  const additionalCosts = process?.additionalCosts ?? [emptyProcessAdditionalRow()];

  const rawMaterialsTotal = raws.reduce((s, r) => s + (r.lineTotal || 0), 0);
  const additionalCostsTotal = useMemo(
    () =>
      computeAdditionalCostsTotal(
        additionalCosts.map((c) => ({
          value: c.value,
          manufacturedItemId: c.manufacturedItemId || undefined,
        }))
      ),
    [additionalCosts]
  );

  const varianceRows = useMemo(() => {
    if (!process) return [] as ProcessVarianceRow[];
    const rows: ProcessVarianceRow[] = [];
    const overrides = process.varianceActualOverrides ?? {};

    process.outputs.forEach((o, index) => {
      if (!o.itemId.trim() && !o.itemName.trim()) return;
      const id = varianceRowId('out', o.itemId, index);
      const estimated = o.quantity;
      rows.push({
        id,
        itemName: o.itemName || itemById.get(o.itemId)?.arabicName || o.itemId,
        estimated,
        actual: overrides[id] ?? estimated,
      });
    });

    process.raws.forEach((r, index) => {
      if (!r.itemId.trim() && !r.itemName.trim()) return;
      const id = varianceRowId('raw', r.itemId, index);
      const estimated = r.quantity;
      rows.push({
        id,
        itemName: r.itemName || itemById.get(r.itemId)?.arabicName || r.itemId,
        estimated,
        actual: overrides[id] ?? estimated,
      });
    });

    for (const extra of process.varianceExtras ?? []) {
      rows.push(extra);
    }
    return rows;
  }, [process, itemById]);

  const patchVarianceActual = (rowId: string, actual: number) => {
    ensure((p) => ({
      ...p,
      varianceActualOverrides: { ...(p.varianceActualOverrides ?? {}), [rowId]: actual },
    }));
  };

  const addVarianceRow = () => {
    ensure((p) => ({
      ...p,
      varianceExtras: [
        ...(p.varianceExtras ?? []),
        {
          id: `manual:${Date.now()}`,
          itemName: '',
          estimated: 0,
          actual: 0,
        },
      ],
    }));
  };

  const patchVarianceExtra = (id: string, patch: Partial<ProcessVarianceRow>) => {
    ensure((p) => ({
      ...p,
      varianceExtras: (p.varianceExtras ?? []).map((r) => (r.id === id ? { ...r, ...patch } : r)),
    }));
  };

  const removeVarianceExtra = (id: string) => {
    ensure((p) => ({
      ...p,
      varianceExtras: (p.varianceExtras ?? []).filter((r) => r.id !== id),
    }));
  };

  return (
    <>
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <MfgTableCard
          scrollViewport
          title={showProgress ? 'أصناف ناتجة — تقدم الإنتاج' : 'أصناف ناتجة'}
          toolbar={
              <Button
                type="button"
                variant="secondary"
                size="sm"
                disabled={disabled}
                onClick={() =>
                  ensure((p) => ({ ...p, outputs: [...p.outputs, emptyProcessOutputRow()] }))
                }
                className="gap-1.5"
              >
                <Plus className="h-4 w-4" />
                إضافة صنف
              </Button>
          }
        >
          {process && !finishedWarehouseId ? (
            <p className="mb-2 text-xs text-amber-800">
              لعرض رصيد الأصناف الناتجة حدّد مخزن «إلى» أو{' '}
              {bomEditHref ? (
                <Link href={bomEditHref} className="font-semibold text-[#0E78AA] underline">
                  مخازن النموذج
                </Link>
              ) : (
                'مخازن النموذج'
              )}
              .
            </p>
          ) : null}
          <table className={mfgTableClass}>
            <thead className={mfgTheadStickyClass}>
              <tr>
                <th className={mfgThIdx}>م</th>
                <th className={mfgThItem}>إسم الصنف</th>
                <th className={mfgThAvail}>الكمية المتاحة</th>
                <th className={mfgThQty}>{showProgress ? 'المطلوب' : 'الكمية'}</th>
                {showProgress ? (
                  <>
                    <th className={mfgThQty}>المنجز</th>
                    <th className={mfgThQty}>المتبقي</th>
                    <th className={cn(mfgThClass, 'min-w-[5rem]')}>٪</th>
                  </>
                ) : null}
                <th className={mfgThUnit}>الوحدة</th>
                <th className={mfgThMoney}>سعر</th>
                <th className={mfgThMoney}>الإجمالي</th>
                <th className={cn(mfgThClass, 'w-9')} />
              </tr>
            </thead>
            <tbody>
              {outputs.map((row, index) => {
                const completed = workOrderProgress?.completedByItemId[row.itemId] ?? 0;
                const remaining = Math.max(0, row.quantity - completed);
                const pct =
                  row.quantity > 0 ? Math.min(100, (completed / row.quantity) * 100) : 0;
                return (
                <tr key={`out-${index}`} className={mfgTrClass}>
                  <td className={mfgTdIdx}>{index + 1}</td>
                  <td className={cn(mfgTdClass, 'min-w-0')}>
                    <div className="flex min-w-0 items-center gap-1">
                      <div className="min-w-0 flex-1">
                        {itemSelect(row.itemId, (itemId, item) => {
                          const qty = row.quantity;
                          const unitPrice =
                            row.unitPrice > 0 ? row.unitPrice : defaultUnitPrice(item);
                          const lineTotal = round4(qty * unitPrice);
                          ensure((p) => {
                            const next = [...p.outputs];
                            next[index] = {
                              ...row,
                              itemId,
                              itemName: item?.arabicName ?? '',
                              unitPrice,
                              lineTotal,
                            };
                            return { ...p, outputs: next };
                          });
                        })}
                      </div>
                      <ItemAlternativesPeek itemId={row.itemId} />
                    </div>
                  </td>
                  <td className={mfgTdClass}>
                    <ManufacturingStockBalanceCell
                      itemId={row.itemId}
                      warehouseId={row.warehouseId || finishedWarehouseId}
                      bomEditHref={bomEditHref}
                    />
                  </td>
                  <td className={mfgTdClass}>
                    <input
                      type="number"
                      min={0}
                      step="0.0001"
                      disabled={disabled}
                      className={mfgInputQty}
                      value={row.quantity}
                      onChange={(e) => {
                        const qty = Number(e.target.value);
                        const safeQty = Number.isFinite(qty) ? qty : 0;
                        const lineTotal = round4(safeQty * row.unitPrice);
                        ensure((p) => {
                          const next = [...p.outputs];
                          next[index] = { ...row, quantity: safeQty, lineTotal };
                          return { ...p, outputs: next };
                        });
                      }}
                    />
                  </td>
                  {showProgress && workOrderProgress ? (
                    <>
                      <td className={mfgTdClass}>
                        <input
                          type="number"
                          min={0}
                          step="0.0001"
                          disabled={disabled}
                          className={cn(mfgInputQty, 'font-semibold text-[#0E78AA]')}
                          value={completed || ''}
                          onChange={(e) => {
                            const n = Number(e.target.value);
                            workOrderProgress.onCompletedChange(
                              row.itemId,
                              Number.isFinite(n) ? Math.max(0, n) : 0
                            );
                          }}
                        />
                      </td>
                      <td className={mfgTdNum}>{fmt(remaining)}</td>
                      <td className={mfgTdNum}>{pct.toFixed(0)}%</td>
                    </>
                  ) : null}
                  <td className={mfgTdClass}>
                    <input
                      disabled={disabled}
                      className={cn(compactControlClass, 'h-10 min-w-0 px-2.5 text-sm')}
                      value={row.unit}
                      onChange={(e) =>
                        ensure((p) => {
                          const next = [...p.outputs];
                          next[index] = { ...row, unit: e.target.value };
                          return { ...p, outputs: next };
                        })
                      }
                    />
                  </td>
                  <td className={mfgTdClass}>
                    {unitPricesReadOnly ? (
                      <span className={mfgTdNum}>{fmt(row.unitPrice)}</span>
                    ) : (
                      <input
                        type="number"
                        min={0}
                        step="0.0001"
                        disabled={disabled}
                        className={mfgInputQty}
                        value={row.unitPrice}
                        onChange={(e) => {
                          const unitPrice = Number(e.target.value);
                          const safe = Number.isFinite(unitPrice) ? unitPrice : 0;
                          const lineTotal = round4(row.quantity * safe);
                          ensure((p) => {
                            const next = [...p.outputs];
                            next[index] = { ...row, unitPrice: safe, lineTotal };
                            return { ...p, outputs: next };
                          });
                        }}
                      />
                    )}
                  </td>
                  <td className={mfgTdNum}>{fmt(row.lineTotal)}</td>
                  <td className={mfgTdClass}>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      disabled={disabled || outputs.length <= 1}
                      onClick={() =>
                        ensure((p) => ({
                          ...p,
                          outputs: p.outputs.filter((_, i) => i !== index),
                        }))
                      }
                      className="h-8 w-8 p-0 text-rose-600"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </td>
                </tr>
              );
              })}
            </tbody>
          </table>
        </MfgTableCard>

        <MfgTableCard
          scrollViewport
          title="أصناف الخامات الأولية"
          toolbar={
            <Button
              type="button"
              variant="secondary"
              size="sm"
              disabled={disabled}
              onClick={() =>
                ensure((p) => ({ ...p, raws: [...p.raws, emptyProcessRawRow()] }))
              }
              className="gap-1.5"
            >
              <Plus className="h-4 w-4" />
              إضافة خام
            </Button>
          }
        >
          <table className={mfgTableClass}>
            <thead className={mfgTheadStickyClass}>
              <tr>
                <th className={mfgThIdx}>م</th>
                <th className={mfgThItem}>إسم الصنف</th>
                <th className={mfgThAvail}>الكمية المتاحة</th>
                <th className={mfgThQty}>الكمية</th>
                <th className={mfgThUnit}>الوحدة</th>
                <th className={mfgThMoney}>سعر الوحدة</th>
                <th className={mfgThMoney}>الإجمالي</th>
                <th className={cn(mfgThClass, 'w-9')} />
              </tr>
            </thead>
            <tbody>
              {raws.map((row, index) => (
                <tr key={`raw-${index}`} className={mfgTrClass}>
                  <td className={mfgTdIdx}>{index + 1}</td>
                  <td className={cn(mfgTdClass, 'min-w-0')}>
                    <div className="flex min-w-0 items-center gap-1">
                      <div className="min-w-0 flex-1">
                        {itemSelect(row.itemId, (itemId, item) => {
                          const unitPrice =
                            row.unitPrice > 0 ? row.unitPrice : defaultUnitPrice(item);
                          const lineTotal = round4(row.quantity * unitPrice);
                          ensure((p) => {
                            const next = [...p.raws];
                            next[index] = {
                              ...row,
                              itemId,
                              itemName: item?.arabicName ?? '',
                              unitPrice,
                              lineTotal,
                              warehouseId: row.warehouseId || fromWarehouse,
                            };
                            return { ...p, raws: next };
                          });
                        })}
                      </div>
                      <ItemAlternativesPeek itemId={row.itemId} />
                    </div>
                  </td>
                  <td className={mfgTdClass}>
                    <ManufacturingStockBalanceCell
                      itemId={row.itemId}
                      warehouseId={row.warehouseId || fromWarehouse}
                      bomEditHref={bomEditHref}
                    />
                  </td>
                  <td className={mfgTdClass}>
                    <input
                      type="number"
                      min={0}
                      step="0.0001"
                      disabled={disabled}
                      className={mfgInputQty}
                      value={row.quantity}
                      onChange={(e) => {
                        const qty = Number(e.target.value);
                        const safeQty = Number.isFinite(qty) ? qty : 0;
                        const lineTotal = round4(safeQty * row.unitPrice);
                        ensure((p) => {
                          const next = [...p.raws];
                          next[index] = { ...row, quantity: safeQty, lineTotal };
                          return { ...p, raws: next };
                        });
                      }}
                    />
                  </td>
                  <td className={mfgTdClass}>
                    <input
                      disabled={disabled}
                      className={cn(compactControlClass, 'h-10 min-w-0 px-2.5 text-sm')}
                      value={row.unit}
                      onChange={(e) =>
                        ensure((p) => {
                          const next = [...p.raws];
                          next[index] = { ...row, unit: e.target.value };
                          return { ...p, raws: next };
                        })
                      }
                    />
                  </td>
                  <td className={mfgTdClass}>
                    {unitPricesReadOnly ? (
                      <span className={mfgTdNum}>{row.unitPrice > 0 ? fmt(row.unitPrice) : '—'}</span>
                    ) : (
                      <input
                        type="number"
                        min={0}
                        step="0.0001"
                        disabled={disabled}
                        className={mfgInputQty}
                        value={row.unitPrice}
                        onChange={(e) => {
                          const unitPrice = Number(e.target.value);
                          const safe = Number.isFinite(unitPrice) ? unitPrice : 0;
                          const lineTotal = round4(row.quantity * safe);
                          ensure((p) => {
                            const next = [...p.raws];
                            next[index] = { ...row, unitPrice: safe, lineTotal };
                            return { ...p, raws: next };
                          });
                        }}
                      />
                    )}
                  </td>
                  <td className={mfgTdNum}>{row.lineTotal > 0 ? fmt(row.lineTotal) : '—'}</td>
                  <td className={mfgTdClass}>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      disabled={disabled || raws.length <= 1}
                      onClick={() =>
                        ensure((p) => ({
                          ...p,
                          raws: p.raws.filter((_, i) => i !== index),
                        }))
                      }
                      className="h-8 w-8 p-0 text-rose-600"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </td>
                </tr>
              ))}
              <tr className={cn(mfgTrClass, 'bg-[#F8FBFD] font-semibold')}>
                <td colSpan={6} className={cn(mfgTdClass, 'text-left')}>
                  الإجمالي
                </td>
                <td className={cn(mfgTdClass, 'tabular-nums')}>
                  {usePostedMaterialTotal && materialCostFromOrder > 0
                    ? fmt(materialCostFromOrder)
                    : rawMaterialsTotal > 0
                      ? fmt(rawMaterialsTotal)
                      : '—'}
                </td>
                <td />
              </tr>
            </tbody>
          </table>
        </MfgTableCard>
      </div>

      <MfgTableCard
        scrollViewport
        title="تكلفة إضافية"
        toolbar={
          <Button
            type="button"
            variant="secondary"
            size="sm"
            disabled={disabled}
            onClick={() =>
              ensure((p) => ({
                ...p,
                additionalCosts: [...p.additionalCosts, emptyProcessAdditionalRow()],
              }))
            }
            className="gap-1.5"
          >
            <Plus className="h-4 w-4" />
            إضافة تكلفة
          </Button>
        }
      >
        <table className={mfgTableClass}>
          <thead className={mfgTheadStickyClass}>
            <tr>
              <th className={mfgThClass}>اسم الحساب</th>
              <th className={mfgThClass}>القيمة</th>
              <th className={mfgThClass}>النسبة</th>
              <th className={mfgThClass}>الشرح</th>
              <th className={mfgThClass}>مركز التكلفة</th>
              <th className={cn(mfgThClass, 'w-9')} />
            </tr>
          </thead>
          <tbody>
            {additionalCosts.map((row, index) => (
              <tr key={`add-${index}`} className={mfgTrClass}>
                <td className={mfgTdClass}>
                  <AccountSelect
                    value={row.accountId}
                    disabled={disabled}
                    onChange={(accountId) =>
                      ensure((p) => {
                        const next = [...p.additionalCosts];
                        next[index] = { ...row, accountId };
                        return { ...p, additionalCosts: next };
                      })
                    }
                    className={cn(compactControlClass, 'w-full min-w-[180px]')}
                    placeholder="اختر الحساب"
                    selectedAccount={
                      row.accountId && row.accountLabel
                        ? { id: row.accountId, code: '', arabicName: row.accountLabel }
                        : undefined
                    }
                  />
                </td>
                <td className={mfgTdClass}>
                  <input
                    type="number"
                    min={0}
                    step="0.01"
                    disabled={disabled}
                    className={mfgInputQty}
                    value={row.value}
                    onChange={(e) => {
                      const value = Number(e.target.value);
                      ensure((p) => {
                        const next = [...p.additionalCosts];
                        next[index] = {
                          ...row,
                          value: Number.isFinite(value) ? value : 0,
                        };
                        return { ...p, additionalCosts: next };
                      });
                    }}
                  />
                </td>
                <td className={mfgTdClass}>
                  <input
                    type="number"
                    min={0}
                    step="0.01"
                    disabled={disabled}
                    className={mfgInputQty}
                    value={row.valuePercent}
                    onChange={(e) => {
                      const valuePercent = Number(e.target.value);
                      ensure((p) => {
                        const next = [...p.additionalCosts];
                        next[index] = {
                          ...row,
                          valuePercent: Number.isFinite(valuePercent) ? valuePercent : 0,
                        };
                        return { ...p, additionalCosts: next };
                      });
                    }}
                  />
                </td>
                <td className={mfgTdClass}>
                  <input
                    disabled={disabled}
                    className={compactControlClass}
                    value={row.description}
                    onChange={(e) =>
                      ensure((p) => {
                        const next = [...p.additionalCosts];
                        next[index] = { ...row, description: e.target.value };
                        return { ...p, additionalCosts: next };
                      })
                    }
                  />
                </td>
                <td className={mfgTdClass}>
                  <CostCenterSelect
                    value={row.costCenter}
                    disabled={disabled}
                    onChange={(id) =>
                      ensure((p) => {
                        const next = [...p.additionalCosts];
                        next[index] = { ...row, costCenter: id };
                        return { ...p, additionalCosts: next };
                      })
                    }
                    className={compactControlClass}
                    allowEmpty
                    emptyLabel="مركز تكلفة"
                    leafOnly
                  />
                </td>
                <td className={mfgTdClass}>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    disabled={disabled || additionalCosts.length <= 1}
                    onClick={() =>
                      ensure((p) => ({
                        ...p,
                        additionalCosts: p.additionalCosts.filter((_, i) => i !== index),
                      }))
                    }
                    className="h-8 w-8 p-0 text-rose-600"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </td>
              </tr>
            ))}
            <tr className={cn(mfgTrClass, 'bg-[#F8FBFD] font-semibold')}>
              <td className={mfgTdClass}>إجمالي التكلفة الإضافية</td>
              <td className={cn(mfgTdClass, 'tabular-nums text-[#0A3D5E]')}>
                {additionalCostsTotal > 0 ? fmt(additionalCostsTotal) : '—'}
              </td>
              <td colSpan={4} className={mfgTdClass} />
            </tr>
          </tbody>
        </table>
      </MfgTableCard>

      <MfgTableCard
        scrollViewport
        title="مقارنة الفعلي بالتقديري"
        toolbar={
          <Button
            type="button"
            variant="secondary"
            size="sm"
            disabled={disabled}
            onClick={addVarianceRow}
            className="gap-1.5"
          >
            <Plus className="h-4 w-4" />
            إضافة سطر
          </Button>
        }
      >
        <table className={mfgTableClass}>
          <thead className={mfgTheadStickyClass}>
            <tr>
              <th className={mfgThClass}>الصنف</th>
              <th className={mfgThMoney}>التقديري</th>
              <th className={mfgThMoney}>الفعلي</th>
              <th className={mfgThMoney}>الانحراف</th>
              <th className={mfgThMoney}>نسبة الانحراف</th>
              <th className={cn(mfgThClass, 'w-9')} />
            </tr>
          </thead>
          <tbody>
            {varianceRows.length === 0 ? (
              <tr className={mfgTrClass}>
                <td colSpan={6} className={cn(mfgTdClass, 'text-center text-slate-500 py-6')}>
                  أضف أصنافاً ناتجة أو خامات، أو اضغط «إضافة سطر» للمقارنة اليدوية
                </td>
              </tr>
            ) : (
              varianceRows.map((row) => {
                const isManual = row.id.startsWith('manual:');
                const variance = row.actual - row.estimated;
                const variancePct =
                  row.estimated !== 0
                    ? (variance / row.estimated) * 100
                    : variance !== 0
                      ? 100
                      : 0;
                const highlight = Math.abs(variance) > 0.001;
                return (
                  <tr key={row.id} className={mfgTrClass}>
                    <td className={mfgTdClass}>
                      {isManual ? (
                        <input
                          disabled={disabled}
                          className={compactControlClass}
                          value={row.itemName}
                          placeholder="اسم الصنف"
                          onChange={(e) =>
                            patchVarianceExtra(row.id, { itemName: e.target.value })
                          }
                        />
                      ) : (
                        row.itemName
                      )}
                    </td>
                    <td className={mfgTdClass}>
                      {isManual ? (
                        <input
                          type="number"
                          step="0.0001"
                          disabled={disabled}
                          className={mfgInputQty}
                          value={row.estimated}
                          onChange={(e) => {
                            const estimated = Number(e.target.value);
                            patchVarianceExtra(row.id, {
                              estimated: Number.isFinite(estimated) ? estimated : 0,
                            });
                          }}
                        />
                      ) : (
                        <span className={mfgTdNum}>{fmt(row.estimated)}</span>
                      )}
                    </td>
                    <td className={mfgTdClass}>
                      <input
                        type="number"
                        step="0.0001"
                        disabled={disabled}
                        className={mfgInputQty}
                        value={row.actual}
                        onChange={(e) => {
                          const actual = Number(e.target.value);
                          const safe = Number.isFinite(actual) ? actual : 0;
                          if (isManual) {
                            patchVarianceExtra(row.id, { actual: safe });
                          } else {
                            patchVarianceActual(row.id, safe);
                          }
                        }}
                      />
                    </td>
                    <td className={cn(mfgTdNum, highlight && 'text-rose-600')}>
                      {fmt(variance)}
                    </td>
                    <td className={cn(mfgTdNum, highlight && 'text-rose-600')}>
                      {fmtPct(variancePct)}
                    </td>
                    <td className={mfgTdClass}>
                      {isManual ? (
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          disabled={disabled}
                          onClick={() => removeVarianceExtra(row.id)}
                          className="h-8 w-8 p-0 text-rose-600"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      ) : null}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </MfgTableCard>
    </>
  );
}
