'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
  adminRequest,
  getStoredAdminProfile,
  type AdminCap,
  type AnnouncementRow,
  type CompanyInsights,
  type LoginEventRow,
  type PlatformAdminProfile,
  type AuditRow,
  type CompanyDetail,
  type CompanyRow,
  type DashboardData,
  type Paged,
  type PlatformAdminRow,
  type PlatformSettings,
  type UserDetail,
  type UserRow,
} from './api';

type Query = Record<string, string | number | undefined | null>;

export const adminKeys = {
  all: ['platform-admin'] as const,
  dashboard: ['platform-admin', 'dashboard'] as const,
  companies: (q: Query) => ['platform-admin', 'companies', q] as const,
  company: (id: string) => ['platform-admin', 'company', id] as const,
  users: (q: Query) => ['platform-admin', 'users', q] as const,
  user: (id: string) => ['platform-admin', 'user', id] as const,
  settings: ['platform-admin', 'settings'] as const,
  admins: ['platform-admin', 'admins'] as const,
  audit: (q: Query) => ['platform-admin', 'audit', q] as const,
  meta: ['platform-admin', 'meta'] as const,
  me: ['platform-admin', 'me'] as const,
  insights: (id: string) => ['platform-admin', 'insights', id] as const,
  logins: (q: Query) => ['platform-admin', 'logins', q] as const,
  announcements: ['platform-admin', 'announcements'] as const,
};

export const useMe = () =>
  useQuery({
    queryKey: adminKeys.me,
    queryFn: () => adminRequest<PlatformAdminProfile>('/auth/me'),
    initialData: () => getStoredAdminProfile() ?? undefined,
    // The stored copy is only a placeholder: always confirm role/caps with the server.
    initialDataUpdatedAt: 0,
    staleTime: 60_000,
  });

/**
 * `can('users.delete')` for hiding controls. The server enforces every capability anyway;
 * an older stored profile without caps is treated as allowed until /auth/me answers.
 */
export function useCan(): (cap: AdminCap) => boolean {
  const { data } = useMe();
  return (cap) => (data?.caps ? data.caps.includes(cap) : true);
}

export const useCompanyInsights = (id: string) =>
  useQuery({
    queryKey: adminKeys.insights(id),
    queryFn: () => adminRequest<CompanyInsights>(`/companies/${id}/insights`),
    enabled: Boolean(id),
  });

export const useLoginEvents = (q: Query, enabled = true) =>
  useQuery({
    queryKey: adminKeys.logins(q),
    queryFn: () => adminRequest<Paged<LoginEventRow>>('/logins', { query: q }),
    placeholderData: (prev) => prev,
    enabled,
  });

export const useAnnouncements = () =>
  useQuery({ queryKey: adminKeys.announcements, queryFn: () => adminRequest<AnnouncementRow[]>('/announcements') });

export const useDashboard = () =>
  useQuery({ queryKey: adminKeys.dashboard, queryFn: () => adminRequest<DashboardData>('/dashboard'), refetchInterval: 60_000 });

export const useCompanies = (q: Query) =>
  useQuery({
    queryKey: adminKeys.companies(q),
    queryFn: () => adminRequest<Paged<CompanyRow>>('/companies', { query: q }),
    placeholderData: (prev) => prev,
  });

export const useCompany = (id: string) =>
  useQuery({ queryKey: adminKeys.company(id), queryFn: () => adminRequest<CompanyDetail>(`/companies/${id}`), enabled: Boolean(id) });

export const useUsers = (q: Query, enabled = true) =>
  useQuery({
    queryKey: adminKeys.users(q),
    queryFn: () => adminRequest<Paged<UserRow>>('/users', { query: q }),
    placeholderData: (prev) => prev,
    enabled,
  });

export const useUser = (id: string) =>
  useQuery({ queryKey: adminKeys.user(id), queryFn: () => adminRequest<UserDetail>(`/users/${id}`), enabled: Boolean(id) });

export const useSettings = () =>
  useQuery({ queryKey: adminKeys.settings, queryFn: () => adminRequest<PlatformSettings>('/settings') });

export const useAdmins = (enabled = true) =>
  useQuery({ queryKey: adminKeys.admins, queryFn: () => adminRequest<PlatformAdminRow[]>('/admins'), enabled });

export const useAudit = (q: Query) =>
  useQuery({
    queryKey: adminKeys.audit(q),
    queryFn: () => adminRequest<Paged<AuditRow>>('/audit', { query: q }),
    placeholderData: (prev) => prev,
  });

export const useMeta = () =>
  useQuery({
    queryKey: adminKeys.meta,
    queryFn: () => adminRequest<{ licenseModules: string[] }>('/meta'),
    staleTime: Infinity,
  });

/**
 * Every admin mutation: call the API, toast the result, then refresh everything under
 * the platform-admin key (lists, details and the dashboard all depend on each other).
 */
export function useAdminMutation<TVars, TResult = unknown>(
  fn: (vars: TVars) => Promise<TResult>,
  opts: { success?: string | ((r: TResult) => string); onSuccess?: (r: TResult, vars: TVars) => void } = {}
) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: fn,
    onSuccess: async (result, vars) => {
      await qc.invalidateQueries({ queryKey: adminKeys.all });
      const msg = typeof opts.success === 'function' ? opts.success(result) : opts.success;
      if (msg) toast.success(msg);
      opts.onSuccess?.(result, vars);
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : 'تعذّر تنفيذ العملية'),
  });
}
