/** Empty or missing picker selection means show every column (first paint / no saved prefs). */
export function isReportColumnVisible(visibleIds: string[] | undefined, id: string): boolean {
  return !visibleIds?.length || visibleIds.includes(id);
}
