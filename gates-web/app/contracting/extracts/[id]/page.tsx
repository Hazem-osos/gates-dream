'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { useApiQuery, useApiMutation, useInvalidateQuery } from '@/lib/hooks/useApi';
import { apiClient } from '@/lib/api/client';
import { ExtractsPageChrome } from '@/components/extracts/ExtractsPageChrome';
import {
  CompactFormField,
  FormSectionCard,
  compactControlClass,
  denseTableWrapClass,
  denseTableClass,
  denseTheadClass,
  denseThClass,
  denseTdClass,
  denseTrClass,
} from '@/components/ui';
import ErrorToast from '@/components/ErrorToast';
import SuccessToast from '@/components/SuccessToast';
import {
  computeExtractPreview,
  fmtMoney,
  type ExtractLineDraft,
} from '@/lib/contracting/computeExtractTotals';
import { InternalNotesScratchpad } from '@/components/documents/InternalNotesScratchpad';
import { WhatsAppShareButton } from '@/components/share/WhatsAppShareButton';
import { buildContractExtractWhatsAppMessage } from '@/lib/whatsapp/messageTemplates';
import type { InternalNoteEntry } from '@/lib/invoices/payment-split.types';
import { printPageContent } from '@/lib/print/printHtml';
import { withItemCodeHierarchy } from '@/lib/contracting/boq-hierarchy';
import { mapExtractContractError, wave3ExtractSaveLines } from '@/lib/contracting/mostakhlasat-contracts';

type ProjectOption = {
  id: string;
  projectCode: string;
  projectName: string;
  customerId?: string | null;
  retentionPercent?: number | string;
  advanceDeductionPercent?: number | string;
  advancePaymentBalance?: number | string;
  customer?: { id: string; arabicName: string };
  subcontracts?: SubcontractOption[];
  costCenter?: { arabicName?: string };
};

type SubcontractOption = {
  subcontractorId: string;
  subcontractor?: { arabicName?: string };
};

type BoqItem = {
  id: string;
  itemNumber: string;
  description: string;
  unit?: string | null;
  contractQuantity: number | string;
  unitPrice: number | string;
};

type ContextPayload = {
  project: ProjectOption;
  boq: BoqItem[];
  previousQuantities: Record<string, number>;
  previousExecutedAmount: number;
  retentionPercent: number;
  advanceDeductionPercent: number;
  maxAdvanceRecovery: number;
  vatRate?: number;
  whtRate?: number;
  subcontract?: { subcontractorId: string; subcontractor?: { arabicName: string } };
};

type ExtractLineApi = {
  boqItemId: string;
  unitPrice: number | string;
  previousQuantity: number | string;
  currentQuantity: number | string;
  boqItem?: {
    itemNumber?: string;
    description?: string;
    unit?: string | null;
    contractQuantity?: number | string;
  };
};

type ContractExtractDetail = {
  projectId: string;
  extractType: 'CLIENT' | 'SUBCONTRACTOR';
  partyId: string;
  extractNumber: string;
  penalties?: number | string;
  internalNotes?: InternalNoteEntry[];
  lines?: ExtractLineApi[];
  status?: string;
};

