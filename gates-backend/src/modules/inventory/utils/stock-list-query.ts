export function resolveStockListPaging(query: {
  page?: number;
  limit?: number;
  skip?: number;
  take?: number;
}): { skip: number; take: number } {
  const take = query.take ?? query.limit ?? 50;
  const skip =
    query.page != null ? Math.max(0, (query.page - 1) * take) : query.skip ?? 0;
  return { skip, take };
}
