'use client';

import { useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { MessageSquare, MoreHorizontal, Receipt } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { SimpleDropdownMenu } from '@/components/inventory/SimpleDropdownMenu';
import { useOptionalDocumentMode } from './DocumentModeContext';
import {
  openInvoiceWhatsApp,
  type WhatsAppInvoicePayload,
} from '@/lib/whatsapp-share';

export type DocumentActionExtraItem = {
  id: string;
  label: string;
  onClick: () => void;
  disabled?: boolean;
  destructive?: boolean;
  hint?: string;
};

export type DocumentActionMenuProps = {
  hasDocument: boolean;
  isPosted?: boolean;
  isCancelled?: boolean;
  onNew?: () => void;
  newLabel?: string;
  newDisabled?: boolean;
  newHint?: string;
  onEdit?: () => void;
  onPost?: () => void;
  onUnpost?: () => void;
  onUnapprove?: () => void;
  isApproved?: boolean;
  onPrint?: () => void;
  onThermalPrint?: () => void;
  onDuplicate?: () => void;
  onVoid?: () => void;
  onRestore?: () => void;
  extraItems?: DocumentActionExtraItem[];
  whatsAppShare?: WhatsAppInvoicePayload | null;
  postPending?: boolean;
  unpostPending?: boolean;
  duplicatePending?: boolean;
  voidPending?: boolean;
  restorePending?: boolean;
  /** Hide ترحيل / فك الترحيل from the 3-dots menu. */
  hidePostActions?: boolean;
  /** Keep تعديل enabled on posted docs (in-place journal update on save). */
  allowEditWhenPosted?: boolean;
  printLabel?: string;
  voidLabel?: string;
  restoreLabel?: string;
  duplicateLabel?: string;
  editLockedHint?: string;
  voidLockedHint?: string;
};

export function DocumentActionMenu({
  hasDocument,
  isPosted = false,
  isCancelled = false,
  onNew,
  newLabel,
  newDisabled,
  newHint,
  onEdit,
  onPost,
  onUnpost,
  onUnapprove,
  isApproved = false,
  onPrint,
  onThermalPrint,
  onDuplicate,
  onVoid,
  onRestore,
  extraItems = [],
  whatsAppShare,
  postPending,
  unpostPending,
  duplicatePending,
  voidPending,
  restorePending,
  hidePostActions = false,
  allowEditWhenPosted = false,
  printLabel,
  voidLabel,
  restoreLabel,
  duplicateLabel,
  editLockedHint,
  voidLockedHint,
}: DocumentActionMenuProps) {
  const mode = useOptionalDocumentMode();
  const isReadOnly = mode?.isReadOnly ?? false;
  const router = useRouter();
  const pathname = usePathname();
  const startNewDocument = () => {
    if (onNew) {
      onNew();
      return;
    }
    router.replace(pathname);
  };
  const [confirm, setConfirm] = useState<'unpost' | 'void' | 'restore' | null>(null);
  const [phoneDialogOpen, setPhoneDialogOpen] = useState(false);
  const [manualPhone, setManualPhone] = useState('');

  const handleWhatsAppShare = () => {
    if (!whatsAppShare) return;
    if (whatsAppShare.customerPhone?.replace(/[^0-9]/g, '')) {
      openInvoiceWhatsApp(whatsAppShare);
      return;
    }
    setManualPhone('');
    setPhoneDialogOpen(true);
  };

  const lockEditWhenPosted = isPosted && !hidePostActions && !allowEditWhenPosted;
  const editDisabled = !hasDocument || isCancelled || lockEditWhenPosted || !onEdit;
  const editHint = isCancelled
    ? 'المستند ملغي ولا يمكن تعديله'
    : lockEditWhenPosted
      ? editLockedHint ?? 'المستند مرحل ومثبت محاسبياً. فك الترحيل أولاً من قائمة (...)'
      : undefined;

  const items = [
    {
      id: 'new',
      label: newLabel ?? 'جديد',
      disabled: Boolean(newDisabled),
      hint: newDisabled
        ? newHint ?? 'احذف المستند الحالي أولاً حتى يمكن إنشاء مستند جديد'
        : undefined,
      onClick: startNewDocument,
    },
    {
      id: 'edit',
      label: 'تعديل',
      disabled: editDisabled || !onEdit,
      hint: editHint,
      onClick: () => onEdit?.(),
    },
    ...(hidePostActions
      ? []
      : [
          {
            id: 'post',
            label: postPending ? 'جاري الترحيل…' : 'ترحيل',
            disabled: !hasDocument || isPosted || isCancelled || !onPost || postPending,
            onClick: () => onPost?.(),
          },
        ]),
    ...(onUnapprove
      ? [
          {
            id: 'unapprove',
            label: 'إلغاء الاعتماد',
            disabled: !hasDocument || isCancelled || !isApproved,
            hint:
              !isApproved && !isCancelled
                ? 'القيد غير معتمد'
                : undefined,
            onClick: () => onUnapprove(),
          },
        ]
      : []),
    ...(hidePostActions || !onUnpost
      ? []
      : [
          {
            id: 'unpost',
            label: unpostPending ? 'جاري فك الترحيل…' : 'فك الترحيل',
            disabled: !hasDocument || !isPosted || isCancelled || unpostPending,
            onClick: () => setConfirm('unpost'),
          },
        ]),
    {
      id: 'print',
      label: printLabel ?? (hidePostActions ? 'طباعة السند' : 'طباعة المستند'),
      disabled: !hasDocument || !onPrint,
      onClick: () => onPrint?.(),
    },
    ...(onThermalPrint
      ? [
          {
            id: 'thermal-print',
            label: 'طباعة إيصال حراري (بلوتوث)',
            disabled: !hasDocument,
            onClick: () => onThermalPrint(),
            icon: <Receipt className="h-4 w-4" />,
          },
        ]
      : []),
    ...(whatsAppShare && hasDocument
      ? [
          {
            id: 'whatsapp',
            label: 'إرسال عبر الواتساب',
            disabled: false,
            onClick: handleWhatsAppShare,
            icon: <MessageSquare className="h-4 w-4 text-emerald-500" />,
          },
        ]
      : []),
    ...(onDuplicate
      ? [
          {
            id: 'duplicate',
            label:
              duplicatePending
                ? 'جاري التكرار…'
                : duplicateLabel ?? (hidePostActions ? 'تكرار' : 'تكرار المستند'),
            disabled: !hasDocument || duplicatePending,
            onClick: () => onDuplicate(),
          },
        ]
      : []),
    ...extraItems,
    ...(isCancelled && onRestore
      ? [
          {
            id: 'restore',
            label: restorePending ? 'جاري الاستعادة…' : restoreLabel ?? 'استعادة القيد',
            disabled: !hasDocument || restorePending,
            onClick: () => setConfirm('restore'),
          },
        ]
      : []),
    {
      id: 'void',
      label:
        voidPending
          ? 'جاري الإلغاء…'
          : voidLabel ?? (hidePostActions ? 'إلغاء' : 'إلغاء / حذف المستند'),
      disabled: !hasDocument || isCancelled || isPosted || !onVoid || voidPending,
      hint: isPosted
        ? voidLockedHint ??
          (hidePostActions
            ? 'المستند مكتمل ولا يمكن إلغاؤه'
            : 'المستند مرحل. فك الترحيل أولاً ثم ألغه')
        : undefined,
      destructive: true,
      onClick: () => setConfirm('void'),
    },
  ];

  return (
    <>
      <SimpleDropdownMenu
        align="right"
        trigger={
          <Button variant="ghost" size="sm" aria-label="قائمة الإجراءات" data-tour="three-dots-menu">
            <MoreHorizontal className="h-5 w-5" />
          </Button>
        }
        items={items}
      />
      {phoneDialogOpen ? (
        <div className="fixed inset-0 z-[80] flex items-center justify-center bg-slate-900/40 px-4" dir="rtl">
          <div className="w-full max-w-sm rounded-2xl border border-emerald-200 bg-white p-5 shadow-xl">
            <h2 className="text-base font-bold text-[#0A3D5E]">رقم واتساب المستلم</h2>
            <p className="mt-2 text-sm leading-6 text-slate-600">
              لا يوجد رقم هاتف مسجّل على هذا العميل. أدخل رقم الجوال ثم افتح واتساب.
            </p>
            <input
              type="tel"
              inputMode="tel"
              autoFocus
              value={manualPhone}
              onChange={(e) => setManualPhone(e.target.value)}
              placeholder="01xxxxxxxxx"
              className="mt-3 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-emerald-400"
            />
            <div className="mt-5 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setPhoneDialogOpen(false)}
                className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50"
              >
                إلغاء
              </button>
              <button
                type="button"
                disabled={!manualPhone.replace(/[^0-9]/g, '')}
                onClick={() => {
                  if (!whatsAppShare) return;
                  openInvoiceWhatsApp({ ...whatsAppShare, customerPhone: manualPhone });
                  setPhoneDialogOpen(false);
                }}
                className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-50"
              >
                فتح واتساب
              </button>
            </div>
          </div>
        </div>
      ) : null}
      {confirm ? (
        <div className="fixed inset-0 z-[80] flex items-center justify-center bg-slate-900/40 px-4" dir="rtl">
          <div className="w-full max-w-md rounded-2xl border border-[#D6EAF3] bg-white p-5 shadow-xl">
            <h2 className="text-base font-bold text-[#0A3D5E]">
              {confirm === 'unpost'
                ? 'فك ترحيل المستند'
                : confirm === 'restore'
                  ? 'استعادة المستند'
                  : 'إلغاء المستند'}
            </h2>
            <p className="mt-2 text-sm leading-6 text-slate-600">
              {confirm === 'unpost'
                ? 'سيتم فك الترحيل وإعادة المستند إلى غير مرحل حتى يمكن تعديله أو حذفه. هل تريد المتابعة؟'
                : confirm === 'restore'
                  ? 'سيتم استعادة القيد الملغي وترحيله من جديد. هل تريد المتابعة؟'
                  : 'سيتم إلغاء هذا المستند مع الإبقاء عليه بحالة ملغي. يمكن استعادته لاحقاً. هل تريد المتابعة؟'}
            </p>
            <div className="mt-5 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setConfirm(null)}
                className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50"
              >
                رجوع
              </button>
              <button
                type="button"
                onClick={() => {
                  if (confirm === 'unpost') onUnpost?.();
                  else if (confirm === 'restore') onRestore?.();
                  else onVoid?.();
                  setConfirm(null);
                }}
                className={`rounded-lg px-4 py-2 text-sm font-semibold text-white ${
                  confirm === 'void' ? 'bg-red-600 hover:bg-red-700' : 'bg-[#0E79AA] hover:bg-[#0c6a96]'
                }`}
              >
                تأكيد
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
