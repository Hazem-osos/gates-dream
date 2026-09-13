'use client';

import { useMemo, useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { Paperclip, Upload } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { notifyApiSuccess } from '@/lib/api/api-success-notify';
import {
  archiveAttachment,
  listAttachments,
  uploadAttachmentFile,
} from '@/lib/attachments/api';
import {
  DOCUMENT_CATEGORIES,
  DOCUMENT_CATEGORY_LABEL,
  type AttachmentLinkFilters,
  type DocumentAttachment,
  type DocumentCategory,
} from '@/lib/attachments/types';
import { queryKeys } from '@/lib/query/query-keys';
import { AttachmentChipList } from './AttachmentChipList';
import { AttachmentViewerModal } from './AttachmentViewerModal';

export function AttachmentDropzone({
  links,
  title = 'المرفقات والمستندات',
  defaultCategory = 'GENERAL',
  accept,
}: {
  links: AttachmentLinkFilters;
  title?: string;
  defaultCategory?: DocumentCategory;
  accept?: string;
}) {
  const [category, setCategory] = useState<DocumentCategory>(defaultCategory);
  const [viewer, setViewer] = useState<DocumentAttachment | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const queryKey = useMemo(() => queryKeys.attachments.list(links), [links]);

  const listQ = useQuery({
    queryKey,
    queryFn: () => listAttachments(links),
    enabled: Object.values(links).some(Boolean),
  });

  const uploadMut = useMutation({
    mutationFn: (file: File) => uploadAttachmentFile({ file, fileCategory: category, links }),
    onSuccess: async () => {
      notifyApiSuccess('تم رفع المرفق');
      await listQ.refetch();
    },
  });

  const archiveMut = useMutation({
    mutationFn: (row: DocumentAttachment) => archiveAttachment(row.id),
    onSuccess: async () => {
      notifyApiSuccess('تم أرشفة المرفق');
      await listQ.refetch();
    },
  });

  const onFiles = (files: FileList | null) => {
    const file = files?.[0];
    if (!file) return;
    uploadMut.mutate(file);
  };

  return (
    <section className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="flex items-center gap-2 text-base font-bold text-[#0E79AA]">
          <Paperclip className="h-4 w-4" />
          {title}
        </h3>
        <select
          className="rounded-lg border border-[#D6EAF3] bg-white px-3 py-1.5 text-sm"
          value={category}
          onChange={(event) => setCategory(event.target.value as DocumentCategory)}
        >
          {DOCUMENT_CATEGORIES.map((value) => (
            <option key={value} value={value}>
              {DOCUMENT_CATEGORY_LABEL[value]}
            </option>
          ))}
        </select>
      </div>

      <label
        className={`flex cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed px-4 py-6 text-center transition ${
          dragOver ? 'border-[#0E79AA] bg-[#E8F4FA]' : 'border-[#D6EAF3] bg-[#F6FBFD]'
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
          accept={accept ?? '.pdf,.jpg,.jpeg,.png,.webp,.gif,.dwg,.dxf,.docx,.xlsx,.zip'}
          onChange={(event) => {
            onFiles(event.target.files);
            event.currentTarget.value = '';
          }}
        />
        <Upload className="h-5 w-5 text-[#0E79AA]" />
        <span className="text-sm font-semibold text-[#094C6B]">اسحب الملف هنا أو انقر للرفع</span>
        <span className="text-xs text-slate-500">الرفع يتم عبر رابط موقّت — لا يُحفظ الملف كـ Base64 داخل السجل</span>
        {uploadMut.isPending ? <span className="text-xs text-[#0E79AA]">جاري الرفع…</span> : null}
        {uploadMut.isError ? (
          <span className="text-xs text-red-600">
            {uploadMut.error instanceof Error ? uploadMut.error.message : 'فشل الرفع'}
          </span>
        ) : null}
      </label>

      <AttachmentChipList
        items={listQ.data ?? []}
        onOpen={setViewer}
        onDelete={(row) => archiveMut.mutate(row)}
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
