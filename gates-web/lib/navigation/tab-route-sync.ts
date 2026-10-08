import { normalizeAppPath } from '@/lib/navigation/app-module-root';

/** Build canonical tab href from App Router pathname + search string. */
export function tabHrefFromRoute(pathname: string | null, searchString: string): string | null {
  if (!pathname) return null;
  const path = normalizeAppPath(pathname);
  return searchString ? `${path}?${searchString}` : path;
}
