'use client';

import React from 'react';

/** Shared shell for navbar dropdown panels (notifications, settings, help). */
export function NavbarQuickPanel({
  title,
  subtitle,
  onClose,
  panelRef,
  children,
  footer,
  className = '',
}: {
  title: string;
  subtitle?: string;
  onClose: () => void;
  panelRef?: React.Ref<HTMLDivElement>;
  children: React.ReactNode;
  footer?: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      ref={panelRef}
      role="dialog"
      aria-label={title}
      className={`fixed left-4 top-[5.25rem] z-[60] w-[min(100vw-2rem,380px)] flex flex-col max-h-[min(70vh,520px)] overflow-hidden rounded-2xl border border-[#D6EAF3] bg-white shadow-2xl transition-all duration-200 opacity-100 translate-y-0 ${className}`}
      style={{ direction: 'rtl' }}
    >
      <div className="flex items-start justify-between gap-3 px-4 py-3 border-b border-[#E6F0F7] bg-gradient-to-l from-[#F6FBFD] to-white">
        <div>
          <h2 className="text-base font-bold text-[#094C6B]">{title}</h2>
          {subtitle ? <p className="text-xs text-gray-500 mt-0.5">{subtitle}</p> : null}
        </div>
        <button
          type="button"
          onClick={onClose}
          className="shrink-0 w-8 h-8 rounded-lg text-gray-500 hover:bg-[#DEEFF6] hover:text-[#094C6B] text-xl leading-none"
          aria-label="إغلاق"
        >
          ×
        </button>
      </div>
      <div className="flex-1 overflow-y-auto">{children}</div>
      {footer ? (
        <div className="border-t border-[#E6F0F7] bg-[#F9FAFB] px-4 py-3">{footer}</div>
      ) : null}
    </div>
  );
}

export function NavbarPanelBackdrop({ show, onClose }: { show: boolean; onClose: () => void }) {
  if (!show) return null;
  return (
    <button
      type="button"
      aria-label="إغلاق القائمة"
      className="fixed inset-x-0 bottom-0 top-[5.25rem] z-[55] bg-[#062A42]/25 backdrop-blur-[2px] cursor-default"
      onClick={onClose}
    />
  );
}
