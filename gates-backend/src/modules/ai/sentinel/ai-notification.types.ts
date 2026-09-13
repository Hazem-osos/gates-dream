import type { NotificationCategory, NotificationSeverity } from '@prisma/client';
import type { SentinelRole } from './notification-rbac';

export type SentinelFinding = {
  category: NotificationCategory;
  severity: NotificationSeverity;
  titleAr: string;
  messageAr: string;
  actionUrl?: string;
  actionLabelAr?: string;
  metadata?: Record<string, unknown>;
  fingerprint: string;
  targetRoles: readonly SentinelRole[];
};

export type PersistedAiNotification = {
  id: string;
  companyId: string;
  userId: string | null;
  targetRoles: unknown;
  category: NotificationCategory;
  severity: NotificationSeverity;
  titleAr: string;
  messageAr: string;
  actionUrl: string | null;
  actionLabelAr: string | null;
  metadata: unknown;
  fingerprint: string | null;
  isRead: boolean;
  readAt: Date | null;
  createdAt: Date;
};
