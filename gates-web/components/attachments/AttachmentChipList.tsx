'use client';

import { FileText, Image as ImageIcon, Trash2 } from 'lucide-react';
import { DOCUMENT_CATEGORY_LABEL, type DocumentAttachment } from '@/lib/attachments/types';
import { formatFileSize } from '@/lib/attachments/api';

export function AttachmentChipList({
  items,
  onOpen,
  onDelete,
}: {
  items: DocumentAttachment[];
  onOpen: (row: DocumentAttachment) => void;
  onDelete?: (row: DocumentAttachment) => void;
}) {
  if (items.length === 0) {
    return <p className="text-sm text-slate-500">لا توجد مرفقات بعد.</p>;
  }

  return (
    <ul className="flex flex-wrap gap-2">
      {items.map((row) => {
        const isImage = row.mimeType.startsWith('image/');
        return (
          <li key={row.id}>
            <button
              type="button"
              onClick={() => onOpen(row)}
              className="inline-flex max-w-[280px] items-center gap-2 rounded-full border border-[#D6EAF3] bg-[#F6FBFD] px-3 py-1.5 text-start text-sm hover:border-[#0E79AA]"
            >
              {isImage ? (
                <ImageIcon className="h-4 w-4 shrink-0 text-[#0E79AA]" />
              ) : (
                <FileText className="h-4 w-4 shrink-0 text-[#0E79AA]" />
              )}
              <span className="min-w-0">
                <span className="block truncate font-semibold text-[#094C6B]">{row.originalFileName}</span>
                <span className="block text-[11px] text-slate-500">
                  {DOCUMENT_CATEGORY_LABEL[row.fileCategory]} · {formatFileSize(row.fileSize)}
                </span>
              </span>
              {onDelete ? (
                <span
                  role="button"
                  tabIndex={0}
                  className="rounded-full p-1 text-slate-400 hover:bg-white hover:text-red-600"
                  onClick={(event) => {
                    event.stopPropagation();
                    onDelete(row);
                  }}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter') {
                      event.stopPropagation();
                      onDelete(row);
                    }
                  }}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </span>
              ) : null}
            </button>
          </li>
        );
      })}
    </ul>
  );
}
