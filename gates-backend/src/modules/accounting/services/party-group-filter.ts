export function partyGroupFromQuery(query: {
  customerCategoryId?: unknown;
  supplierCategoryId?: unknown;
}) {
  const customerCategoryId =
    typeof query.customerCategoryId === 'string' && query.customerCategoryId
      ? query.customerCategoryId
      : undefined;
  const supplierCategoryId =
    typeof query.supplierCategoryId === 'string' && query.supplierCategoryId
      ? query.supplierCategoryId
      : undefined;
  return { customerCategoryId, supplierCategoryId };
}

export function applyCustomerGroupWhere(
  where: Record<string, unknown>,
  filters: { customerId?: string; customerCategoryId?: string }
) {
  if (filters.customerId) where.customerId = filters.customerId;
  if (filters.customerCategoryId) {
    const current = (where.customer as Record<string, unknown> | undefined) ?? {};
    where.customer = { ...current, customerCategoryId: filters.customerCategoryId };
  }
}

export function applySupplierGroupWhere(
  where: Record<string, unknown>,
  filters: { supplierId?: string; supplierCategoryId?: string }
) {
  if (filters.supplierId) where.supplierId = filters.supplierId;
  if (filters.supplierCategoryId) {
    const current = (where.supplier as Record<string, unknown> | undefined) ?? {};
    where.supplier = { ...current, supplierCategoryId: filters.supplierCategoryId };
  }
}

export function applyCustomerMasterWhere(
  where: Record<string, unknown>,
  filters: { customerId?: string; customerCategoryId?: string }
) {
  if (filters.customerId) where.id = filters.customerId;
  if (filters.customerCategoryId) where.customerCategoryId = filters.customerCategoryId;
}

export function applySupplierMasterWhere(
  where: Record<string, unknown>,
  filters: { supplierId?: string; supplierCategoryId?: string }
) {
  if (filters.supplierId) where.id = filters.supplierId;
  if (filters.supplierCategoryId) where.supplierCategoryId = filters.supplierCategoryId;
}
