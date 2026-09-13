import prisma from '../../../shared/database/prisma';
import type { UserUiPreferencesInput } from '../schemas/user-ui-preferences.schema';

export type StoredPageFavorite = {
  href: string;
  label: string;
  starredAt: number;
};

export type StoredSavedView = {
  id: string;
  name: string;
  filters: Record<string, string | number | boolean | null>;
  createdAt: number;
};

export type UserUiPreferences = {
  pageFavorites: StoredPageFavorite[];
  savedViewsByScreen: Record<string, StoredSavedView[]>;
};

function entryName(userId: string) {
  return `ui_prefs:${userId}`.slice(0, 100);
}

function parseValue(raw: string | null | undefined): UserUiPreferences {
  if (!raw) return { pageFavorites: [], savedViewsByScreen: {} };
  try {
    const parsed = JSON.parse(raw) as UserUiPreferences;
    if (!parsed || !Array.isArray(parsed.pageFavorites)) {
      return { pageFavorites: [], savedViewsByScreen: parsed?.savedViewsByScreen ?? {} };
    }
    return {
      pageFavorites: parsed.pageFavorites.filter(
        (f) => f && typeof f.href === 'string' && typeof f.label === 'string'
      ),
      savedViewsByScreen:
        parsed.savedViewsByScreen && typeof parsed.savedViewsByScreen === 'object'
          ? parsed.savedViewsByScreen
          : {},
    };
  } catch {
    return { pageFavorites: [], savedViewsByScreen: {} };
  }
}

export class UserUiPreferencesService {
  async get(companyId: string, userId: string): Promise<UserUiPreferences> {
    const row = await prisma.companySettingEntry.findFirst({
      where: { companyId, branchId: null, name: entryName(userId) },
      select: { value: true },
    });
    return parseValue(row?.value);
  }

  async save(
    companyId: string,
    userId: string,
    input: UserUiPreferencesInput
  ): Promise<UserUiPreferences> {
    const current = await this.get(companyId, userId);
    const next: UserUiPreferences = {
      pageFavorites:
        input.pageFavorites !== undefined ? input.pageFavorites : current.pageFavorites,
      savedViewsByScreen:
        input.savedViewsByScreen !== undefined
          ? input.savedViewsByScreen
          : current.savedViewsByScreen,
    };
    const value = JSON.stringify(next);
    const existing = await prisma.companySettingEntry.findFirst({
      where: { companyId, branchId: null, name: entryName(userId) },
      select: { id: true },
    });
    if (existing) {
      await prisma.companySettingEntry.update({ where: { id: existing.id }, data: { value } });
    } else {
      await prisma.companySettingEntry.create({ data: { companyId, name: entryName(userId), value } });
    }
    return next;
  }
}

export const userUiPreferencesService = new UserUiPreferencesService();
