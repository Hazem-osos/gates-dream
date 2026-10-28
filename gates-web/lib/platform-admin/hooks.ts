'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
  adminRequest,
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
};

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

export const useAdmins = () =>
  useQuery({ queryKey: adminKeys.admins, queryFn: () => adminRequest<PlatformAdminRow[]>('/admins') });

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
