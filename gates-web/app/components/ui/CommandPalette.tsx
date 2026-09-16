'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { GATES_TOUR_INTERRUPT_EVENT } from '@/components/onboarding/ProductTourProvider';
import { Command } from 'cmdk';
import { useRouter } from 'next/navigation';
import { destinationAppTabHref } from '@/lib/navigation/tab-memory';
import { useApiQuery } from '@/lib/hooks/useApi';
import { useDebouncedValue } from '@/lib/hooks/useDebouncedValue';
import {
  filterStaticCommands,
  quickActionCommands,
  type CommandEntry,
} from '@/lib/navigation/commandRegistry';
import type { PartyOption, ItemOption, AccountOption } from '@/lib/hooks/useMasterDataQueries';
import { formatItemLabel } from '@/lib/hooks/useMasterDataQueries';
import { usePageFavorites } from '@/lib/hooks/usePageFavorites';
import { getRecentForPalette, useCommandRecent } from '@/lib/hooks/useCommandRecent';
import { useInstantPrefetch } from '@/lib/hooks/useInstantPrefetch';
import { GATES_AI_OPEN_EVENT } from '@/lib/hooks/useGatesAi';
import { settingsHrefForNav } from '@/lib/transaction-settings/types';
import { resolveTabLabel } from '@/lib/navigation/tab-labels';

function displayPageLabel(href: string, stored?: string) {
  if (stored && !stored.includes('/') && !stored.startsWith('http')) return stored;
  return resolveTabLabel(href);
}

type CommandPaletteProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

type InvoiceSearchRow = {
  id: string;
  invoiceNumber?: string | null;
  customer?: { arabicName?: string };
  supplier?: { arabicName?: string };
};

