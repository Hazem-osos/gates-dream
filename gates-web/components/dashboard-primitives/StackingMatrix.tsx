'use client';

import { useMemo, useState } from 'react';
import { cn } from '@/lib/utils';
import { DASH_LABEL, DASH_NUM, DASH_PANEL } from './tokens';

export type StackingUnit = {
  id: string;
  unitCode: string;
  floor: number;
  netArea: number;
  totalPrice: number;
  status: string;
  reservation?: {
    id: string;
    expiryDate: string | null;
    customerName: string;
    status: string;
    reservationAmount: number;
  } | null;
};

export type StackingBuilding = {
  id: string;
  name: string;
  projectName: string;
  totalFloors: number;
  units: StackingUnit[];
};

const STATUS_BG: Record<string, string> = {
  AVAILABLE: 'bg-emerald-50 border-emerald-200 text-emerald-800',
  RESERVED: 'bg-amber-50 border-amber-300 text-amber-900',
  SOLD: 'bg-slate-200 border-slate-300 text-slate-700',
  DELIVERED: 'bg-slate-300 border-slate-400 text-slate-800',
  CONTRACTED: 'bg-slate-200 border-slate-300 text-slate-700',
  BLOCKED: 'bg-rose-50 border-rose-300 text-rose-800',
};

const STATUS_AR: Record<string, string> = {
  AVAILABLE: 'متاح',
  RESERVED: 'محجوز',
  SOLD: 'مباع',
  DELIVERED: 'مسلّم',
  CONTRACTED: 'متعاقد',
  BLOCKED: 'موقوف',
};

function hoursLeft(iso?: string | null): number | null {
  if (!iso) return null;
  const ms = Date.parse(iso) - Date.now();
  if (Number.isNaN(ms)) return null;
  return Math.round(ms / 36e5);
}

export function StackingMatrix({
  buildings,
  loading,
  onUnitClick,
}: {
  buildings: StackingBuilding[];
  loading?: boolean;
  onUnitClick?: (unit: StackingUnit, building: StackingBuilding) => void;
}) {
  const [buildingId, setBuildingId] = useState(buildings[0]?.id ?? '');
  const building = buildings.find((b) => b.id === buildingId) ?? buildings[0];

  const floors = useMemo(() => {
    if (!building) return [];
    const maxFloor = Math.max(building.totalFloors || 0, ...building.units.map((u) => u.floor), 0);
    const byFloor = new Map<number, StackingUnit[]>();
    for (let f = maxFloor; f >= 0; f--) byFloor.set(f, []);
    for (const u of building.units) {
      const list = byFloor.get(u.floor) ?? [];
      list.push(u);
      byFloor.set(u.floor, list);
    }
    return [...byFloor.entries()].sort((a, b) => b[0] - a[0]);
  }, [building]);

  return (
    <section className={cn(DASH_PANEL, 'overflow-hidden')}>
      <div className="flex flex-wrap items-center gap-2 border-b border-slate-200/80 px-2.5 py-1.5">
        <h2 className="text-xs font-semibold text-slate-900">خريطة البرج</h2>
        <select
          className="h-7 border border-slate-200/80 bg-white px-2 font-mono text-[11px]"
          value={building?.id ?? ''}
          onChange={(e) => setBuildingId(e.target.value)}
        >
          {buildings.map((b) => (
            <option key={b.id} value={b.id}>
              {b.projectName} · {b.name}
            </option>
          ))}
        </select>
        <div className="ms-auto flex flex-wrap gap-2 text-[10px] text-slate-500">
          {Object.entries(STATUS_AR).map(([k, label]) => (
            <span key={k} className={cn('border px-1.5 py-0.5', STATUS_BG[k])}>
              {label}
            </span>
          ))}
        </div>
      </div>
      {loading ? (
        <div className="h-48 animate-pulse bg-slate-50" />
      ) : !building ? (
        <p className="px-2.5 py-8 text-center text-xs text-slate-400">لا توجد مباني أو وحدات بعد — عرّف وحدة من الإنشاءات.</p>
      ) : (
        <div className="max-h-[28rem] overflow-auto p-2">
          {floors.map(([floor, units]) => (
            <div key={floor} className="mb-1.5 flex items-start gap-2">
              <span className={cn(DASH_LABEL, DASH_NUM, 'w-10 pt-1 text-left')}>د{floor}</span>
              <div className="grid flex-1 grid-cols-4 gap-1 sm:grid-cols-6 lg:grid-cols-8">
                {units.length === 0 ? (
                  <span className="col-span-full py-1 text-[10px] text-slate-300">—</span>
                ) : (
                  units.map((u) => {
                    const hrs = hoursLeft(u.reservation?.expiryDate);
                    return (
                      <button
                        key={u.id}
                        type="button"
                        onClick={() => onUnitClick?.(u, building)}
                        className={cn(
                          'rounded-sm border px-1.5 py-1 text-right transition hover:ring-1 hover:ring-[#0E79AA]',
                          STATUS_BG[u.status] ?? STATUS_BG.BLOCKED
                        )}
                      >
                        <span className={cn(DASH_NUM, 'block text-[11px] font-semibold')}>{u.unitCode}</span>
                        <span className="block text-[9px] opacity-80">
                          {u.netArea > 0 ? `${u.netArea} م²` : STATUS_AR[u.status] ?? u.status}
                        </span>
                        {u.status === 'RESERVED' && hrs != null ? (
                          <span className={cn(DASH_NUM, 'block text-[9px]', hrs <= 48 ? 'text-rose-700' : '')}>
                            {hrs <= 0 ? 'منتهٍ' : `${hrs}س`}
                          </span>
                        ) : null}
                      </button>
                    );
                  })
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
