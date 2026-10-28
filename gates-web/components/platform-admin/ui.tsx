'use client';

import { useEffect, type ButtonHTMLAttributes, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes } from 'react';
import { Loader2, X, ChevronRight, ChevronLeft, Inbox } from 'lucide-react';
import type { Tone } from '@/lib/platform-admin/format';

export function cx(...parts: Array<string | false | null | undefined>): string {
  return parts.filter(Boolean).join(' ');
}

export function Card({ children, className, title, actions, subtitle }: {
  children: ReactNode;
  className?: string;
  title?: ReactNode;
  subtitle?: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <section className={cx('rounded-2xl border border-[#E3EEF4] bg-white shadow-[0_1px_2px_rgba(10,61,94,0.04)]', className)}>
      {(title || actions) && (
        <header className="flex flex-wrap items-center justify-between gap-3 border-b border-[#EEF4F8] px-5 py-4">
          <div>
            {title && <h2 className="text-[15px] font-bold text-[#0A3D5E]">{title}</h2>}
            {subtitle && <p className="mt-0.5 text-xs text-slate-500">{subtitle}</p>}
          </div>
          {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
        </header>
      )}
      <div className="p-5">{children}</div>
    </section>
  );
}

const TONES: Record<Tone, string> = {
  green: 'bg-emerald-50 text-emerald-700 ring-emerald-600/15',
  red: 'bg-red-50 text-red-700 ring-red-600/15',
  amber: 'bg-amber-50 text-amber-800 ring-amber-600/20',
  blue: 'bg-sky-50 text-sky-700 ring-sky-600/15',
  gray: 'bg-slate-100 text-slate-600 ring-slate-500/15',
  brand: 'bg-brand/10 text-brand ring-brand/20',
};

export function Badge({ tone = 'gray', children, dot }: { tone?: Tone; children: ReactNode; dot?: boolean }) {
  return (
    <span className={cx('inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-semibold ring-1 ring-inset', TONES[tone])}>
      {dot && <span className="h-1.5 w-1.5 rounded-full bg-current" />}
      {children}
    </span>
  );
}

type Variant = 'primary' | 'secondary' | 'danger' | 'ghost' | 'success';
const VARIANTS: Record<Variant, string> = {
  primary: 'bg-gradient-to-l from-[#0E78AA] to-[#1787B8] text-white shadow-sm hover:brightness-105',
  secondary: 'border border-[#CFE7F2] bg-white text-[#0A3D5E] hover:bg-[#F6FBFD]',
  danger: 'bg-red-600 text-white hover:bg-red-700',
  success: 'bg-emerald-600 text-white hover:bg-emerald-700',
  ghost: 'text-[#0A3D5E] hover:bg-[#EEF6FA]',
};

export function Button({
  variant = 'primary',
  loading,
  icon,
  children,
  className,
  size = 'md',
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant; loading?: boolean; icon?: ReactNode; size?: 'sm' | 'md' }) {
  return (
    <button
      type="button"
      {...rest}
      disabled={rest.disabled || loading}
      className={cx(
        'inline-flex items-center justify-center gap-2 rounded-xl font-semibold transition disabled:cursor-not-allowed disabled:opacity-60',
        size === 'sm' ? 'h-8 px-3 text-xs' : 'h-10 px-4 text-sm',
        VARIANTS[variant],
        className
      )}
    >
      {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : icon}
      {children}
    </button>
  );
}

export function Field({ label, hint, children, error }: { label: string; hint?: ReactNode; children: ReactNode; error?: string }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-xs font-semibold text-[#0A3D5E]">{label}</span>
      {children}
      {hint && !error && <span className="mt-1 block text-[11px] text-slate-500">{hint}</span>}
      {error && <span className="mt-1 block text-[11px] text-red-600">{error}</span>}
    </label>
  );
}

const inputClass =
  'h-10 w-full rounded-xl border border-[#CFE7F2] bg-[#F8FCFE] px-3 text-sm text-[#0A3D5E] outline-none transition placeholder:text-slate-400 focus:border-[#0E78AA] focus:bg-white focus:ring-2 focus:ring-[#0E78AA]/20 disabled:opacity-60';

export function Input(props: InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} className={cx(inputClass, props.className)} />;
}

export function Select(props: SelectHTMLAttributes<HTMLSelectElement>) {
  return <select {...props} className={cx(inputClass, 'pe-8', props.className)} />;
}

export function Toggle({ checked, onChange, disabled, label }: { checked: boolean; onChange: (v: boolean) => void; disabled?: boolean; label?: string }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={cx(
        'relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition disabled:opacity-50',
        checked ? 'bg-emerald-500' : 'bg-slate-300'
      )}
    >
      <span className={cx('inline-block h-5 w-5 rounded-full bg-white shadow transition', checked ? '-translate-x-[22px]' : '-translate-x-0.5')} />
    </button>
  );
}

