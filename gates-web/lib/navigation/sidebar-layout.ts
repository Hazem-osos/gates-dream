/** Fixed widths for the right sidebar navigation panel. */
export const SIDEBAR_NAV_COLLAPSED_PX = 80;
export const SIDEBAR_NAV_EXPANDED_PX = 256;

export function sidebarTotalWidthPx(navExpanded: boolean): number {
  return navExpanded ? SIDEBAR_NAV_EXPANDED_PX : SIDEBAR_NAV_COLLAPSED_PX;
}

export function sidebarNavWidthPx(navExpanded: boolean): number {
  return navExpanded ? SIDEBAR_NAV_EXPANDED_PX : SIDEBAR_NAV_COLLAPSED_PX;
}