export function CommandPalette({ open, onOpenChange }: CommandPaletteProps) {
  const router = useRouter();
  const [query, setQuery] = useState('');
  const debouncedEntity = useDebouncedValue(query, 200);
  const { favorites } = usePageFavorites();
  const { pushRecent } = useCommandRecent();
  const { schedulePrefetch } = useInstantPrefetch();

  useEffect(() => {
    if (!open) setQuery('');
  }, [open]);

  const q = query.trim();
  const staticItems = useMemo(() => filterStaticCommands(query), [query]);
  const quickActions = useMemo(() => {
    if (q) {
      return staticItems.filter((e) => e.group === 'actions');
    }
    return quickActionCommands;
  }, [q, staticItems]);

  const entityEnabled = open && debouncedEntity.trim().length >= 2;

  const { data: customersData } = useApiQuery<PartyOption[]>(
    ['command-palette', 'customers', debouncedEntity],
    '/accounting/customers',
    { limit: 8, search: debouncedEntity.trim(), isActive: true },
    { enabled: entityEnabled }
  );

  const { data: itemsData } = useApiQuery<ItemOption[]>(
    ['command-palette', 'items', debouncedEntity],
    '/inventory/items',
    { limit: 8, search: debouncedEntity.trim(), isActive: true },
    { enabled: entityEnabled }
  );

  const { data: accountsData } = useApiQuery<AccountOption[]>(
    ['command-palette', 'accounts', debouncedEntity],
    '/accounting/accounts',
    { limit: 8, search: debouncedEntity.trim(), isActive: true },
    { enabled: entityEnabled }
  );

  const { data: invoicesData } = useApiQuery<InvoiceSearchRow[]>(
    ['command-palette', 'invoices', debouncedEntity],
    '/invoices',
    { limit: 8, search: debouncedEntity.trim(), invoiceKind: 'SALE' },
    { enabled: entityEnabled }
  );

  const prefetchItemHandlers = useCallback(
    (href: string) => ({
      onMouseEnter: () => schedulePrefetch(href),
      onFocus: () => schedulePrefetch(href),
    }),
    [schedulePrefetch]
  );

  const runNavigate = useCallback(
    (href: string, label: string, id?: string) => {
      const tourActive =
        typeof document !== 'undefined' && document.body.classList.contains('driver-active');
      const checkpointStep =
        typeof document !== 'undefined' &&
        document.body.classList.contains('gates-tour-active') &&
        document.querySelector('.gates-tour-popover [data-gates-tour-checkpoint]');
      if (tourActive && !checkpointStep) {
        window.dispatchEvent(new CustomEvent(GATES_TOUR_INTERRUPT_EVENT));
      }
      pushRecent({ id: id ?? href, label, href });
      onOpenChange(false);
      router.push(destinationAppTabHref(href));
    },
    [onOpenChange, router, pushRecent]
  );

  const renderCommandLabel = (label: string, href?: string) => {
    const settingsHref = settingsHrefForNav(href);
    return (
      <span className="flex w-full items-center justify-between gap-2">
        <span>{label}</span>
        {settingsHref ? (
          <button
            type="button"
            className="inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[11px] text-slate-400 hover:bg-[#E6F0F7] hover:text-[#0E79AA]"
            onPointerDown={(e) => {
              e.preventDefault();
              e.stopPropagation();
            }}
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              runNavigate(settingsHref, `إعدادات ${label}`, settingsHref);
            }}
          >
            ⚙️ إعدادات
          </button>
        ) : null}
      </span>
    );
  };

  const favoriteItems = useMemo(() => {
    if (q) {
      return favorites.filter(
        (f) => f.label.includes(q) || f.href.includes(q)
      );
    }
    return favorites;
  }, [favorites, q]);

  const recentItems = useMemo(() => getRecentForPalette(), [open]);

  const entityGroups = useMemo(() => {
    if (!entityEnabled) return [];
    const rows: { id: string; label: string; href: string }[] = [];
    for (const inv of invoicesData?.data ?? []) {
      const num = inv.invoiceNumber ?? inv.id.slice(0, 8);
      const party = inv.customer?.arabicName ?? inv.supplier?.arabicName ?? '';
      rows.push({
        id: `inv:${inv.id}`,
        label: `فاتورة ${num}${party ? ` — ${party}` : ''}`,
        href: `/inventory/operations/sales-invoice?invoiceId=${inv.id}`,
      });
    }
    for (const c of customersData?.data ?? []) {
      rows.push({
        id: `cust:${c.id}`,
        label: `عميل: ${c.code ? `[${c.code}] ` : ''}${c.arabicName}`,
        href: '/accounting/cards/customer',
      });
    }
    for (const a of accountsData?.data ?? []) {
      rows.push({
        id: `acc:${a.id}`,
        label: `حساب: [${a.code}] ${a.arabicName}`,
        href: '/accounting/chart-of-accounts',
      });
    }
    for (const it of itemsData?.data ?? []) {
      rows.push({
        id: `item:${it.id}`,
        label: `صنف: ${formatItemLabel(it)}`,
        href: '/inventory/creations/item-card',
      });
    }
    return rows;
  }, [entityEnabled, customersData, itemsData, invoicesData, accountsData]);

  const pageSearch = useMemo(() => {
    if (!q) return [];
    const seen = new Set<string>();
    return staticItems
      .filter((e) => e.group === 'pages')
      .filter((e) => {
        if (seen.has(e.id)) return false;
        seen.add(e.id);
        return true;
      })
      .slice(0, 12);
  }, [staticItems, q]);

  if (!open) return null;

  const itemClass =
    'cursor-pointer rounded-lg px-3 py-2 text-sm text-gray-800 aria-selected:bg-[#DEEFF6] aria-selected:text-[#094C6B]';

  return (
    <div
      data-gates-command-palette=""
      className="fixed inset-0 z-[11000] flex items-start justify-center bg-black/40 px-4 pt-[12vh]"
      style={{ direction: 'rtl' }}
      onClick={() => onOpenChange(false)}
      role="presentation"
    >
      <div
        className="w-full max-w-xl overflow-hidden rounded-2xl border border-[#D6EAF3] bg-white shadow-2xl"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label="لوحة الأوامر"
      >
        <Command label="لوحة الأوامر" shouldFilter={false} loop>
          <div className="border-b border-[#E6F0F7] px-4 py-3">
            <Command.Input
              value={query}
              onValueChange={setQuery}
              placeholder="ابحث… ⭐ المفضلة · إجراءات · فواتير · عملاء"
              className="w-full border-0 bg-transparent text-base text-[#0A3D5E] outline-none placeholder:text-gray-400"
              autoFocus
            />
            <p className="mt-1 text-xs text-gray-500">Cmd+K · ↑↓ · Enter · Esc</p>
          </div>
          <Command.List className="max-h-[min(420px,50vh)] overflow-y-auto p-2">
            <Command.Empty className="py-6 text-center text-sm text-gray-500">
              لا توجد نتائج
            </Command.Empty>

            {favoriteItems.length > 0 ? (
              <Command.Group heading="⭐ الصفحات والمفضلة" className="px-2 py-1">
                {favoriteItems.map((f) => (
                  <Command.Item
                    key={f.href}
                    value={`fav ${f.href} ${f.label}`}
                    onSelect={() => runNavigate(f.href, displayPageLabel(f.href, f.label), f.href)}
                    className={itemClass}
                    {...prefetchItemHandlers(f.href)}
                  >
                    {displayPageLabel(f.href, f.label)}
                  </Command.Item>
                ))}
              </Command.Group>
            ) : null}

            {!q && recentItems.length > 0 ? (
              <Command.Group heading="🕒 آخر العناصر" className="mt-2 px-2 py-1">
                {recentItems.map((r) => (
                  <Command.Item
                    key={r.id}
                    value={`recent ${r.id} ${r.label}`}
                    onSelect={() => runNavigate(r.href, displayPageLabel(r.href, r.label), r.id)}
                    className={itemClass}
                    {...prefetchItemHandlers(r.href)}
                  >
                    {displayPageLabel(r.href, r.label)}
                  </Command.Item>
                ))}
              </Command.Group>
            ) : null}

            {quickActions.length > 0 ? (
              <Command.Group heading="⚡ إجراءات سريعة" className="mt-2 px-2 py-1">
                {quickActions.map((entry: CommandEntry) => (
                  <Command.Item
                    key={entry.id}
                    value={`${entry.id} ${entry.label}`}
                    onSelect={() => {
                      if (entry.action === 'open-gates-ai') {
                        onOpenChange(false);
                        window.dispatchEvent(new Event(GATES_AI_OPEN_EVENT));
                        return;
                      }
                      if (entry.href) runNavigate(entry.href, entry.label, entry.id);
                    }}
                    className={itemClass}
                    {...(entry.href ? prefetchItemHandlers(entry.href) : {})}
                  >
                    <span className="font-semibold text-[#0E78AA]">
                      {renderCommandLabel(entry.label, entry.href)}
                    </span>
                  </Command.Item>
                ))}
              </Command.Group>
            ) : null}

            {entityGroups.length > 0 ? (
              <Command.Group heading="🔍 البحث الشامل" className="mt-2 px-2 py-1">
                {entityGroups.map((row) => (
                  <Command.Item
                    key={row.id}
                    value={`${row.id} ${row.label}`}
                    onSelect={() => runNavigate(row.href, row.label, row.id)}
                    className={itemClass}
                    {...prefetchItemHandlers(row.href)}
                  >
                    {row.label}
                  </Command.Item>
                ))}
              </Command.Group>
            ) : null}

            {pageSearch.length > 0 ? (
              <Command.Group heading="صفحات النظام" className="mt-2 px-2 py-1">
                {pageSearch.map((entry, index) => (
                  <Command.Item
                    key={`${entry.id}::${entry.label}::${index}`}
                    value={`${entry.id} ${entry.label}`}
                    onSelect={() => entry.href && runNavigate(entry.href, entry.label, entry.id)}
                    className={itemClass}
                    {...(entry.href ? prefetchItemHandlers(entry.href) : {})}
                  >
                    {renderCommandLabel(entry.label, entry.href)}
                  </Command.Item>
                ))}
              </Command.Group>
            ) : null}
          </Command.List>
        </Command>
      </div>
    </div>
  );
}
