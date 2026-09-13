import { redirect } from 'next/navigation';

export default function PaymentVoucherRedirectPage() {
  redirect('/accounting/operations/treasury/payment-voucher');
}
