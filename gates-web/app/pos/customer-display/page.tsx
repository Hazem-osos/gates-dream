'use client';

import { useEffect, useState } from 'react';
import { formatMoneyAr } from '@/lib/formatMoney';

type DisplayCart = {
  phase?: 'idle' | 'cart' | 'paid';
  lines: Array<{ name: string; quantity: number; total: number; isGift?: boolean }>;
  net: number;
  tax: number;
  discount: number;
  tendered?: number;
  change?: number;
};

const EMPTY: DisplayCart = { phase: 'idle', lines: [], net: 0, tax: 0, discount: 0 };

export default function PosCustomerDisplayPage() {
  const [cart, setCart] = useState<DisplayCart>(EMPTY);

  useEffect(() => {
    const channel = new BroadcastChannel('gates-pos-display');
    channel.onmessage = (event) => setCart({ ...EMPTY, ...(event.data as DisplayCart) });
    return () => channel.close();
  }, []);

  const idle = cart.phase === 'idle' || (cart.lines.length === 0 && cart.phase !== 'paid');

  return (
    <main className="flex min-h-screen flex-col justify-between bg-slate-950 p-8 text-white" dir="rtl">
      <div>
        {idle ? <p className="text-2xl text-slate-400">في انتظار البيع</p> : null}
        {cart.phase === 'paid' ? <p className="mb-4 text-2xl text-emerald-300">تم الدفع</p> : null}
        {cart.lines.map((line, index) => (
          <div key={`${line.name}-${index}`} className="flex justify-between border-b border-slate-800 py-3 text-2xl">
            <span>{line.isGift ? 'هدية · ' : ''}{line.name}</span>
            <span>{line.quantity}</span>
            <span>{formatMoneyAr(line.total)}</span>
          </div>
        ))}
      </div>
      <div className="text-end">
        <p className="text-slate-400">الخصم {formatMoneyAr(cart.discount)} · الضريبة {formatMoneyAr(cart.tax)}</p>
        <p className="text-5xl font-bold">{formatMoneyAr(cart.net)}</p>
        {cart.tendered != null ? <p className="text-xl">المدفوع {formatMoneyAr(cart.tendered)}</p> : null}
        {cart.change ? <p className="text-xl">الباقي {formatMoneyAr(cart.change)}</p> : null}
      </div>
    </main>
  );
}
