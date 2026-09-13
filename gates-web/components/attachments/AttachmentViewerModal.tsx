'use client';

import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { getAttachmentDownloadUrl } from '@/lib/attachments/api';
import { DOCUMENT_CATEGORY_LABEL, type DocumentAttachment } from '@/lib/attachments/types';

export function AttachmentViewerModal({
  attachment,
  onClose,
}: {
  attachment: DocumentAttachment | null;
  onClose: () => void;
}) {
  const [url, setUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!attachment) {
      setUrl(null);
      setError(null);
      return;
    }
    let cancelled = false;
    setUrl(null);
    setError(null);
    void getAttachmentDownloadUrl(attachment.id)
      .then((next) => {
        if (!cancelled) setUrl(next);
      })
      .catch(() => {
        if (!cancelled) setError('تعذر فتح المرفق. تحقق من صلاحية الأرشيف.');
      });
    return () => {
      cancelled = true;
      setUrl((current) => {
        if (current?.startsWith('blob:')) URL.revokeObjectURL(current);
        return null;
      });
    };
  }, [attachment]);

  if (!attachment) return null;

  const isImage = attachment.mimeType.startsWith('image/');
  const isPdf = attachment.mimeType === 'application/pdf';

  return (
    <div className="fixed inset-0 z-[160] flex items-center justify-center bg-black/50 p-4" dir="rtl">
      <div className="flex max-h-[90vh] w-full max-w-3xl flex-col overflow-hidden rounded-xl bg-white shadow-xl">
        <div className="flex items-start justify-between gap-3 border-b border-[#E6F0F7] px-5 py-4">
          <div>
            <h2 className="text-lg font-bold text-[#0E79AA]">{attachment.originalFileName}</h2>
            <p className="text-xs text-slate-500">
              {DOCUMENT_CATEGORY_LABEL[attachment.fileCategory]} · {attachment.mimeType}
            </p>
          </div>
          <Button variant="secondary" onClick={onClose}>
            إغلاق
          </Button>
        </div>
        <div className="min-h-[240px] flex-1 overflow-auto bg-[#F6FBFD] p-4">
          {error ? <p className="text-sm text-red-600">{error}</p> : null}
          {!error && !url ? <p className="text-sm text-slate-500">جاري تجهيز رابط آمن…</p> : null}
          {url && isImage ? (
            // eslint-disable-next-line @next/next/no-img-element -- signed blob URL
            <img src={url} alt={attachment.originalFileName} className="mx-auto max-h-[70vh] rounded-lg object-contain" />
          ) : null}
          {url && isPdf ? <iframe title={attachment.originalFileName} src={url} className="h-[70vh] w-full rounded-lg bg-white" /> : null}
          {url && !isImage && !isPdf ? (
            <div className="rounded-lg bg-white p-6 text-sm text-slate-600">
              لا يمكن معاينة هذا النوع داخل المتصفح.
              <div className="mt-3">
                <a href={url} target="_blank" rel="noreferrer" className="font-semibold text-[#0E79AA]">
                  فتح / تنزيل الملف
                </a>
              </div>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
