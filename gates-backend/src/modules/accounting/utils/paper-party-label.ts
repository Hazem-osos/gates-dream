export function firstNonEmpty(...values: Array<string | null | undefined>): string {
  for (const value of values) {
    const text = String(value ?? '').trim();
    if (text) return text;
  }
  return '';
}

export function paperPartyLabel(row: {
  payeeName?: string | null;
  issuerName?: string | null;
  supplier?: { arabicName?: string | null; code?: string | null } | null;
  customer?: { arabicName?: string | null; code?: string | null } | null;
  partyAccount?: { arabicName?: string | null; code?: string | null } | null;
}): string {
  return firstNonEmpty(
    row.payeeName,
    row.issuerName,
    row.supplier?.arabicName,
    row.customer?.arabicName,
    row.partyAccount?.arabicName
      ? row.partyAccount.code
        ? `[${row.partyAccount.code}] ${row.partyAccount.arabicName}`
        : row.partyAccount.arabicName
      : ''
  );
}

export async function resolveStoredPartyName(
  lookup: {
    supplierName?: (id: string) => Promise<string | null | undefined>;
    customerName?: (id: string) => Promise<string | null | undefined>;
    accountLabel?: (id: string) => Promise<string | null | undefined>;
  },
  data: {
    payeeName?: string | null;
    issuerName?: string | null;
    supplierId?: string | null;
    customerId?: string | null;
    partyAccountId?: string | null;
  }
): Promise<string | undefined> {
  const stored = firstNonEmpty(data.payeeName, data.issuerName);
  if (stored) return stored;
  if (data.supplierId && lookup.supplierName) {
    const name = firstNonEmpty(await lookup.supplierName(data.supplierId));
    if (name) return name;
  }
  if (data.customerId && lookup.customerName) {
    const name = firstNonEmpty(await lookup.customerName(data.customerId));
    if (name) return name;
  }
  if (data.partyAccountId && lookup.accountLabel) {
    const name = firstNonEmpty(await lookup.accountLabel(data.partyAccountId));
    if (name) return name;
  }
  return undefined;
}

export async function attachPartyDisplayNames<
  T extends {
    payeeName?: string | null;
    issuerName?: string | null;
    partyAccountId?: string | null;
    supplier?: { arabicName?: string | null } | null;
    customer?: { arabicName?: string | null } | null;
  },
>(
  rows: T[],
  findAccounts: (
    ids: string[]
  ) => Promise<Array<{ id: string; code: string | null; arabicName: string | null }>>
): Promise<Array<T & { partyDisplayName: string }>> {
  const missingIds = [
    ...new Set(
      rows
        .filter((row) => !paperPartyLabel(row) && row.partyAccountId)
        .map((row) => String(row.partyAccountId))
    ),
  ];
  const accounts = missingIds.length ? await findAccounts(missingIds) : [];
  const byId = new Map(accounts.map((account) => [account.id, account]));
  return rows.map((row) => ({
    ...row,
    partyDisplayName: paperPartyLabel({
      ...row,
      partyAccount: row.partyAccountId ? byId.get(row.partyAccountId) ?? null : null,
    }),
  }));
}
