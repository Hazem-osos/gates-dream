export type InvoiceLinePickRow = {
  itemId?: string;
  quantity?: number;
};

/** أول سطر فارغ، أو أول سطر بنفس الصنف، أو السطر المطلوب. */
export function resolveInvoiceLinePickIndex<T extends InvoiceLinePickRow>(
  lines: T[],
  requestIndex: number,
  itemId: string
): number {
  const id = itemId?.trim();
  if (!id) return requestIndex;
  const duplicateIdx = lines.findIndex((line) => line.itemId?.trim() === id);
  if (duplicateIdx >= 0 && duplicateIdx !== requestIndex) return duplicateIdx;
  const emptyIdx = lines.findIndex((line) => !line.itemId?.trim());
  if (emptyIdx >= 0 && emptyIdx < requestIndex) return emptyIdx;
  return requestIndex;
}

/** يبقي الأسطر المملوءة ثم سطراً فارغاً واحداً في النهاية للإدخال. */
export function compactInvoiceEntryLines<T extends InvoiceLinePickRow>(
  lines: T[],
  makeBlank: () => T
): T[] {
  const filled = lines.filter((line) => Boolean(line.itemId?.trim()));
  if (filled.length === 0) return [makeBlank()];
  return [...filled, makeBlank()];
}

export type PlanInvoiceLineItemPickResult<T extends InvoiceLinePickRow> = {
  lines: T[];
  targetIndex: number;
  /** الصنف كان موجوداً مسبقاً — زِد الكمية فقط دون إعادة تسعير السطر. */
  mergedDuplicate: boolean;
};

export function planInvoiceLineItemPick<T extends InvoiceLinePickRow>(
  lines: T[],
  requestIndex: number,
  itemId: string,
  makeBlank: () => T
): PlanInvoiceLineItemPickResult<T> {
  const id = itemId?.trim();
  if (!id) {
    return { lines, targetIndex: requestIndex, mergedDuplicate: false };
  }

  let next = lines.map((line) => ({ ...line }));
  const duplicateIdx = next.findIndex((line) => line.itemId?.trim() === id);
  if (duplicateIdx >= 0 && duplicateIdx !== requestIndex) {
    const addQty = Number(next[requestIndex]?.quantity) || 1;
    next[duplicateIdx] = {
      ...next[duplicateIdx],
      quantity: (Number(next[duplicateIdx].quantity) || 0) + addQty,
    };
    next[requestIndex] = makeBlank();
    const compacted = compactInvoiceEntryLines(next, makeBlank);
    const targetIndex = compacted.findIndex((line) => line.itemId?.trim() === id);
    return {
      lines: compacted,
      targetIndex: targetIndex >= 0 ? targetIndex : duplicateIdx,
      mergedDuplicate: true,
    };
  }

  const targetIndex = resolveInvoiceLinePickIndex(next, requestIndex, id);
  if (targetIndex !== requestIndex && !next[requestIndex]?.itemId?.trim()) {
    next[requestIndex] = makeBlank();
  }
  const compacted = compactInvoiceEntryLines(next, makeBlank);
  let resolvedTarget = targetIndex;
  if (targetIndex !== requestIndex) {
    const emptyAt = compacted.findIndex((line) => !line.itemId?.trim());
    resolvedTarget = emptyAt >= 0 ? emptyAt : Math.min(targetIndex, compacted.length - 1);
  } else {
    resolvedTarget = Math.min(requestIndex, compacted.length - 1);
  }

  return { lines: compacted, targetIndex: resolvedTarget, mergedDuplicate: false };
}
