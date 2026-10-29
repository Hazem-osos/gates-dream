/**
 * Client for the platform admin API (/api/v1/platform-admin).
 *
 * Deliberately separate from `apiClient`: that one carries the tenant user's token, while the
 * admin panel uses its own platform-admin token stored under its own key.
 */
'use client';

const TOKEN_KEY = 'gates:platform-admin:token';
const PROFILE_KEY = 'gates:platform-admin:profile';

export type AdminRole = 'OWNER' | 'SUPPORT' | 'FINANCE' | 'SALES' | 'VIEWER';
export type AdminCap =
  | 'dashboard.view'
  | 'companies.view'
  | 'companies.create'
  | 'companies.edit'
  | 'companies.disable'
  | 'licenses.edit'
  | 'ai.edit'
  | 'users.view'
  | 'users.edit'
  | 'users.credentials'
  | 'users.delete'
  | 'announcements.manage'
  | 'settings.edit'
  | 'admins.manage'
  | 'audit.view'
  | 'security.view';

export interface PlatformAdminProfile {
  id: string;
  email: string;
  name: string | null;
  role?: AdminRole;
  caps?: AdminCap[];
  twoFactorEnabled?: boolean;
}

function apiBase(): string {
  const fromEnv = process.env.NEXT_PUBLIC_API_URL?.trim().replace(/\/$/, '');
  if (fromEnv) return `${fromEnv}/platform-admin`;
  return `${window.location.origin}/api/v1/platform-admin`;
}

interface StoredToken {
  token: string;
  expiresAt: number;
}

export function getAdminToken(): string | null {
  try {
    const raw = localStorage.getItem(TOKEN_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as StoredToken;
    if (!parsed.token || parsed.expiresAt <= Date.now()) {
      clearAdminSession();
      return null;
    }
    return parsed.token;
  } catch {
    return null;
  }
}

export function getStoredAdminProfile(): PlatformAdminProfile | null {
  try {
    const raw = localStorage.getItem(PROFILE_KEY);
    return raw ? (JSON.parse(raw) as PlatformAdminProfile) : null;
  } catch {
    return null;
  }
}

export function setAdminSession(token: string, expiresInSec: number, profile: PlatformAdminProfile): void {
  try {
    localStorage.setItem(TOKEN_KEY, JSON.stringify({ token, expiresAt: Date.now() + expiresInSec * 1000 }));
    localStorage.setItem(PROFILE_KEY, JSON.stringify(profile));
  } catch {
    /* storage blocked — session lasts for this page only */
  }
}

export function clearAdminSession(): void {
  try {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(PROFILE_KEY);
  } catch {
    /* ignore */
  }
}

export class AdminApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly code?: string
  ) {
    super(message);
  }
}

/** Keep the session but swap the token (after a password or 2FA change bumps the session version). */
export function replaceAdminToken(token: string, expiresInSec: number): void {
  try {
    localStorage.setItem(TOKEN_KEY, JSON.stringify({ token, expiresAt: Date.now() + expiresInSec * 1000 }));
  } catch {
    /* ignore */
  }
}

export function storeAdminProfile(profile: PlatformAdminProfile): void {
  try {
    localStorage.setItem(PROFILE_KEY, JSON.stringify(profile));
  } catch {
    /* ignore */
  }
}

export const ADMIN_UNAUTHORIZED_EVENT = 'gates:platform-admin:unauthorized';

function messageFrom(body: unknown, status: number): string {
  if (body && typeof body === 'object') {
    const b = body as { message?: unknown; errors?: Array<{ message?: string }> };
    if (Array.isArray(b.errors) && b.errors[0]?.message) return String(b.errors[0].message);
    if (typeof b.message === 'string' && b.message) return b.message;
  }
  if (status === 429) return 'محاولات كثيرة. انتظر قليلاً ثم أعد المحاولة.';
  return `تعذّر تنفيذ الطلب (${status})`;
}

