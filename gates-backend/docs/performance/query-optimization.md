# Query Optimization Guide

## Overview

This guide covers database query optimization strategies for the Gates ERP system.

## Index Strategy

### Existing Indexes

The system includes indexes on:
- Foreign keys
- Frequently queried columns
- Composite indexes for common patterns

### Adding Composite Indexes

See `src/shared/database/composite-indexes.sql` for recommended composite indexes.

**Common Patterns:**
- Company + Date (for date range queries)
- Company + Status (for filtering by status)
- Company + Active (for active records)

### Index Maintenance

```sql
-- Check index usage
SELECT schemaname, tablename, indexname, idx_scan, idx_tup_read, idx_tup_fetch
FROM pg_stat_user_indexes
ORDER BY idx_scan;

-- Find unused indexes
SELECT schemaname, tablename, indexname
FROM pg_stat_user_indexes
WHERE idx_scan = 0
AND indexname NOT LIKE 'pg_toast%';
```

## Query Performance Monitoring

### Slow Query Logging

Slow queries (>200ms) are automatically logged. Review logs for:
- Query patterns
- Missing indexes
- N+1 query problems

### Query Metrics

Prometheus metrics track:
- Query duration
- Query count by model/operation
- Error rates

Access metrics at `/metrics` endpoint.

## Common Optimization Patterns

### 1. Use Select Specific Fields

```typescript
// ❌ Bad: Selects all fields
const users = await prisma.user.findMany();

// ✅ Good: Select only needed fields
const users = await prisma.user.findMany({
  select: {
    id: true,
    name: true,
    email: true,
  },
});
```

### 2. Use Pagination

```typescript
// ✅ Use cursor-based pagination for large datasets
const { items, nextCursor } = applyCursorPagination(data, {
  cursor: req.query.cursor,
  limit: 50,
});
```

### 3. Avoid N+1 Queries

```typescript
// ❌ Bad: N+1 queries
const invoices = await prisma.invoice.findMany();
for (const invoice of invoices) {
  const customer = await prisma.customer.findUnique({
    where: { id: invoice.customerId },
  });
}

// ✅ Good: Use include
const invoices = await prisma.invoice.findMany({
  include: {
    customer: true,
  },
});
```

### 4. Use Transactions for Bulk Operations

```typescript
// ✅ Use transaction for multiple operations
await prisma.$transaction(async (tx) => {
  await tx.invoice.create({ data: invoiceData });
  await tx.journalEntry.create({ data: journalData });
});
```

### 5. Use Raw Queries for Complex Reports

```typescript
// ✅ Use raw SQL for complex aggregations
const report = await prisma.$queryRaw`
  SELECT 
    account_id,
    SUM(debit) as total_debit,
    SUM(credit) as total_credit
  FROM journal_entry_lines
  WHERE company_id = ${companyId}
  GROUP BY account_id
`;
```

## Materialized Views

For heavy reports, consider materialized views:

```sql
CREATE MATERIALIZED VIEW account_balances AS
SELECT 
  a.id as account_id,
  a.company_id,
  COALESCE(SUM(jel.debit), 0) - COALESCE(SUM(jel.credit), 0) as balance
FROM accounts a
LEFT JOIN journal_entry_lines jel ON jel.account_id = a.id
GROUP BY a.id, a.company_id;

CREATE INDEX ON account_balances(company_id);
CREATE INDEX ON account_balances(account_id);

-- Refresh periodically
REFRESH MATERIALIZED VIEW CONCURRENTLY account_balances;
```

## Connection Pooling

### Prisma Connection Pool

Configure via DATABASE_URL:
```
postgresql://user:password@host:5432/db?connection_limit=10&pool_timeout=20
```

### pgBouncer

For production, use pgBouncer:
- Transaction pooling mode
- Connection limit: 100-200
- Pool size: 25 per server

## Read Replicas

For read-heavy workloads (reports):

```typescript
// Use read replica for reports
const prismaRead = new PrismaClient({
  datasources: {
    db: {
      url: process.env.DATABASE_READ_REPLICA_URL,
    },
  },
});
```

## Query Analysis

### EXPLAIN ANALYZE

```sql
EXPLAIN ANALYZE
SELECT * FROM invoices
WHERE company_id = 1
AND date >= '2024-01-01'
ORDER BY date DESC;
```

### Common Issues

1. **Sequential Scans**: Add indexes
2. **High Cost**: Optimize query or add indexes
3. **Nested Loops**: Consider join order
4. **Sort Operations**: Add index on ORDER BY columns

## Best Practices

1. **Always use indexes** for WHERE, JOIN, ORDER BY clauses
2. **Limit result sets** with pagination
3. **Use transactions** for related operations
4. **Monitor slow queries** regularly
5. **Review query plans** for complex queries
6. **Use read replicas** for reports
7. **Cache frequently accessed data**

## Performance Checklist

- [ ] Indexes on foreign keys
- [ ] Composite indexes for common patterns
- [ ] Pagination for large datasets
- [ ] Avoid N+1 queries
- [ ] Use transactions for bulk operations
- [ ] Monitor slow queries
- [ ] Use read replicas for reports
- [ ] Cache frequently accessed data

---

**Last Updated**: Based on current implementation
