'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Palette, Shirt } from 'lucide-react';
import {
  PageHeader,
  Button,
  FormStickyFooter,
  AppTable,
  CrudButtons,
  compactControlClass,
} from '@/components/ui';
import { ColorDefinitionModal, type ClothingColor } from '@/components/inventory/ColorDefinitionModal';
import { SizeDefinitionModal, type ClothingSize } from '@/components/inventory/SizeDefinitionModal';
import { useApiQuery, useInvalidateQuery } from '@/lib/hooks/useApi';
import { apiClient } from '@/lib/api/client';
import { queryKeys } from '@/lib/query/query-keys';
import { renderPrintableAndOpen } from '@/app/components/print/PrintDocumentButton';
import ErrorToast from '@/components/ErrorToast';
import SuccessToast from '@/components/SuccessToast';

type ComboRow = {
  key: string;
  colorId: string;
  sizeId: string;
  colorName: string;
  sizeName: string;
  hex: string;
  barcode: string;
  [key: string]: unknown;
};

type ApiCombo = {
  id: string;
  colorId: string;
  sizeId: string;
  barcode?: string | null;
  color?: { arabicName?: string; hex?: string | null; serial?: string | null };
  size?: { arabicName?: string; serial?: string | null };
};

function comboKey(colorId: string, sizeId: string) {
  return `${colorId}:${sizeId}`;
}

function suggestBarcode(color?: ClothingColor, size?: ClothingSize) {
  const a = (color?.serial || color?.arabicName || '').replace(/\s+/g, '');
  const b = (size?.serial || size?.arabicName || '').replace(/\s+/g, '');
  return [a, b].filter(Boolean).join('-');
}