export async function adminRequest<T>(
  path: string,
  options: { method?: string; body?: unknown; query?: Record<string, string | number | undefined | null> } = {}
): Promise<T> {
  const url = new URL(`${apiBase()}${path}`);
  for (const [k, v] of Object.entries(options.query ?? {})) {
    if (v !== undefined && v !== null && v !== '') url.searchParams.set(k, String(v));
  }
  const token = getAdminToken();
  let res: Response;
  try {
    res = await fetch(url.toString(), {
      method: options.method ?? 'GET',
      headers: {
        Accept: 'application/json',
        ...(options.body !== undefined ? { 'Content-Type': 'application/json' } : {}),
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
      cache: 'no-store',
      signal: AbortSignal.timeout(30_000),
    });
  } catch {
    throw new AdminApiError('تعذّر الاتصال بالخادم. تحقق من الشبكة.', 0);
  }
  const body: unknown = await res.json().catch(() => null);
  if (!res.ok) {
    if (res.status === 401 && path !== '/auth/login') {
      clearAdminSession();
      window.dispatchEvent(new Event(ADMIN_UNAUTHORIZED_EVENT));
    }
    const code =
      body && typeof body === 'object' && typeof (body as { code?: unknown }).code === 'string'
        ? (body as { code: string }).code
        : undefined;
    throw new AdminApiError(messageFrom(body, res.status), res.status, code);
  }
  return (body as { data: T }).data;
}

// ── Response shapes ────────────────────────────────────────────────────────────

export type LicenseState = 'UNLICENSED' | 'ACTIVE' | 'TRIAL' | 'SUSPENDED' | 'EXPIRED' | 'NOT_STARTED';
export type PlanType = 'LIFETIME' | 'SUBSCRIPTION';
export type SubStatus = 'ACTIVE' | 'TRIAL' | 'EXPIRED' | 'SUSPENDED';

export interface LicenseInfo {
  state: LicenseState;
  subscription: {
    planType: PlanType;
    status: SubStatus;
    startDate: string;
    expiryDate: string | null;
    maxUsers: number;
    maxBranches: number;
    maxStorageMb: number;
    allowedModules: string[];
    updatedAt: string;
  } | null;
}

export interface Paged<T> {
  total: number;
  page: number;
  pageSize: number;
  rows: T[];
}

export interface CompanyRow {
  id: string;
  serial: string | null;
  arabicName: string;
  englishName: string | null;
  contactEmail: string | null;
  phone1: string | null;
  isActive: boolean;
  isOnboarded: boolean;
  createdAt: string;
  users: { total: number; active: number; activeLast7Days: number };
  branches: number;
  activeMinutesLast7Days: number;
  lastSeenAt: string | null;
  ai: { enabled: boolean; limit: number; used: number };
  license: LicenseInfo;
}

export interface ActivityPoint {
  day: string;
  activeUsers: number;
  activeMinutes: number;
  requests?: number;
}

export interface CompanyDetail {
  id: string;
  serial: string | null;
  arabicName: string;
  englishName: string | null;
  contactEmail: string | null;
  phone1: string | null;
  phone2: string | null;
  address: string | null;
  taxNumber1: string | null;
  isActive: boolean;
  isOnboarded: boolean;
  createdAt: string;
  counts: Record<'users' | 'branches' | 'invoices' | 'journalEntries' | 'items' | 'customers' | 'suppliers' | 'aiConversations', number>;
  ai: { enabled: boolean; limit: number; used: number; windowStartedAt: string };
  license: LicenseInfo;
  activity: ActivityPoint[];
}

export interface UserRow {
  id: string;
  email: string;
  username: string;
  firstName: string | null;
  lastName: string | null;
  phone: string | null;
  isActive: boolean;
  isAdmin: boolean;
  lastLoginAt: string | null;
  loginCount: number;
  createdAt: string;
  company: { id: string; arabicName: string; isActive: boolean };
  activeMinutesLast30Days: number;
  activeDaysLast30Days: number;
  lastSeenAt: string | null;
}

export interface UserDetail {
  id: string;
  email: string;
  username: string;
  firstName: string | null;
  lastName: string | null;
  phone: string | null;
  isActive: boolean;
  isAdmin: boolean;
  lastLoginAt: string | null;
  loginCount: number;
  createdAt: string;
  company: { id: string; arabicName: string; isActive: boolean };
  groups: Array<{ id: string; arabicName: string }>;
  branches: Array<{ id: string; arabicName: string }>;
  permissionCount: number;
  aiConversations: number;
  activity: {
    days: Array<{ day: string; activeMinutes: number; requestCount: number; firstSeenAt: string; lastSeenAt: string }>;
    activeDaysLast30: number;
    activeMinutesLast30: number;
    averageMinutesPerActiveDay: number;
    lastSeenAt: string | null;
  };
  sessions: {
    tracked: boolean;
    items: Array<{ ipAddress: string | null; userAgent: string | null; createdAt: string; lastActivityAt: string }>;
  };
}

export interface AuditRow {
  id: string;
  adminEmail: string;
  action: string;
  targetType: string;
  targetId: string | null;
  targetCompanyId: string | null;
  details: Record<string, unknown> | null;
  ip: string | null;
  at: string;
}

export interface PlatformSettings {
  aiEnabled: boolean;
  maintenance: { enabled: boolean; message: string };
}

export interface DashboardData {
  companies: { total: number; active: number; inactive: number; newLast30Days: number };
  users: { total: number; active: number; inactive: number; activeToday: number; activeLast7Days: number; loginsLast24h: number };
  licenses: { licensed: number; unlicensed: number; suspended: number; trial: number; expired: number; expiringIn30Days: number };
  ai: { platformEnabled: boolean; companiesDisabled: number; tokensUsedThisMonth: number };
  maintenance: { enabled: boolean; message: string };
  logins?: {
    successLast24h: number;
    failedLast24h: number;
    mostFailedLast24h: Array<{ identifier: string; attempts: number }>;
  };
  activitySeries: ActivityPoint[];
  topCompanies: Array<{ companyId: string; arabicName: string; activeMinutes: number }>;
  recentAudit: AuditRow[];
}

export interface PlatformAdminRow {
  id: string;
  email: string;
  name: string | null;
  role: AdminRole;
  isActive: boolean;
  twoFactorEnabled: boolean;
  lastLoginAt: string | null;
  createdAt: string;
}

export interface CompanyInsights {
  months: string[];
  usage: Array<{ key: string; label: string; perMonth: number[]; total: number }>;
  eta: {
    documents: Record<string, number>;
    legacyInvoices: Record<string, number>;
    receipts: Record<string, number>;
    lastProblem: { createdAt: string; status: string; documentType: string } | null;
    activeSigningDevices: number;
  };
  storage: { usedBytes: number; files: number; limitMb: number | null };
  limits: { users: { used: number; max: number | null }; branches: { used: number; max: number | null } };
  integrity: { glViolationsTotal: number; glViolationsLast30Days: number };
  integrations: {
    whatsapp: 'active' | 'configured' | 'none';
    email: 'configured' | 'none';
    apiKeys: number;
    automationRules: number;
    migrationJobs: number;
  };
}

export interface LoginEventRow {
  id: string;
  userId: string | null;
  companyId: string | null;
  identifier: string;
  success: boolean;
  reason: string | null;
  ip: string | null;
  userAgent: string | null;
  at: string;
  user: { id: string; email: string; firstName: string | null; lastName: string | null } | null;
  companyName: string | null;
}

export type AnnouncementLevel = 'info' | 'warning' | 'critical';

export interface AnnouncementRow {
  id: string;
  title: string;
  body: string;
  level: AnnouncementLevel;
  audience: 'ALL' | 'COMPANIES';
  companyIds: string[] | null;
  startsAt: string;
  endsAt: string | null;
  isActive: boolean;
  createdBy: string;
  createdAt: string;
}

export interface TokenResult {
  accessToken: string;
  expiresIn: number;
}

export interface LicensePayload {
  planType: PlanType;
  status: SubStatus;
  startDate: string;
  expiryDate: string | null;
  allowedModules: string[];
  maxUsers: number;
  maxBranches: number;
  maxStorageMb: number;
}
