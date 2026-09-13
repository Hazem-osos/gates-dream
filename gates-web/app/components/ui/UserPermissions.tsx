'use client';

import type { FC } from 'react';
import type { CrudMenuItem } from '@/components/ui/CrudButtons';

export interface UserPermissionsProps {
  resource?: string;
  module?: string;
  canRead?: boolean;
  canAdd?: boolean;
  canEdit?: boolean;
  canDelete?: boolean;
  canPrint?: boolean;
  canPost?: boolean;
  title?: string;
  onPrevious?: () => void;
  previousLabel?: string;
  onAdd?: () => void;
  onEdit?: () => void;
  onDelete?: () => void;
  menuItems?: CrudMenuItem[];
}

/**
 * Legacy permissions strip. The shared screen toolbar (دليل / السابق / ⋯)
 * now lives on PageHeader, ErpDocumentPageHeader, or the layout fallback.
 */
export const UserPermissions: FC<UserPermissionsProps> = () => null;
