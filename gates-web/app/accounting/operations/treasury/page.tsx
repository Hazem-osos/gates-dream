"use client";

import Link from "next/link";
import { useMemo } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useBackendReachability } from "@/lib/hooks/useBackendReachability";
import {
  treasuryHubFilterSchema,
  type TreasuryHubFilterInput,
} from "@/lib/validation/accounting.schema";

const links = [
  { href: "/accounting/orders/payment-order/new", label: "أمر صرف نقدية" },
  { href: "/accounting/orders/receipt-order/new", label: "أمر توريد نقدية" },
  { href: "/accounting/operations/treasury/payment-voucher", label: "سند صرف نقدية" },
  { href: "/accounting/operations/treasury/receipt-voucher", label: "سند قبض نقدية" },
  { href: "/accounting/operations/treasury/temp-receipt", label: "إيصال مؤقت" },
];

export default function TreasuryHubPage() {
  useBackendReachability();

  const { register, watch } = useForm<TreasuryHubFilterInput>({
    resolver: zodResolver(treasuryHubFilterSchema),
    defaultValues: { query: "" },
    mode: "onChange",
  });

  const q = (watch("query") || "").trim().toLowerCase();

  const filtered = useMemo(() => {
    if (!q) return links;
    return links.filter((l) => l.label.toLowerCase().includes(q));
  }, [q]);

  return (
    <div className="min-h-screen p-6" style={{ direction: "rtl" }}>
      <h1 className="text-xl font-bold text-[#0E78AA] mb-4">عمليات الخزينة</h1>
      <p className="text-[#094C6B] mb-4">اختر العملية:</p>
      <div className="mb-6 max-w-md">
        <label htmlFor="treasury-hub-search" className="block text-sm text-[#094C6B] mb-1">
          تصفية القائمة
        </label>
        <input
          id="treasury-hub-search"
          type="search"
          placeholder="ابحث باسم العملية…"
          className="w-full rounded-lg border border-[#D6EAF3] bg-[#F6FBFD] px-3 py-2 text-[#094C6B] focus:border-[#0E78AA] focus:outline-none"
          {...register("query")}
        />
      </div>
      <ul className="flex flex-col gap-3 max-w-md">
        {filtered.map((l) => (
          <li key={l.href}>
            <Link
              href={l.href}
              className="block rounded-lg border border-[#0E78AA] px-4 py-3 text-[#0E78AA] hover:bg-[#EAF6FB]"
            >
              {l.label}
            </Link>
          </li>
        ))}
      </ul>
      {filtered.length === 0 && (
        <p className="text-gray-500 text-sm mt-4">لا توجد عمليات تطابق البحث.</p>
      )}
    </div>
  );
}
