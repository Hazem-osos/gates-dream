'use client';

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { createPortal } from 'react-dom';

type Item = {
  id: string;
  label: string;
  onClick: () => void;
  disabled?: boolean;
  destructive?: boolean;
  hint?: string;
  icon?: ReactNode;
};

type Props = {
  trigger: ReactNode;
  items: Item[];
  /** Anchor menu to trigger's inline end (right in LTR, left in RTL). */
  align?: 'left' | 'right';
};

const MENU_MIN_W = 248;

export function SimpleDropdownMenu({ trigger, items, align = 'left' }: Props) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const [menuStyle, setMenuStyle] = useState<{ top: number; left: number; minWidth: number } | null>(
    null
  );

  const updatePosition = useCallback(() => {
    const el = triggerRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const minWidth = Math.max(MENU_MIN_W, rect.width);
    let left = align === 'right' ? rect.right - minWidth : rect.left;
    left = Math.max(8, Math.min(left, window.innerWidth - minWidth - 8));
    const top = rect.bottom + 4;
    setMenuStyle({ top, left, minWidth });
  }, [align]);

  useLayoutEffect(() => {
    if (!open) {
      setMenuStyle(null);
      return;
    }
    updatePosition();
  }, [open, updatePosition]);

  useEffect(() => {
    if (!open) return;
    const onScrollOrResize = () => updatePosition();
    window.addEventListener('resize', onScrollOrResize);
    window.addEventListener('scroll', onScrollOrResize, true);
    return () => {
      window.removeEventListener('resize', onScrollOrResize);
      window.removeEventListener('scroll', onScrollOrResize, true);
    };
  }, [open, updatePosition]);

  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      const t = e.target as Node;
      if (rootRef.current?.contains(t) || menuRef.current?.contains(t)) return;
      setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDoc);
      document.removeEventListener('keydown', onKey);
    };
  }, []);

  const menu =
    open && menuStyle && typeof document !== 'undefined'
      ? createPortal(
          <div
            ref={menuRef}
            role="menu"
            dir="rtl"
            className="fixed z-[9990] overflow-hidden rounded-2xl border border-[#C5DFF0] bg-white/95 p-1.5 shadow-[0_18px_40px_-20px_rgba(9,76,107,0.45)] ring-1 ring-[#0E78AA]/10 backdrop-blur-md"
            style={{
              top: menuStyle.top,
              left: menuStyle.left,
              minWidth: menuStyle.minWidth,
            }}
          >
            {items.map((item, index) => {
              const isNew = item.id === 'add' || item.label === 'جديد';
              const button = (
                <button
                  type="button"
                  role="menuitem"
                  disabled={item.disabled}
                  title={item.hint}
                  onClick={() => {
                    setOpen(false);
                    item.onClick();
                  }}
                  className={`flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-right text-sm font-semibold transition disabled:pointer-events-none disabled:opacity-40 ${
                    item.destructive
                      ? 'text-red-600 hover:bg-red-50'
                      : isNew
                        ? 'bg-[#E8F4FA] text-[#0E78AA] hover:bg-[#D6EAF3]'
                        : 'text-[#0A3D5E] hover:bg-[#F4FAFD]'
                  }`}
                >
                  {item.icon ? (
                    <span
                      className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${
                        item.destructive
                          ? 'bg-red-50 text-red-600'
                          : isNew
                            ? 'bg-[#0E78AA] text-white'
                            : 'bg-[#EAF6FB] text-[#0E78AA]'
                      }`}
                    >
                      {item.icon}
                    </span>
                  ) : null}
                  <span className="flex-1 leading-5">{item.label}</span>
                </button>
              );
              if (item.disabled && item.hint) {
                return (
                  <div key={item.id} className="group/hint relative" title={item.hint}>
                    {button}
                    <span
                      role="tooltip"
                      className="pointer-events-none absolute left-2 right-2 top-full z-[9991] mt-1 hidden rounded-lg border border-[#D6EAF3] bg-[#0A3D5E] px-2.5 py-2 text-right text-[11px] font-medium leading-5 text-white shadow-lg group-hover/hint:block"
                    >
                      {item.hint}
                    </span>
                  </div>
                );
              }
              return (
                <div key={item.id}>
                  {button}
                  {isNew && index === 0 && items.length > 1 ? (
                    <div className="mx-2 my-1.5 h-px bg-[#D6EAF3]" />
                  ) : null}
                </div>
              );
            })}
          </div>,
          document.body
        )
      : null;

  return (
    <div className="relative inline-flex items-center" ref={rootRef}>
      <div
        ref={triggerRef}
        data-dropdown-trigger
        role="presentation"
        onClick={(e) => {
          e.stopPropagation();
          setOpen((v) => !v);
        }}
        className="inline-flex cursor-pointer"
      >
        {trigger}
      </div>
      {menu}
    </div>
  );
}
