/** Public marketing homepage. ERP shell lives at `/dashboard`. */
export function isMarketingPath(pathname: string | null | undefined): boolean {
  return pathname === '/';
}
