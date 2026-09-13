'use client';

import { StatusBadge } from '@/components/ui/StatusBadge';
import {
  BOQ_STATUS_LABEL,
  BOQ_STATUS_TONE,
  CLIENT_INVOICE_LABEL,
  CLIENT_INVOICE_TONE,
  LG_STATUS_LABEL,
  LG_STATUS_TONE,
  LG_TYPE_LABEL,
  SHEET_STATUS_LABEL,
  SHEET_STATUS_TONE,
  SITE_STOCK_LABEL,
  SITE_STOCK_TONE,
} from '@/lib/contracting/labels';
import type {
  ClientInvoiceStatus,
  MeasurementSheetStatus,
  ProjectBOQItemStatus,
  ProjectLgStatus,
  ProjectLgType,
  SiteStockMaterialStatus,
} from '@/lib/contracting/types';

export function BoqStatusBadge({ status }: { status: ProjectBOQItemStatus }) {
  return <StatusBadge label={BOQ_STATUS_LABEL[status] ?? status} tone={BOQ_STATUS_TONE[status] ?? 'neutral'} compact />;
}

export function SheetStatusBadge({ status }: { status: MeasurementSheetStatus }) {
  return (
    <StatusBadge label={SHEET_STATUS_LABEL[status] ?? status} tone={SHEET_STATUS_TONE[status] ?? 'neutral'} compact />
  );
}

export function ClientInvoiceStatusBadge({ status }: { status: ClientInvoiceStatus }) {
  return (
    <StatusBadge
      label={CLIENT_INVOICE_LABEL[status] ?? status}
      tone={CLIENT_INVOICE_TONE[status] ?? 'neutral'}
      compact
    />
  );
}

export function SiteStockStatusBadge({ status }: { status: SiteStockMaterialStatus }) {
  return (
    <StatusBadge label={SITE_STOCK_LABEL[status] ?? status} tone={SITE_STOCK_TONE[status] ?? 'neutral'} compact />
  );
}

export function LgTypeBadge({ type }: { type: ProjectLgType }) {
  return <StatusBadge label={LG_TYPE_LABEL[type] ?? type} tone="info" compact />;
}

export function LgStatusBadge({ status }: { status: ProjectLgStatus }) {
  return <StatusBadge label={LG_STATUS_LABEL[status] ?? status} tone={LG_STATUS_TONE[status] ?? 'neutral'} compact />;
}