export function Modal({ open, onClose, title, children, footer, width = 'max-w-lg' }: {
  open: boolean;
  onClose: () => void;
  title: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
  width?: string;
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-[#071018]/50 p-4 backdrop-blur-[2px] sm:items-center" onMouseDown={onClose}>
      <div className={cx('w-full rounded-2xl bg-white shadow-2xl', width)} onMouseDown={(e) => e.stopPropagation()} role="dialog" aria-modal="true">
        <div className="flex items-center justify-between border-b border-[#EEF4F8] px-5 py-4">
          <h3 className="text-base font-bold text-[#0A3D5E]">{title}</h3>
          <button type="button" onClick={onClose} className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600" aria-label="إغلاق">
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="max-h-[70vh] overflow-y-auto px-5 py-4">{children}</div>
        {footer && <div className="flex flex-wrap justify-end gap-2 border-t border-[#EEF4F8] px-5 py-3">{footer}</div>}
      </div>
    </div>
  );
}

export function ConfirmDialog({ open, onClose, onConfirm, title, message, confirmLabel = 'تأكيد', tone = 'danger', loading }: {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  message: ReactNode;
  confirmLabel?: string;
  tone?: 'danger' | 'primary';
  loading?: boolean;
}) {
  return (
    <Modal
      open={open}
      onClose={onClose}
      title={title}
      width="max-w-md"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>إلغاء</Button>
          <Button variant={tone} onClick={onConfirm} loading={loading}>{confirmLabel}</Button>
        </>
      }
    >
      <div className="text-sm leading-7 text-slate-600">{message}</div>
    </Modal>
  );
}

export function Stat({ label, value, hint, icon, tone = 'brand' }: { label: string; value: ReactNode; hint?: ReactNode; icon?: ReactNode; tone?: Tone }) {
  return (
    <div className="rounded-2xl border border-[#E3EEF4] bg-white p-4 shadow-[0_1px_2px_rgba(10,61,94,0.04)]">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs font-medium text-slate-500">{label}</p>
          <p className="mt-1.5 text-2xl font-black tracking-tight text-[#0A3D5E]">{value}</p>
          {hint && <p className="mt-1 text-[11px] text-slate-500">{hint}</p>}
        </div>
        {icon && <span className={cx('flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ring-1 ring-inset', TONES[tone])}>{icon}</span>}
      </div>
    </div>
  );
}

export function Spinner({ label = 'جارٍ التحميل…' }: { label?: string }) {
  return (
    <div className="flex items-center justify-center gap-2 py-16 text-sm text-slate-500">
      <Loader2 className="h-5 w-5 animate-spin text-brand" /> {label}
    </div>
  );
}

export function EmptyState({ title, hint }: { title: string; hint?: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 py-14 text-center">
      <Inbox className="h-9 w-9 text-slate-300" />
      <p className="text-sm font-semibold text-slate-600">{title}</p>
      {hint && <p className="text-xs text-slate-400">{hint}</p>}
    </div>
  );
}

export function ErrorBox({ error }: { error: unknown }) {
  return (
    <div role="alert" className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
      {error instanceof Error ? error.message : 'حدث خطأ غير متوقع'}
    </div>
  );
}

export function Table({ head, children }: { head: ReactNode[]; children: ReactNode }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[720px] text-sm">
        <thead>
          <tr className="border-b border-[#EEF4F8] bg-[#F8FCFE] text-right text-xs font-semibold text-slate-500">
            {head.map((h, i) => (
              <th key={i} className="whitespace-nowrap px-4 py-3 font-semibold">{h}</th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-[#F0F5F8]">{children}</tbody>
      </table>
    </div>
  );
}

export function Pager({ page, pageSize, total, onPage }: { page: number; pageSize: number; total: number; onPage: (p: number) => void }) {
  const pages = Math.max(1, Math.ceil(total / pageSize));
  return (
    <div className="flex items-center justify-between gap-3 border-t border-[#EEF4F8] px-4 py-3 text-xs text-slate-500">
      <span>
        {total === 0 ? 'لا نتائج' : `${(page - 1) * pageSize + 1}–${Math.min(page * pageSize, total)} من ${total}`}
      </span>
      <div className="flex items-center gap-1">
        <Button size="sm" variant="secondary" disabled={page <= 1} onClick={() => onPage(page - 1)} icon={<ChevronRight className="h-4 w-4" />}>السابق</Button>
        <span className="px-2 font-semibold text-[#0A3D5E]">{page} / {pages}</span>
        <Button size="sm" variant="secondary" disabled={page >= pages} onClick={() => onPage(page + 1)}>
          التالي <ChevronLeft className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}

export function PageHeader({ title, subtitle, actions }: { title: string; subtitle?: string; actions?: ReactNode }) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div>
        <h1 className="text-2xl font-black text-[#0A3D5E]">{title}</h1>
        {subtitle && <p className="mt-1 text-sm text-slate-500">{subtitle}</p>}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </div>
  );
}

export function Tabs<T extends string>({ value, onChange, items }: { value: T; onChange: (v: T) => void; items: Array<{ value: T; label: string; icon?: ReactNode }> }) {
  return (
    <div className="mb-5 flex gap-1 overflow-x-auto rounded-2xl border border-[#E3EEF4] bg-white p-1">
      {items.map((it) => (
        <button
          key={it.value}
          type="button"
          onClick={() => onChange(it.value)}
          className={cx(
            'flex items-center gap-2 whitespace-nowrap rounded-xl px-4 py-2 text-sm font-semibold transition',
            value === it.value ? 'bg-[#0E78AA] text-white shadow-sm' : 'text-slate-600 hover:bg-[#F1F8FB]'
          )}
        >
          {it.icon}
          {it.label}
        </button>
      ))}
    </div>
  );
}
