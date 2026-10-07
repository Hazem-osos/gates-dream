import type {
  AccountOption,
  CostCenterOption,
  ItemOption,
  PartyOption,
  WarehouseOption,
} from '@/lib/hooks/useMasterDataQueries';

const AR = 'ar';

/** Ascending string compare — Arabic-aware, numeric codes (e.g. 2 before 10). */
export function compareStringsAsc(a: string, b: string): number {
  return a.localeCompare(b, AR, { sensitivity: 'base', numeric: true });
}

export function compareByCodeAndArabicName(
  codeA: string | null | undefined,
  nameA: string,
  codeB: string | null | undefined,
  nameB: string
): number {
  const ca = String(codeA ?? '').trim();
  const cb = String(codeB ?? '').trim();
  if (ca && cb) {
    const byCode = compareStringsAsc(ca, cb);
    if (byCode !== 0) return byCode;
  } else if (ca && !cb) return -1;
  else if (!ca && cb) return 1;
  return compareStringsAsc(nameA.trim(), nameB.trim());
}

type LabeledPickerOption = { value: string; label: string };

/** Empty `value` options stay first (placeholders). */
export function sortComboboxOptions<T extends LabeledPickerOption>(options: T[]): T[] {
  const placeholders = options.filter((o) => !o.value);
  const rest = options.filter((o) => o.value);
  rest.sort((a, b) => compareStringsAsc(a.label, b.label));
  return [...placeholders, ...rest];
}

export function sortAccountOptions(accounts: AccountOption[]): AccountOption[] {
  return [...accounts].sort((a, b) =>
    compareByCodeAndArabicName(a.code, a.arabicName, b.code, b.arabicName)
  );
}

export function sortItemOptions(items: ItemOption[]): ItemOption[] {
  return [...items].sort((a, b) =>
    compareByCodeAndArabicName(a.code || a.serial, a.arabicName, b.code || b.serial, b.arabicName)
  );
}

export function sortWarehouseOptions(warehouses: WarehouseOption[]): WarehouseOption[] {
  return [...warehouses].sort((a, b) =>
    compareByCodeAndArabicName(a.code, a.arabicName, b.code, b.arabicName)
  );
}

export function sortPartyOptions(parties: PartyOption[]): PartyOption[] {
  return [...parties].sort((a, b) =>
    compareByCodeAndArabicName(a.code, a.arabicName, b.code, b.arabicName)
  );
}

export function sortCostCenterOptions(centers: CostCenterOption[]): CostCenterOption[] {
  return [...centers].sort((a, b) =>
    compareByCodeAndArabicName(a.code, a.arabicName, b.code, b.arabicName)
  );
}

export function sortByArabicName<T extends { arabicName?: string | null; name?: string | null }>(
  rows: T[]
): T[] {
  return [...rows].sort((a, b) =>
    compareStringsAsc(String(a.arabicName ?? a.name ?? ''), String(b.arabicName ?? b.name ?? ''))
  );
}
