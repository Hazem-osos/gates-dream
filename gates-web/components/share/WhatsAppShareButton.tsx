'use client';

import { useState } from 'react';
import { MessageCircle } from 'lucide-react';
import { toast } from '@/lib/feedback/toast';
import {
  createInvoiceWhatsAppShare,
  createStatementWhatsAppShare,
  openWhatsAppShare,
} from '@/lib/share/whatsapp-share';

type InvoiceProps = { kind: 'invoice'; invoiceId: string; className?: string };
type StatementProps = {
  kind: 'statement';
  customerId?: string;
  supplierId?: string;
  className?: string;
};
type DirectProps = { phone?: string | null; message: string; className?: string };
type Props = InvoiceProps | StatementProps | DirectProps;

function isDirect(props: Props): props is DirectProps {
  return 'message' in props;
}

function egyptWaLink(phone: string | null | undefined, text: string) {
  const digits = (phone || '').replace(/\D/g, '');
  const intl = digits.startsWith('20')
    ? digits
    : digits.startsWith('0')
      ? `20${digits.slice(1)}`
      : digits;
  return intl
    ? `https://wa.me/${intl}?text=${encodeURIComponent(text)}`
    : `https://wa.me/?text=${encodeURIComponent(text)}`;
}

export function WhatsAppShareButton(props: Props) {
  const [busy, setBusy] = useState(false);
  const disabled = isDirect(props)
    ? !props.message.trim()
    : props.kind === 'invoice'
      ? !props.invoiceId
      : !props.customerId && !props.supplierId;

  return (
    <button
      type="button"
      disabled={disabled || busy}
      className={
        props.className ??
        'inline-flex items-center gap-1.5 rounded-lg border border-emerald-200 bg-emerald-50 px-2.5 py-1.5 text-xs font-bold text-emerald-800 hover:bg-emerald-100 disabled:opacity-50'
      }
      onClick={() => {
        void (async () => {
          if (isDirect(props)) {
            window.open(egyptWaLink(props.phone, props.message), '_blank', 'noopener,noreferrer');
            return;
          }
          setBusy(true);
          try {
            const result =
              props.kind === 'invoice'
                ? await createInvoiceWhatsAppShare(props.invoiceId)
                : await createStatementWhatsAppShare({
                    customerId: props.customerId,
                    supplierId: props.supplierId,
                  });
            openWhatsAppShare(result);
          } catch (error) {
            toast.error(error instanceof Error ? error.message : 'تعذر فتح واتساب');
          } finally {
            setBusy(false);
          }
        })();
      }}
    >
      <MessageCircle className="h-3.5 w-3.5" />
      {busy ? 'جاري التجهيز…' : 'مشاركة واتساب'}
    </button>
  );
}
