'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAppTabs } from '@/app/components/AppTabsContext';
import { useOwnTabSearchParams } from '@/lib/navigation/tab-route-lock';
import {
  StaffCardKindDialog,
  staffCardHref,
  type StaffCardKind,
} from '@/components/accounting/StaffCardKindDialog';

const LEGACY_KIND_PATHS: Record<string, string> = {
  delegate: '/accounting/cards/delegate',
  driver: '/accounting/cards/driver',
  distributor: '/accounting/cards/distributor',
  'delegate-group': '/accounting/cards/delegate-group',
  'cost-center': '/accounting/cards/cost-center',
};

function hrefForLegacyKind(kind: string, id?: string | null) {
  const base = LEGACY_KIND_PATHS[kind];
  if (!base) return null;
  return id ? `${base}?id=${encodeURIComponent(id)}` : base;
}

export default function StaffCardsHubPage() {
  const router = useRouter();
  const tabs = useAppTabs();
  const searchParams = useOwnTabSearchParams();
  const kindParam = searchParams.get('kind');
  const idParam = searchParams.get('id');
  const legacyHref = kindParam ? hrefForLegacyKind(kindParam, idParam) : null;

  const leavePicker = (href: string) => {
    tabs?.closeTab('/accounting/cards/staff');
    router.replace(href);
  };

  useEffect(() => {
    if (!legacyHref) return;
    leavePicker(legacyHref);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- navigate once when a bookmarked kind is present
  }, [legacyHref]);

  const pick = (kind: StaffCardKind) => {
    leavePicker(staffCardHref(kind));
  };

  if (legacyHref) return null;

  return (
    <StaffCardKindDialog
      open
      onPick={pick}
      onClose={() => leavePicker('/accounting/guide/representatives-guide')}
    />
  );
}