export default function ColorSizeMatrixPage() {
  const router = useRouter();
  const invalidateQuery = useInvalidateQuery();
  const [selectedColors, setSelectedColors] = useState<Set<string>>(new Set());
  const [selectedSizes, setSelectedSizes] = useState<Set<string>>(new Set());
  const [combos, setCombos] = useState<ComboRow[]>([]);
  const [showColors, setShowColors] = useState(false);
  const [showSizes, setShowSizes] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [saving, setSaving] = useState(false);
  const [hydrated, setHydrated] = useState(false);

  const { data: colorsRes } = useApiQuery<ClothingColor[]>(
    queryKeys.clothingColors(),
    '/inventory/clothing-matrix/colors',
    undefined,
    { staleTime: 10_000 }
  );
  const colors = colorsRes?.data ?? [];

  const { data: sizesRes } = useApiQuery<ClothingSize[]>(
    queryKeys.clothingSizes(),
    '/inventory/clothing-matrix/sizes',
    undefined,
    { staleTime: 10_000 }
  );
  const sizes = sizesRes?.data ?? [];

  const { data: combosRes } = useApiQuery<ApiCombo[]>(
    queryKeys.clothingCombos(),
    '/inventory/clothing-matrix/combos',
    undefined,
    { staleTime: 10_000 }
  );

  useEffect(() => {
    if (hydrated || !combosRes?.data) return;
    const rows = combosRes.data;
    setSelectedColors(new Set(rows.map((r) => r.colorId)));
    setSelectedSizes(new Set(rows.map((r) => r.sizeId)));
    setCombos(
      rows.map((r) => ({
        key: comboKey(r.colorId, r.sizeId),
        colorId: r.colorId,
        sizeId: r.sizeId,
        colorName: r.color?.arabicName ?? '',
        sizeName: r.size?.arabicName ?? '',
        hex: r.color?.hex ?? '',
        barcode: r.barcode || suggestBarcode(r.color as ClothingColor, r.size as ClothingSize),
      }))
    );
    setHydrated(true);
  }, [combosRes, hydrated]);

  const handleNew = () => {
    setSelectedColors(new Set());
    setSelectedSizes(new Set());
    setCombos([]);
    setShowColors(false);
    setShowSizes(false);
    setError('');
    setSuccess('');
  };

  const toggle = (set: Set<string>, id: string, setter: (next: Set<string>) => void) => {
    const next = new Set(set);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setter(next);
  };

  const generate = () => {
    const colorMap = new Map(colors.map((c) => [c.id, c]));
    const sizeMap = new Map(sizes.map((s) => [s.id, s]));
    const kept = new Map(combos.map((c) => [c.key, c]));
    const next: ComboRow[] = [];
    for (const colorId of selectedColors) {
      for (const sizeId of selectedSizes) {
        const prev = kept.get(comboKey(colorId, sizeId));
        const color = colorMap.get(colorId);
        const size = sizeMap.get(sizeId);
        if (!color || !size) continue;
        next.push({
          key: comboKey(colorId, sizeId),
          colorId,
          sizeId,
          colorName: color.arabicName,
          sizeName: size.arabicName,
          hex: color.hex || '',
          barcode: prev?.barcode || suggestBarcode(color, size),
        });
      }
    }
    setCombos(next);
    setSuccess(next.length ? `اتولدت ${next.length} تركيبة` : 'اختَر لون ومقاس أولاً');
  };

  const handleSave = async () => {
    setError('');
    setSaving(true);
    try {
      const res = await apiClient.put<ApiCombo[]>('/inventory/clothing-matrix/combos', {
        combos: combos.map((c) => ({
          colorId: c.colorId,
          sizeId: c.sizeId,
          barcode: c.barcode || null,
        })),
      });
      if (res.data) {
        setCombos(
          res.data.map((r) => ({
            key: comboKey(r.colorId, r.sizeId),
            colorId: r.colorId,
            sizeId: r.sizeId,
            colorName: r.color?.arabicName ?? '',
            sizeName: r.size?.arabicName ?? '',
            hex: r.color?.hex ?? '',
            barcode: r.barcode || '',
          }))
        );
      }
      setSuccess('تم حفظ تركيبات الألوان والمقاسات');
      invalidateQuery(['clothing-combos']);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'تعذر الحفظ');
    } finally {
      setSaving(false);
    }
  };

  const printBarcodes = () => {
    if (!combos.length) {
      setError('ولّد التركيبة أولاً');
      return;
    }
    renderPrintableAndOpen(() => (
      <div dir="rtl" style={{ fontFamily: 'sans-serif', padding: 16 }}>
        <h1 style={{ fontSize: 16, marginBottom: 12 }}>باركود الألوان والمقاسات</h1>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12 }}>
          {combos.map((c) => (
            <div
              key={c.key}
              style={{
                width: 180,
                border: '1px solid #ccc',
                borderRadius: 8,
                padding: 8,
                textAlign: 'center',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, justifyContent: 'center' }}>
                <span
                  style={{
                    width: 12,
                    height: 12,
                    borderRadius: 2,
                    background: c.hex || '#999',
                    display: 'inline-block',
                  }}
                />
                <strong>{c.colorName}</strong>
              </div>
              <div>{c.sizeName}</div>
              <div style={{ marginTop: 8, letterSpacing: 2, fontFamily: 'monospace' }}>{c.barcode || '—'}</div>
            </div>
          ))}
        </div>
      </div>
    ));
  };

  const visibleCombos = useMemo(() => combos, [combos]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-blue-50 p-6" style={{ direction: 'rtl' }}>
      {error && <ErrorToast message={error} onClose={() => setError('')} />}
      {success && <SuccessToast message={success} onClose={() => setSuccess('')} />}

      <PageHeader
        title="تركيب الألوان والمقاسات"
        breadcrumbs={[
          { label: 'المخزون', href: '/inventory' },
          { label: 'التعريفات' },
          { label: 'تركيب الألوان والمقاسات' },
        ]}
        actions={
          <CrudButtons
            onPrevious={() => router.back()}
            onAdd={handleNew}
            extraItems={[
              { id: 'colors', label: 'تعريف الألوان', onClick: () => setShowColors(true) },
              { id: 'sizes', label: 'تعريف المقاسات', onClick: () => setShowSizes(true) },
              { id: 'generate', label: 'توليد التركيبة', onClick: generate },
              { id: 'print', label: 'طباعة الباركود', onClick: printBarcodes, disabled: combos.length === 0 },
            ]}
          />
        }
      />

      <p className="mb-4 text-sm text-[#0A3D5E]">
        اختَر الألوان والمقاسات اللي بتبيعها، ولّد التركيبة، وبعدين احفظ. كل صف يبقى لون × مقاس مع باركود للملابس.
      </p>

      <div className="mb-4 grid grid-cols-1 gap-4 md:grid-cols-2">
        <section className="rounded-xl border border-[#E6F0F7] bg-white p-4 shadow-sm">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="flex items-center gap-2 text-sm font-bold text-[#0A3D5E]">
              <Palette className="h-4 w-4" />
              الألوان
            </h2>
            <Button type="button" variant="secondary" size="sm" onClick={() => setShowColors(true)}>
              تعريف الألوان
            </Button>
          </div>
          <div className="max-h-64 space-y-1 overflow-y-auto">
            {colors.map((c) => (
              <label key={c.id} className="flex cursor-pointer items-center gap-2 rounded-lg px-2 py-1.5 hover:bg-[#F6FBFD]">
                <input
                  type="checkbox"
                  className="h-4 w-4"
                  checked={selectedColors.has(c.id)}
                  onChange={() => toggle(selectedColors, c.id, setSelectedColors)}
                />
                <span
                  className="h-4 w-4 rounded border border-[#D6EAF3]"
                  style={{ backgroundColor: c.hex || '#ddd' }}
                />
                <span className="text-sm">{c.arabicName}</span>
              </label>
            ))}
            {!colors.length ? (
              <p className="text-sm text-slate-400">عرّف الألوان أولاً من الزر فوق.</p>
            ) : null}
          </div>
        </section>

        <section className="rounded-xl border border-[#E6F0F7] bg-white p-4 shadow-sm">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="flex items-center gap-2 text-sm font-bold text-[#0A3D5E]">
              <Shirt className="h-4 w-4" />
              المقاسات
            </h2>
            <Button type="button" variant="secondary" size="sm" onClick={() => setShowSizes(true)}>
              تعريف المقاسات
            </Button>
          </div>
          <div className="max-h-64 space-y-1 overflow-y-auto">
            {sizes.map((s) => (
              <label key={s.id} className="flex cursor-pointer items-center gap-2 rounded-lg px-2 py-1.5 hover:bg-[#F6FBFD]">
                <input
                  type="checkbox"
                  className="h-4 w-4"
                  checked={selectedSizes.has(s.id)}
                  onChange={() => toggle(selectedSizes, s.id, setSelectedSizes)}
                />
                <span className="text-sm">{s.arabicName}</span>
              </label>
            ))}
            {!sizes.length ? (
              <p className="text-sm text-slate-400">عرّف المقاسات أولاً من الزر فوق.</p>
            ) : null}
          </div>
        </section>
      </div>

      <div className="mb-3">
        <Button type="button" onClick={generate}>
          توليد التركيبة
        </Button>
      </div>

      <section className="mb-4 overflow-visible rounded-xl border border-[#E6F0F7] bg-white p-4 shadow-sm">
        <h2 className="mb-3 text-sm font-bold text-[#0A3D5E]">التركيبة</h2>
        <AppTable<ComboRow>
          data={visibleCombos}
          getRowKey={(r) => r.key}
          emptyTitle="لا توجد تركيبات"
          emptyDescription="اختَر ألوان ومقاسات ثم اضغط توليد التركيبة."
          columns={[
            {
              id: 'color',
              header: 'اللون',
              cell: (r) => (
                <span className="inline-flex items-center gap-2">
                  <span className="h-4 w-4 rounded border border-[#D6EAF3]" style={{ backgroundColor: r.hex || '#ddd' }} />
                  {r.colorName}
                </span>
              ),
            },
            { id: 'size', header: 'المقاس', cell: (r) => r.sizeName },
            {
              id: 'barcode',
              header: 'الباركود',
              cell: (r) => (
                <input
                  className={compactControlClass}
                  value={r.barcode}
                  onChange={(e) =>
                    setCombos((prev) =>
                      prev.map((row) => (row.key === r.key ? { ...row, barcode: e.target.value } : row))
                    )
                  }
                />
              ),
            },
          ]}
        />
      </section>

      <FormStickyFooter
        onCancel={() => router.back()}
        onSave={() => void handleSave()}
        saveLoading={saving}
        saveDisabled={saving}
        status={combos.length ? `${combos.length} تركيبة` : 'مسودة'}
      />

      <ColorDefinitionModal open={showColors} onClose={() => setShowColors(false)} colors={colors} />
      <SizeDefinitionModal open={showSizes} onClose={() => setShowSizes(false)} sizes={sizes} />
    </div>
  );
}
