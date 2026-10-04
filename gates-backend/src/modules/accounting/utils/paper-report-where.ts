/** Opening securities stay unposted on purpose; they still belong on paper reports. */
export function paperSideWheres(
  where: Record<string, unknown>,
  accountIds?: string[],
  showUnposted?: boolean
) {
  const { isPosted, ...shared } = where;
  const receiptWhere: Record<string, unknown> = {
    ...shared,
    ...(showUnposted ? {} : { OR: [{ isPosted: true }, { isOpening: true }] }),
  };
  const paymentWhere: Record<string, unknown> = {
    ...shared,
    ...(showUnposted || isPosted === undefined ? {} : { isPosted }),
  };
  if (accountIds?.length) {
    receiptWhere.AND = [
      {
        OR: [
          { destinationAccountId: { in: accountIds } },
          { depositAccountId: { in: accountIds } },
        ],
      },
    ];
    paymentWhere.destinationAccountId = { in: accountIds };
  }
  return { receiptWhere, paymentWhere };
}

export function openingPaperStatus(isOpening?: boolean | null, _isPosted?: boolean | null): string | null {
  if (isOpening) return 'افتتاحية';
  return null;
}

type AccountLabel = { code?: string | null; arabicName?: string | null } | null | undefined;

export function formatPaperAccountLabel(account?: AccountLabel): string | null {
  if (!account) return null;
  const name = String(account.arabicName ?? '').trim();
  const code = String(account.code ?? '').trim();
  if (code && name) return `[${code}] ${name}`;
  return name || code || null;
}

export function paperReportAccountName(input: {
  partyAccount?: AccountLabel;
  partyLedgerAccount?: AccountLabel;
  notesAccount?: AccountLabel;
  partyName?: string | null;
}): string | null {
  return (
    formatPaperAccountLabel(input.partyAccount) ||
    formatPaperAccountLabel(input.partyLedgerAccount) ||
    formatPaperAccountLabel(input.notesAccount) ||
    String(input.partyName ?? '').trim() ||
    null
  );
}
