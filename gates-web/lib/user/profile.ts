export interface UserProfile {
  id: string;
  email: string;
  username: string;
  firstName: string | null;
  lastName: string | null;
  phone: string | null;
  preferredLanguage: string | null;
  avatarUrl: string | null;
  roles: string[];
  companyId: string | null;
  branchId: string | null;
  company: { id: string; arabicName: string; englishName: string | null } | null;
  branches: Array<{ id: string; arabicName: string }>;
  userGroups: Array<{ id: string; code: string | null; arabicName: string }>;
  permissions: Array<{
    resource: string;
    action: string;
    module: string | null;
    branchId: string | null;
    allow: boolean;
  }>;
  /** Present when the API exposes a per-user Day 0 flag. */
  isFirstLogin?: boolean;
  hasCompletedOnboarding?: boolean;
}

export const DEFAULT_AVATAR_SRC = '/avatar.png';

export function formatUserDisplayName(
  profile: Pick<UserProfile, 'firstName' | 'lastName' | 'username' | 'email'>
): string {
  const parts = [profile.firstName, profile.lastName].filter((p) => p && p.trim());
  if (parts.length) return parts.join(' ');
  if (profile.username?.trim()) return profile.username.trim();
  return profile.email?.trim() || '—';
}

export function resolveUserAvatarSrc(avatarUrl: string | null | undefined): string {
  const trimmed = avatarUrl?.trim();
  return trimmed || DEFAULT_AVATAR_SRC;
}
