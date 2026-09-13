# Tenant Isolation Setup Guide (MySQL)

## Overview

MySQL doesn't support Row-Level Security (RLS) like PostgreSQL. Tenant isolation is handled at the **application level** by filtering all queries with `companyId`. This ensures users can only access data belonging to their company/tenant.

## Prerequisites

- MySQL 8.0+
- Prisma schema with `companyId` on all tenant-aware tables
- Keycloak authentication configured
- `setTenantContext` middleware applied to routes

## How Application-Level Tenant Isolation Works

1. **Middleware Validation**: When a user authenticates, the `setTenantContext` middleware validates the company exists and is active
2. **Request Context**: The middleware stores `companyId` in the request object (`req.companyId`)
3. **Service-Level Filtering**: All service queries must explicitly filter by `companyId` in WHERE clauses
4. **Data Separation**: Each company's data is isolated through application logic, not database policies

## Setup Steps

### 1. Prisma Schema

Ensure all tenant-aware tables have `companyId`:

```prisma
model Invoice {
  id        String   @id @default(uuid())
  companyId String   // Required for tenant isolation
  // ... other fields

  company Company @relation(fields: [companyId], references: [id], onDelete: Cascade)

  @@index([companyId])
  @@map("invoices")
}
```

### 2. Tenant Middleware

The `setTenantContext` middleware validates and sets tenant context:

```typescript
// src/shared/middleware/tenant.middleware.ts
export const setTenantContext = async (req, res, next) => {
  const tenantId = req.tenantId || req.companyId;
  
  // Validate company exists and is active
  const company = await prisma.company.findUnique({
    where: { id: tenantId },
    select: { id: true, isActive: true },
  });

  if (!company || !company.isActive) {
    throw new AppError(403, 'Company not found or inactive');
  }

  // Store in request for use in services
  req.companyId = tenantId;
  next();
};
```

### 3. Apply Middleware to Routes

Apply the middleware to all routes that need tenant isolation:

```typescript
// In route files
router.use(authenticate);
router.use(setTenantContext); // Must come after authenticate

// Now req.companyId is available in all route handlers
```

### 4. Service-Level Filtering

**CRITICAL**: All service queries must filter by `companyId`:

```typescript
// ✅ CORRECT - Filters by companyId
async getInvoices(companyId: string) {
  return await prisma.invoice.findMany({
    where: {
      companyId, // Required for tenant isolation
      // ... other filters
    },
  });
}

// ❌ WRONG - Missing companyId filter
async getInvoices() {
  return await prisma.invoice.findMany(); // Will return all companies' data!
}
```

### 5. Best Practices

#### Always Include companyId in Queries

```typescript
// ✅ Good: Explicit companyId filter
const invoices = await prisma.invoice.findMany({
  where: { companyId: req.companyId },
});

// ✅ Good: Using Prisma relation filter
const invoices = await prisma.company
  .findUnique({ where: { id: req.companyId } })
  .invoices();

// ❌ Bad: Missing companyId
const invoices = await prisma.invoice.findMany(); // Security risk!
```

#### Use Type-Safe Request Objects

```typescript
interface AuthRequest extends Request {
  companyId: string;
  tenantId: string;
  branchId?: string;
}

// In route handlers
router.get('/invoices', async (req: AuthRequest, res) => {
  const invoices = await invoiceService.getInvoices(req.companyId);
  res.json(invoices);
});
```

#### Validate in Service Layer

```typescript
async getInvoice(id: string, companyId: string) {
  const invoice = await prisma.invoice.findFirst({
    where: { id, companyId }, // Filter by both id AND companyId
  });

  if (!invoice) {
    throw new AppError(404, 'Invoice not found');
  }

  return invoice;
}
```

## Testing Tenant Isolation

### Unit Tests

```typescript
describe('Tenant Isolation', () => {
  it('should only return invoices for company1', async () => {
    // Create invoices for different companies
    await createInvoice({ companyId: 'company1' });
    await createInvoice({ companyId: 'company2' });

    // Query as company1
    const invoices = await getInvoices('company1');
    
    expect(invoices).toHaveLength(1);
    expect(invoices[0].companyId).toBe('company1');
  });
});
```

### Integration Tests

```typescript
it('should isolate data between tenants', async () => {
  // Login as company1 user
  const token1 = await loginAsCompany1();
  
  // Create invoice for company1
  await createInvoice(token1);
  
  // Switch to company2
  const token2 = await loginAsCompany2();
  
  // Should not see company1's invoice
  const invoices = await getInvoices(token2);
  expect(invoices).not.toContain(company1Invoice);
});
```

## Common Pitfalls

### 1. Missing companyId Filter

```typescript
// ❌ WRONG
const items = await prisma.item.findMany();

// ✅ CORRECT
const items = await prisma.item.findMany({
  where: { companyId: req.companyId },
});
```

### 2. Raw Queries Without Filtering

```typescript
// ❌ WRONG
const result = await prisma.$queryRaw`
  SELECT * FROM invoices;
`;

// ✅ CORRECT
const result = await prisma.$queryRaw`
  SELECT * FROM invoices WHERE company_id = ${req.companyId};
`;
```

### 3. Forgetting companyId in Updates/Deletes

```typescript
// ❌ WRONG - Could delete other company's data
await prisma.invoice.delete({ where: { id } });

// ✅ CORRECT
await prisma.invoice.delete({
  where: { id, companyId: req.companyId },
});
```

## Performance Considerations

### Indexes

Ensure `companyId` is indexed on all tenant-aware tables:

```prisma
model Invoice {
  // ...
  @@index([companyId])
  @@index([companyId, date]) // Composite index for common queries
}
```

### Query Optimization

Use composite indexes for common query patterns:

```sql
-- Composite index for company + date queries
CREATE INDEX idx_invoices_company_date 
ON invoices(company_id, date DESC);
```

## Migration from PostgreSQL RLS

If migrating from PostgreSQL with RLS:

1. **Remove RLS Policies**: No database-level policies needed
2. **Update Middleware**: Remove `SET app.tenant_id` session variable calls
3. **Add companyId Filters**: Ensure all queries filter by `companyId`
4. **Test Thoroughly**: Verify no data leaks between tenants

## Troubleshooting

### Users Can See Other Tenants' Data

- Check middleware is applied: `router.use(setTenantContext)`
- Verify services filter by `companyId`
- Check raw queries include `companyId` filter
- Review service implementations for missing filters

### Performance Issues

- Add indexes on `companyId` columns
- Use composite indexes for common query patterns
- Review query plans with `EXPLAIN`

### Missing companyId in Request

- Ensure `setTenantContext` middleware runs after `authenticate`
- Check authentication middleware sets `req.companyId`
- Verify user has associated company

## Summary

- ✅ **Application-level filtering** - All queries filter by `companyId`
- ✅ **Middleware validation** - Validates company exists and is active
- ✅ **Type-safe** - Use TypeScript interfaces for request objects
- ✅ **Indexed** - `companyId` columns are indexed for performance
- ✅ **Tested** - Unit and integration tests verify isolation

**Remember**: Tenant isolation is enforced at the application level. Always filter by `companyId` in every query!