export default function ContractExtractEditorPage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const router = useRouter();
  const invalidate = useInvalidateQuery();
  const extractId = params.id as string;
  const isNew = extractId === 'new';

  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [projectId, setProjectId] = useState(searchParams.get('projectId') ?? '');
  const [extractType, setExtractType] = useState<'CLIENT' | 'SUBCONTRACTOR'>(
    (searchParams.get('type') as 'CLIENT' | 'SUBCONTRACTOR') || 'CLIENT'
  );
  const [partyId, setPartyId] = useState('');
  const [extractNumber, setExtractNumber] = useState('');
  const [penalties, setPenalties] = useState(0);
  const [lineDrafts, setLineDrafts] = useState<ExtractLineDraft[]>([]);
  const [context, setContext] = useState<ContextPayload | null>(null);
  const [internalNotes, setInternalNotes] = useState<InternalNoteEntry[]>([]);

  const { data: projectsRes } = useApiQuery<ProjectOption[]>(
    ['contracting-projects'],
    '/contracting/projects',
    { limit: 500 }
  );
  const projects = projectsRes?.data ?? [];

  const { data: extractRes } = useApiQuery<ContractExtractDetail>(
    ['contract-extract', extractId],
    `/contracting/extracts/${extractId}`,
    {},
    { enabled: !isNew }
  );

  useEffect(() => {
    if (!isNew && extractRes?.data) {
      const ex = extractRes.data;
      setProjectId(ex.projectId);
      setExtractType(ex.extractType);
      setPartyId(ex.partyId);
      setExtractNumber(ex.extractNumber);
      setPenalties(Number(ex.penalties ?? 0));
      setInternalNotes(Array.isArray(ex.internalNotes) ? ex.internalNotes : []);
      setLineDrafts(
        (ex.lines ?? []).map((l) => ({
          boqItemId: l.boqItemId,
          itemNumber: l.boqItem?.itemNumber ?? '',
          description: l.boqItem?.description ?? '',
          unit: l.boqItem?.unit ?? '',
          contractQuantity: Number(l.boqItem?.contractQuantity ?? 0),
          unitPrice: Number(l.unitPrice),
          previousQuantity: Number(l.previousQuantity),
          currentQuantity: Number(l.currentQuantity),
        }))
      );
    }
  }, [isNew, extractRes?.data]);

  const loadContext = useCallback(async () => {
    if (!projectId || !partyId) return;
    try {
      const res = await apiClient.get<ContextPayload>('/contracting/extracts/context', {
        projectId,
        extractType,
        partyId,
      });
      const ctx = res.data!;
      setContext(ctx);
      if (isNew && !extractNumber) {
        setExtractNumber(`${extractType === 'CLIENT' ? 'CE' : 'SE'}-${Date.now().toString().slice(-6)}`);
      }
      if (isNew && lineDrafts.length === 0 && ctx.boq.length > 0) {
        setLineDrafts(
          ctx.boq.map((b) => ({
            boqItemId: b.id,
            itemNumber: b.itemNumber,
            description: b.description,
            unit: b.unit ?? undefined,
            contractQuantity: Number(b.contractQuantity),
            unitPrice: Number(b.unitPrice),
            previousQuantity: ctx.previousQuantities[b.id] ?? 0,
            currentQuantity: 0,
          }))
        );
      } else if (!isNew && extractRes?.data?.status !== 'POSTED') {
        setLineDrafts((rows) =>
          rows.map((r) => ({
            ...r,
            previousQuantity: ctx.previousQuantities[r.boqItemId] ?? r.previousQuantity,
            unitPrice: Number(ctx.boq.find((b) => b.id === r.boqItemId)?.unitPrice ?? r.unitPrice),
            contractQuantity: Number(
              ctx.boq.find((b) => b.id === r.boqItemId)?.contractQuantity ?? r.contractQuantity
            ),
          }))
        );
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'تعذر تحميل سياق المشروع');
    }
  }, [projectId, partyId, extractType, isNew, extractNumber, lineDrafts.length, extractRes?.data?.status]);

  useEffect(() => {
    void loadContext();
  }, [loadContext]);

  useEffect(() => {
    if (extractType === 'CLIENT' && projectId) {
      const p = projects.find((x) => x.id === projectId);
      if (p?.customerId) setPartyId(p.customerId);
    }
  }, [extractType, projectId, projects]);

  const preview = useMemo(() => {
    if (!context) return null;
    return computeExtractPreview({
      lines: withItemCodeHierarchy(lineDrafts, (row) => row.itemNumber).filter(
        (row) => row.__isExecutable
      ),
      previousExecutedAmount: context.previousExecutedAmount,
      advanceDeductionPercent: context.advanceDeductionPercent,
      retentionPercent: context.retentionPercent,
      vatRate: context.vatRate ?? 0.14,
      whtRate: context.whtRate ?? 0.01,
      penalties,
      maxAdvanceRecovery: context.maxAdvanceRecovery,
      extractType,
    });
  }, [lineDrafts, context, penalties, extractType]);

  const whatsAppExtractMessage = useMemo(
    () =>
      buildContractExtractWhatsAppMessage({
        partyName: context?.project?.customer?.arabicName ?? 'شريكنا',
        extractNumber: extractNumber || '—',
        date: new Date().toLocaleDateString('ar-EG'),
        netPayable: fmtMoney(preview?.netPayableAmount ?? 0),
      }),
    [context?.project?.customer?.arabicName, extractNumber, preview?.netPayableAmount]
  );

  const updateCurrentQty = (boqItemId: string, value: number) => {
    setLineDrafts((rows) =>
      rows.map((r) => (r.boqItemId === boqItemId ? { ...r, currentQuantity: value } : r))
    );
  };

  const saveMutation = useApiMutation<{ id: string }, Record<string, unknown>>(
    isNew ? '/contracting/extracts' : `/contracting/extracts/${extractId}`,
    isNew ? 'POST' : 'PUT',
    { showSuccessToast: false }
  );

  const postMutation = useApiMutation<unknown, Record<string, unknown>>(
    `/contracting/extracts/${extractId}/post`,
    'POST',
    { showSuccessToast: false }
  );

  const handleSave = async () => {
    setError('');
    if (!projectId || !partyId || !extractNumber) {
      setError('المشروع والطرف ورقم المستخلص مطلوبة');
      return;
    }
    try {
      const body = {
        projectId,
        extractType,
        partyId,
        extractNumber,
        penalties,
        internalNotes,
        lines: wave3ExtractSaveLines(lineDrafts),
      };
      const res = await saveMutation.mutateAsync(body);
      setSuccess('تم حفظ المسودة. الكميات السابقة تُعاد من المستخلصات المرحّلة.');
      invalidate(['contract-extracts']);
      invalidate(['contract-extract', extractId]);
      if (isNew && res.data?.id) {
        router.replace(`/contracting/extracts/${res.data.id}`);
      }
    } catch (e) {
      setError(mapExtractContractError(e).message);
    }
  };

  const handlePost = async () => {
    setError('');
    try {
      await postMutation.mutateAsync({});
      setSuccess('تم ترحيل المستخلص إلى الأستاذ العام');
      invalidate(['contract-extract', extractId]);
    } catch (e) {
      setError(mapExtractContractError(e).message);
    }
  };

  const handlePrint = () => {
    void printPageContent(isNew ? 'مستخلص جديد' : `مستخلص ${extractNumber}`);
  };

  const status = extractRes?.data?.status;
  const isPosted = status === 'POSTED';
  const canSave = !isPosted && (isNew || status === 'DRAFT' || !status);
  const canPost = !isNew && (status === 'DRAFT' || status === 'APPROVED');
  const statusLabel =
    status === 'POSTED' ? 'مرحّل' : status === 'APPROVED' ? 'معتمد' : isNew ? 'جديد' : 'مسودة';

  return (
    <ExtractsPageChrome
      title={isNew ? 'مستخلص جديد' : 'مستخلص عقود'}
      breadcrumbs={[
        { href: '/extracts', label: 'المستخلصات' },
        { href: '/contracting/extracts', label: 'مستخلصات العقود' },
        { label: isNew ? 'جديد' : extractNumber || 'مستخلص' },
      ]}
      docNumber={extractNumber || 'جديد'}
      statusLabel={statusLabel}
      onSave={() => void handleSave()}
      savePending={saveMutation.isPending}
      canSave={canSave}
      onNew={undefined}
      currentId={isNew ? null : extractId}
      favoriteHref="/contracting/extracts"
      extraActions={
        <WhatsAppShareButton
          phone={(context?.project?.customer as { mobile?: string } | undefined)?.mobile}
          message={whatsAppExtractMessage}
        />
      }
      moreMenuItems={[
        { id: 'print', label: 'طباعة A4', onClick: handlePrint },
        ...(canPost
          ? [{ id: 'post', label: 'ترحيل', onClick: () => void handlePost() }]
          : []),
      ]}
      browseList={{
        title: 'المستخلصات السابقة',
        apiPath: '/contracting/extracts',
        listKey: 'contract-extracts-browse',
        selectedId: isNew ? null : extractId,
        columns: [
          { id: 'number', header: 'الرقم', getValue: (r) => String(r.extractNumber || r.id) },
          { id: 'status', header: 'الحالة', getValue: (r) => String(r.status || '—') },
        ],
        onSelect: (id) => router.push(`/contracting/extracts/${id}`),
      }}
    >
      {error ? <ErrorToast message={error} onClose={() => setError('')} /> : null}
      {success ? <SuccessToast message={success} onClose={() => setSuccess('')} /> : null}

      {isNew ? (
        <div className="mb-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950">
          إنشاء مستخلص Wave3 (ContractExtract) متوقف للمشاريع Enterprise. افتح{' '}
          <button type="button" className="font-semibold text-[#0E78AA] underline" onClick={() => router.push('/contracting/projects')}>
            مساحة المشروع
          </button>{' '}
          لمستخلص المالك، أو{' '}
          <button type="button" className="font-semibold text-[#0E78AA] underline" onClick={() => router.push('/subcontracts/contracts')}>
            عقود الباطن
          </button>{' '}
          للباطن. الحفظ سيرفضه الخادم إذا كان المشروع Enterprise.
        </div>
      ) : null}

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1fr_320px]" data-print-root="">
        <div>
            <FormSectionCard title="بيانات المستخلص" subtitle="المشروع والطرف ورقم المستند">
              <CompactFormField label="المشروع" required>
                <select
                  className={compactControlClass}
                  value={projectId}
                  onChange={(e) => setProjectId(e.target.value)}
                  disabled={!isNew && !canSave}
                >
                  <option value="">—</option>
                  {projects.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.projectCode} — {p.projectName}
                    </option>
                  ))}
                </select>
              </CompactFormField>
              <CompactFormField label="نوع المستخلص">
                <select
                  className={compactControlClass}
                  value={extractType}
                  onChange={(e) => setExtractType(e.target.value as 'CLIENT' | 'SUBCONTRACTOR')}
                  disabled={!isNew}
                >
                  <option value="CLIENT">عميل</option>
                  <option value="SUBCONTRACTOR">مقاول باطن</option>
                </select>
              </CompactFormField>
              {extractType === 'SUBCONTRACTOR' && context?.project ? (
                <CompactFormField label="مقاول الباطن">
                  <select
                    className={compactControlClass}
                    value={partyId}
                    onChange={(e) => setPartyId(e.target.value)}
                  >
                    <option value="">—</option>
                    {(context.project.subcontracts ?? []).map((s) => (
                      <option key={s.subcontractorId} value={s.subcontractorId}>
                        {s.subcontractor?.arabicName ?? s.subcontractorId}
                      </option>
                    ))}
                  </select>
                </CompactFormField>
              ) : null}
              <CompactFormField
                label="رقم المستخلص"
                value={extractNumber}
                onChange={(e) => setExtractNumber(e.target.value)}
                disabled={!canSave}
              />
            </FormSectionCard>

            <InternalNotesScratchpad notes={internalNotes} onChange={setInternalNotes} disabled={status === 'POSTED'} />

            {context?.project && (
              <div className="text-sm text-gray-700 mb-3 bg-white border rounded-lg p-3">
                <div>
                  العميل: {context.project.customer?.arabicName ?? '—'} | مركز التكلفة:{' '}
                  {context.project.costCenter?.arabicName ?? '—'}
                </div>
                <div>
                  تأمين: {context.retentionPercent}% | استنزال دفعة مقدمة:{' '}
                  {context.advanceDeductionPercent}% | رصيد دفعة مقدمة:{' '}
                  {fmtMoney(context.maxAdvanceRecovery)}
                </div>
              </div>
            )}

            <div className={denseTableWrapClass}>
              <table className={denseTableClass}>
                <thead className={denseTheadClass}>
                  <tr>
                    <th className={denseThClass}>كود البند</th>
                    <th className={denseThClass}>بيان الأعمال</th>
                    <th className={denseThClass}>الوحدة</th>
                    <th className={denseThClass}>سعر الفئة</th>
                    <th className={denseThClass}>كمية سابقة</th>
                    <th className={denseThClass}>كمية حالية</th>
                    <th className={denseThClass}>كمية إجمالية</th>
                    <th className={denseThClass}>% إنجاز</th>
                    <th className={denseThClass}>إجمالي القيمة</th>
                  </tr>
                </thead>
                <tbody>
                  {withItemCodeHierarchy(lineDrafts, (row) => row.itemNumber).map((line) => {
                    const cum = line.previousQuantity + line.currentQuantity;
                    const lineTotal = line.currentQuantity * line.unitPrice;
                    const pct =
                      line.contractQuantity > 0
                        ? Math.min(100, (cum / line.contractQuantity) * 100)
                        : 0;
                    return (
                      <tr key={line.boqItemId} className={denseTrClass}>
                        <td className={denseTdClass}>
                          {line.itemNumber}
                          {line.__isParent ? (
                            <span className="mr-1 text-[10px] text-[#0E78AA]"> رئيسي</span>
                          ) : null}
                        </td>
                        <td className={denseTdClass}>{line.description}</td>
                        <td className={denseTdClass}>{line.unit ?? '—'}</td>
                        <td className={denseTdClass}>
                          {line.__isParent ? '—' : fmtMoney(line.unitPrice)}
                        </td>
                        <td className={denseTdClass}>
                          {line.__isParent ? '—' : line.previousQuantity}
                        </td>
                        <td className={denseTdClass}>
                          {line.__isParent ? (
                            '—'
                          ) : (
                            <input
                              type="number"
                              min={0}
                              step="0.0001"
                              className={compactControlClass}
                              value={line.currentQuantity || ''}
                              onChange={(e) =>
                                updateCurrentQty(line.boqItemId, Number(e.target.value) || 0)
                              }
                              disabled={!canSave}
                            />
                          )}
                        </td>
                        <td className={denseTdClass}>
                          {line.__isParent ? '—' : cum.toLocaleString()}
                        </td>
                        <td className={denseTdClass}>
                          {line.__isParent ? '—' : `${pct.toLocaleString()}%`}
                        </td>
                        <td className={`${denseTdClass} font-medium`}>
                          {line.__isParent ? '—' : fmtMoney(lineTotal)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
        </div>

        <aside className="print:hidden">
          <div className="sticky top-4 space-y-3 rounded-xl border border-[#E6F0F7] bg-white p-4 text-sm">
            <h2 className="font-bold text-[#0A3D5E]">
              {isPosted ? 'ملخص مرحّل' : 'معاينة محلية — ليست مبلغاً مرحّلاً'}
            </h2>
            {!isPosted ? (
              <p className="text-[11px] text-slate-500">
                الكميات السابقة من المستخلصات المرحّلة فقط. الإجمالي النهائي يُحسب على السيرفر عند الحفظ.
              </p>
            ) : null}
            {preview ? (
              <>
                <Row label="إجمالي سابق" value={fmtMoney(preview.previousExecutedAmount)} />
                <Row label="أعمال الفترة الحالية" value={fmtMoney(preview.currentExecutedAmount)} />
                <Row label="إجمالي تراكمي" value={fmtMoney(preview.totalExecutedAmount)} />
                <hr />
                <Row label="استنزال دفعة مقدمة" value={fmtMoney(preview.advancePaymentDeduction)} />
                <Row label="تأمين أعمال" value={fmtMoney(preview.retentionDeduction)} />
                <Row label="خصم أ.ت.ص" value={fmtMoney(preview.whtDeduction)} />
                <label className="block">
                  غرامات / فروق
                  <input
                    type="number"
                    className={`${compactControlClass} mt-1`}
                    value={penalties || ''}
                    onChange={(e) => setPenalties(Number(e.target.value) || 0)}
                    disabled={!canSave}
                  />
                </label>
                <Row label="صافي قبل الضريبة" value={fmtMoney(preview.netBeforeVat)} />
                <Row label="ضريبة القيمة المضافة" value={fmtMoney(preview.vatAmount)} />
                <Row label="الصافي المستحق" value={fmtMoney(preview.netPayableAmount)} bold />
              </>
            ) : (
              <p className="text-slate-500">اختر مشروعاً لعرض الحسابات</p>
            )}
          </div>
        </aside>
      </div>
    </ExtractsPageChrome>
  );
}

function Row({ label, value, bold }: { label: string; value: string; bold?: boolean }) {
  return (
    <div className={`flex justify-between gap-2 ${bold ? 'font-bold text-[#0E78AA]' : ''}`}>
      <span>{label}</span>
      <span>{value}</span>
    </div>
  );
}
