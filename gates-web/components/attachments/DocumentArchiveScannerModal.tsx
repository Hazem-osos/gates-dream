'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { FolderOpen, ScanLine, Trash2, Upload } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { notifyApiSuccess } from '@/lib/api/api-success-notify';
import { deleteAttachment, listAttachments, uploadAttachmentFile } from '@/lib/attachments/api';
import type { DocumentAttachment } from '@/lib/attachments/types';
import type { ArchiveEntityTarget } from '@/lib/attachments/archive-entity';
import { queryKeys } from '@/lib/query/query-keys';
import { AttachmentChipList } from './AttachmentChipList';
import { AttachmentViewerModal } from './AttachmentViewerModal';

const BROWSE_ACCEPT =
  '.pdf,.jpg,.jpeg,.png,.webp,.gif,.dwg,.dxf,.docx,.xlsx,.xls,.doc,.zip,application/pdf,image/*';
const SCANNER_ACCEPT = 'image/*,application/pdf';

function scannerInputCapture(): 'environment' | undefined {
  if (typeof navigator === 'undefined') return undefined;
  return /Android|iPhone|iPad|iPod/i.test(navigator.userAgent) ? 'environment' : undefined;
}

type PendingRow = {
  key: string;
  file: File;
};

export function DocumentArchiveScannerModal({
  open,
  onClose,
  target,
  title = 'أرشفة المستندات',
}: {
  open: boolean;
  onClose: () => void;
  target: ArchiveEntityTarget | null;
  title?: string;
}) {
  const queryClient = useQueryClient();
  const [pending, setPending] = useState<PendingRow[]>([]);
  const [viewer, setViewer] = useState<DocumentAttachment | null>(null);

  const linkFilters = useMemo(
    () =>
      target
        ? { entityType: target.entityType, entityId: target.entityId }
        : {},
    [target]
  );

  const listKey = useMemo(() => queryKeys.attachments.list(linkFilters), [linkFilters]);

  const listQ = useQuery({
    queryKey: listKey,
    queryFn: () => listAttachments(linkFilters),
    enabled: open && Boolean(target?.entityId),
  });

  useEffect(() => {
    if (!open) {
      setPending([]);
      setViewer(null);
    }
  }, [open]);

  const uploadMut = useMutation({
    mutationFn: async (rows: PendingRow[]) => {
      if (!target) throw new Error('لا يوجد مستند محفوظ للأرشفة');
      for (const row of rows) {
        await uploadAttachmentFile({
          file: row.file,
          fileCategory: 'GENERAL',
          links: linkFilters,
          displayFileName: row.file.name,
        });
      }
    },
    onSuccess: async () => {
      notifyApiSuccess('تم رفع المرفقات إلى الأرشيف');
      setPending([]);
      await queryClient.invalidateQueries({ queryKey: listKey });
      await listQ.refetch();
    },
  });

  const deleteMut = useMutation({
    mutationFn: (id: string) => deleteAttachment(id),
    onSuccess: async () => {
      notifyApiSuccess('تم حذف المرفق');
      await queryClient.invalidateQueries({ queryKey: listKey });
      await listQ.refetch();
    },
  });

  const addFiles = useCallback((files: FileList | null) => {
    if (!files?.length) return;
    const next: PendingRow[] = [];
    for (const file of Array.from(files)) {
      next.push({
        key: `${file.name}-${file.size}-${file.lastModified}-${Math.random()}`,
        file,
      });
    }
    setPending((prev) => [...prev, ...next]);
  }, []);

  const handleDeleteSaved = (row: DocumentAttachment) => {
    const ok = window.confirm(`حذف «${row.originalFileName}» من الأرشيف؟`);
    if (!ok) return;
    deleteMut.mutate(row.id);
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[150] flex items-center justify-center bg-black/45 p-4" dir="rtl">
      <div className="flex max-h-[92vh] w-full max-w-3xl flex-col overflow-hidden rounded-2xl border border-[#D6EAF3] bg-white shadow-xl">
        <div className="flex items-start justify-between gap-3 border-b border-[#E6F0F7] px-5 py-4">
          <div>
            <h2 className="flex items-center gap-2 text-lg font-bold text-[#0E78AA]">
              <ScanLine className="h-5 w-5" />
              {title}
            </h2>
            <p className="mt-1 text-xs text-slate-500">
              المرفقات من نوع <strong>عام</strong>. استخدم الماسح الضوئي أو اختر ملفات من الجهاز، ثم يمكنك حذف أي
              مرفق بعد الرفع.
            </p>
          </div>
          <Button variant="secondary" size="sm" onClick={onClose}>إغلاق</Button>
        </div>

        {!target ? (
          <div className="px-5 py-8 text-center text-sm text-amber-800">
            احفظ المستند أو البطاقة أولاً ثم افتح الأرشيف من قائمة (⋯).
          </div>
        ) : (
          <div className="flex-1 space-y-4 overflow-y-auto px-5 py-4">
            <div className="flex flex-wrap gap-2">
              <label className="inline-flex cursor-pointer items-center gap-2 rounded-xl border border-[#0E78AA] bg-[#0E78AA] px-4 py-2 text-sm font-semibold text-white hover:opacity-95">
                <ScanLine className="h-4 w-4" />
                مسح ضوئي
                <input
                  type="file"
                  multiple
                  className="sr-only"
                  accept={SCANNER_ACCEPT}
                  {...(scannerInputCapture() ? { capture: scannerInputCapture() } : {})}
                  onChange={(e) => {
                    addFiles(e.target.files);
                    e.currentTarget.value = '';
                  }}
                />
              </label>
              <label className="inline-flex cursor-pointer items-center gap-2 rounded-xl border border-[#0E78AA] bg-[#E8F4FA] px-4 py-2 text-sm font-semibold text-[#0E78AA]">
                <FolderOpen className="h-4 w-4" />
                تصفح من الجهاز
                <input
                  type="file"
                  multiple
                  className="sr-only"
                  accept={BROWSE_ACCEPT}
                  onChange={(e) => {
                    addFiles(e.target.files);
                    e.currentTarget.value = '';
                  }}
                />
              </label>
            </div>

            {pending.length > 0 ? (
              <div className="space-y-2 rounded-xl border border-[#E6F0F7] bg-[#F8FBFD] p-3">
                <p className="text-sm font-semibold text-[#0A3D5E]">ملفات جاهزة للرفع ({pending.length})</p>
                <ul className="space-y-2">
                  {pending.map((row) => (
                    <li
                      key={row.key}
                      className="flex items-center justify-between gap-2 rounded-lg border border-white bg-white px-3 py-2 text-sm"
                    >
                      <span className="min-w-0 truncate font-medium text-[#094C6B]">{row.file.name}</span>
                      <button
                        type="button"
                        className="shrink-0 rounded-lg p-2 text-slate-400 hover:bg-red-50 hover:text-red-600"
                        onClick={() => setPending((prev) => prev.filter((p) => p.key !== row.key))}
                        title="إزالة من القائمة"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </li>
                  ))}
                </ul>
                <Button
                  type="button"
                  variant="primary"
                  size="sm"
                  isLoading={uploadMut.isPending}
                  iconStart={<Upload className="h-4 w-4" />}
                  onClick={() => uploadMut.mutate(pending)}
                >
                  رفع إلى الأرشيف
                </Button>
              </div>
            ) : null}

            <div>
              <p className="mb-2 text-sm font-semibold text-[#0A3D5E]">المرفقات المحفوظة</p>
              <AttachmentChipList
                items={listQ.data ?? []}
                onOpen={setViewer}
                onDelete={handleDeleteSaved}
              />
            </div>
          </div>
        )}

        <AttachmentViewerModal attachment={viewer} onClose={() => setViewer(null)} />
      </div>
    </div>
  );
}
