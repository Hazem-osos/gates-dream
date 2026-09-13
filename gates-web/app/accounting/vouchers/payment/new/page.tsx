import { redirect } from 'next/navigation';

export default function PaymentVoucherNewRedirectPage() {
  redirect('/accounting/operations/treasury/payment-voucher');
}
