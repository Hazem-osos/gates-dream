const PREFIX = '{"salesOrderLine":';

export function packSalesOrderLineNotes(specifications: string, imageUrl?: string): string {
  const specs = specifications.trim();
  if (!imageUrl?.trim()) return specs;
  return JSON.stringify({
    salesOrderLine: { specifications: specs, imageUrl: imageUrl.trim() },
  });
}

export function unpackSalesOrderLineNotes(raw: string | null | undefined): {
  specifications: string;
  imageUrl?: string;
} {
  const text = String(raw ?? '').trim();
  if (!text.startsWith(PREFIX)) {
    return { specifications: text };
  }
  try {
    const parsed = JSON.parse(text) as {
      salesOrderLine?: { specifications?: string; imageUrl?: string };
    };
    const block = parsed.salesOrderLine;
    return {
      specifications: block?.specifications?.trim() ?? '',
      imageUrl: block?.imageUrl?.trim() || undefined,
    };
  } catch {
    return { specifications: text };
  }
}
