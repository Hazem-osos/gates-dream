import { apiClient } from '@/lib/api/client';
import { cloneDefaultConfig } from './defaults';
import type { DocumentLayoutConfig, DocumentLayoutType } from './types';
import { DOCUMENT_TYPE_LABELS } from './types';

export const GATES_PICK_LAYOUT_EVENT = 'gates:pick-document-layout';

export type PickLayoutDetail = {
  layouts: DocumentLayoutConfig[];
  preferredType?: DocumentLayoutType;
  resolve: (layout: DocumentLayoutConfig | null) => void;
};

export function layoutDisplayName(layout: DocumentLayoutConfig): string {
  const name = layout.name?.trim();
  if (name) return name;
  return DOCUMENT_TYPE_LABELS[layout.documentType] || 'تخطيط';
}

export async function listSavedDocumentLayouts(): Promise<DocumentLayoutConfig[]> {
  try {
    const res = await apiClient.get<DocumentLayoutConfig[]>('/document-layout-configs');
    return res.data ?? [];
  } catch {
    return [];
  }
}

export function effectiveLayoutConfig(remote?: DocumentLayoutConfig | null): DocumentLayoutConfig {
  return { ...cloneDefaultConfig(), ...(remote ?? {}) };
}

/** Ask which saved shape to print with. One layout = use it. None = defaults. */
export async function pickSavedDocumentLayout(
  preferredType?: DocumentLayoutType
): Promise<DocumentLayoutConfig | null> {
  const layouts = await listSavedDocumentLayouts();
  if (layouts.length === 0) return cloneDefaultConfig();
  if (layouts.length === 1) return effectiveLayoutConfig(layouts[0]);

  const preferred = preferredType
    ? layouts.filter((row) => row.documentType === preferredType || row.documentType === 'ALL')
    : layouts;
  const choices = preferred.length ? preferred : layouts;
  if (choices.length === 1) return effectiveLayoutConfig(choices[0]);

  if (typeof window === 'undefined') {
    return effectiveLayoutConfig(choices.find((row) => row.isDefault) ?? choices[0]);
  }

  return new Promise((resolve) => {
    const detail: PickLayoutDetail = {
      layouts: choices,
      preferredType,
      resolve: (picked) => {
        resolve(picked ? effectiveLayoutConfig(picked) : null);
      },
    };
    window.dispatchEvent(new CustomEvent<PickLayoutDetail>(GATES_PICK_LAYOUT_EVENT, { detail }));
  });
}
