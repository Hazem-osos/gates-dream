'use client';

import { useState, type ReactNode } from 'react';
import {
  DocumentBrowseDrawer,
  ErpDocumentLayout,
  ErpDocumentPageHeader,
  GenericRecordsList,
  type ErpHeaderMenuItem,
} from '@/components/erp';
import type { GenericRecordColumn, GenericRecordRow } from '@/components/erp/GenericRecordsList';

type Crumb = { href?: string; label: string };

export type ExtractsBrowseList = {
  title: string;
  apiPath: string;
  listKey: string;
  columns: GenericRecordColumn[];
  selectedId?: string | null;
  extraParams?: Record<string, string | number | boolean | undefined>;
  onSelect: (id: string, row: GenericRecordRow) => void;
};

export function ExtractsPageChrome({
  title,
  breadcrumbs,
  children,
  onSave,
  savePending,
  canSave = true,
  saveLabel = 'حفظ',
  onNew,
  extraActions,
  moreMenuItems,
  statusLabel,
  docNumber,
  favoriteHref,
  hideSave = false,
  currentId,
  filters,
  onBrowseList,
  browseList,
}: {
  title: string;
  breadcrumbs?: Crumb[];
  children: ReactNode;
  onSave?: () => void;
  savePending?: boolean;
  canSave?: boolean;
  saveLabel?: string;
  onNew?: () => void;
  extraActions?: ReactNode;
  moreMenuItems?: ErpHeaderMenuItem[];
  statusLabel?: string;
  docNumber?: string;
  favoriteHref?: string;
  hideSave?: boolean;
  currentId?: string | null;
  filters?: ReactNode;
  onBrowseList?: () => void;
  browseList?: ExtractsBrowseList;
}) {
  const [browseOpen, setBrowseOpen] = useState(false);
  const crumbs = breadcrumbs ?? [
    { href: '/extracts', label: 'المستخلصات' },
    { label: title },
  ];

  const items: ErpHeaderMenuItem[] = [
    ...(onNew ? [{ id: 'new', label: 'جديد', onClick: onNew }] : []),
    ...(moreMenuItems ?? []),
  ];

  const openBrowse = onBrowseList ?? (browseList ? () => setBrowseOpen(true) : undefined);

  return (
    <ErpDocumentLayout>
      <ErpDocumentPageHeader
        compact
        lockWhenPosted={false}
        breadcrumbs={crumbs}
        title={title}
        docNumber={docNumber}
        showDocumentRef={Boolean(docNumber)}
        statusTone="info"
        statusLabel={statusLabel ?? (hideSave ? 'عرض' : currentId ? 'تعديل' : 'جديد')}
        saveLabel={saveLabel}
        onSaveDraft={hideSave ? undefined : (onSave ?? (() => undefined))}
        savePending={savePending}
        canSave={Boolean(onSave) && canSave && !savePending}
        saveDisabledHint={onSave ? undefined : 'لا يوجد مستند للحفظ في هذه الشاشة'}
        hideStandalonePost
        onBrowseList={openBrowse}
        browseListLabel="السابق"
        hideActionMenu={!items.length}
        moreMenuItems={items.length ? items : undefined}
        extraActions={extraActions ?? filters}
        currentId={currentId}
        favoriteHref={favoriteHref}
        favoriteLabel={title}
      />
      {children}
      {browseList ? (
        <DocumentBrowseDrawer
          open={browseOpen}
          onClose={() => setBrowseOpen(false)}
          title={browseList.title}
        >
          <GenericRecordsList
            apiPath={browseList.apiPath}
            listKey={browseList.listKey}
            columns={browseList.columns}
            extraParams={browseList.extraParams}
            selectedId={browseList.selectedId}
            onSelect={(id, row) => {
              browseList.onSelect(id, row);
              setBrowseOpen(false);
            }}
          />
        </DocumentBrowseDrawer>
      ) : null}
    </ErpDocumentLayout>
  );
}
