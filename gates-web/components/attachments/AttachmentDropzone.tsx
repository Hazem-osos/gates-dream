'use client';

import { useMemo, useState, useEffect } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { Paperclip, ScanLine, Upload } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { notifyApiSuccess } from '@/lib/api/api-success-notify';
import { deleteAttachment, listAttachments, uploadAttachmentFile } from '@/lib/attachments/api';
import type {
  AttachmentLinkFilters,
  DocumentAttachment,
  DocumentCategory,
} from '@/lib/attachments/types';
import { queryKeys } from '@/lib/query/query-keys';
import { AttachmentChipList } from './AttachmentChipList';
import { AttachmentViewerModal } from './AttachmentViewerModal';

export function AttachmentDropzone({
  links,
  title = 'المرفقات والمستندات',
  accept,
  defaultCategory = 'GENERAL',
}: {
  links: AttachmentLinkFilters;
  title?: string;
  accept?: string;
  defaultCategory?: DocumentCategory;
}) {
  const [viewer, setViewer] = useState<DocumentAttachment | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [mobileCapture, setMobileCapture] = useState(false);
  useEffect(() => {
    setMobileCapture(/Android|iPhone|iPad|iPod/i.test(navigator.userAgent));
  }, []);
  const queryKey = useMemo(() => queryKeys.attachments.list(links), [links]);

  const listQ = useQuery({
    queryKey,
    queryFn: () => listAttachments(links),
    enabled: Object.values(links).some(Boolean),
  });

  const uploadMut = useMutation({
    mutationFn: (file: File) =>
      uploadAttachmentFile({ file, fileCategory: defaultCategory, links }),
    onSuccess: async () => {
      notifyApiSuccess('تم رفع المرفق');
      await listQ.refetch();
    },
  });

  const deleteMut = useMutation({
    mutationFn: (id: string) => deleteAttachment(id),
    onSuccess: async () => {
      notifyApiSuccess('تم حذف المرفق');
      await listQ.refetch();
    },
  });

  const onFiles = (files: FileList | null) => {
    const file = files?.[0];
    if (!file) return;
    uploadMut.mutate(file);
  };

  const handleDelete = (row: DocumentAttachment) => {
    if (!window.confirm(`حذف «${row.originalFileName}»؟`)) return;
    deleteMut.mutate(row.id);
  };

  const browseAccept =
    accept ?? '.pdf,.jpg,.jpeg,.png,.webp,.gif,.dwg,.dxf,.docx,.xlsx,.zip';

  return (
    <section className="space-y-3">
      <h3 className="flex items-center gap-2 text-base font-bold text-[#0E78AA]">
        <Paperclip className="h-4 w-4" />
        {title}
      </h3>
      <p className="text-xs text-slate-500">نوع المرفق: عام</p>

      <div className="flex flex-wrap gap-2">
        <label className="inline-flex cursor-pointer items-center gap-2 rounded-lg border border-[#0E78AA] bg-[#0E78AA] px-3 py-2 text-sm font-semibold text-white">
          <ScanLine className="h-4 w-4" />
          مسح ضوئي
          <input
            type="file"
            className="sr-only"
            accept="image/*,application/pdf"
            {...(mobileCapture ? { capture: 'environment' as const } : {})}
            onChange={(event) => {
              onFiles(event.target.files);
              event.currentTarget.value = '';
            }}
          />
        </label>
      </div>

      <label
        className={`flex cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed px-4 py-6 text-center transition ${
          dragOver ? 'border-[#0E78AA] bg-[#E8F4FA]' : 'border-[#D6EAF3] bg-[#F6FBFD]'
        }`}
        onDragOver={(event) => {
          event.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(event) => {
          event.preventDefault();
          setDragOver(false);
          onFiles(event.dataTransfer.files);
        }}
      >
        <input
          type="file"
          className="sr-only"
          accept={browseAccept}
          onChange={(event) => {
            onFiles(event.target.files);
            event.currentTarget.value = '';
          }}
        />
        <Upload className="h-5 w-5 text-[#0E78AA]" />
        <span className="text-sm font-semibold text-[#094C6B]">اسحب الملف هنا أو انقر للرفع</span>
        {uploadMut.isPending ? <span className="text-xs text-[#0E78AA]">جاري الرفع…</span> : null}
        {uploadMut.isError ? (
          <span className="text-xs text-red-600">
            {uploadMut.error instanceof Error ? uploadMut.error.message : 'فشل الرفع'}
          </span>
        ) : null}
      </label>

      <AttachmentChipList
        items={listQ.data ?? []}
        onOpen={setViewer}
        onDelete={handleDelete}
      />

      {listQ.isError ? (
        <p className="text-xs text-red-600">تعذر تحميل المرفقات. تأكد من صلاحية الأرشيف.</p>
      ) : null}

      <AttachmentViewerModal attachment={viewer} onClose={() => setViewer(null)} />
    </section>
  );
}

export function AttachmentDropzoneActions({ onPick }: { onPick?: () => void }) {
  return (
    <Button type="button" variant="secondary" size="sm" onClick={onPick} iconStart={<Paperclip className="h-4 w-4" />}>
      مرفقات
    </Button>
  );
}
