/**
 * Item 37 (Phase 6): verifies the Prisma tenant-scoping extension actually
 * enforces isolation — a query that "forgets" its own companyId filter
 * (or is simply wrong) must fail closed under an active tenant context,
 * and every code path with no active tenant context (scripts, seeds,
 * this test file's own setup/teardown) must behave exactly as before the
 * extension existed.
 */
import { prisma } from '../../shared/database/prisma';
import { runWithTenantContext, runWithoutTenantScoping } from '../../shared/database/tenant-context';

describe('Tenant-scoping Prisma extension', () => {
  let companyA: string;
  let companyB: string;
  let customerA: string;
  let customerB: string;

  beforeAll(async () => {
    const suffix = String(Date.now());
    const [a, b] = await Promise.all([
      prisma.company.create({
        data: { arabicName: `Tenant Scoping A ${suffix}`, englishName: `Tenant Scoping A ${suffix}`, isActive: true },
      }),
      prisma.company.create({
        data: { arabicName: `Tenant Scoping B ${suffix}`, englishName: `Tenant Scoping B ${suffix}`, isActive: true },
      }),
    ]);
    companyA = a.id;
    companyB = b.id;

    // Created with no active tenant context — should pass through
    // unfiltered/unstamped, exactly like before the extension existed.
    const [custA, custB] = await Promise.all([
      prisma.customer.create({ data: { companyId: companyA, arabicName: `Customer A ${suffix}` } }),
      prisma.customer.create({ data: { companyId: companyB, arabicName: `Customer B ${suffix}` } }),
    ]);
    customerA = custA.id;
    customerB = custB.id;
  });

  afterAll(async () => {
    await prisma.customer.deleteMany({ where: { companyId: { in: [companyA, companyB] } } });
    await prisma.company.deleteMany({ where: { id: { in: [companyA, companyB] } } });
  });

  it('outside any tenant context, queries are unfiltered (backward-compatible with scripts/seeds)', async () => {
    const found = await prisma.customer.findUnique({ where: { id: customerA } });
    expect(found?.id).toBe(customerA);
  });

  it('findUnique fails closed on a row belonging to a different company', async () => {
    const result = await runWithTenantContext(companyB, () =>
      // A "forgot to filter by companyId" bug: this where clause alone would
      // normally find customerA regardless of which company is asking.
      prisma.customer.findUnique({ where: { id: customerA } })
    );
    expect(result).toBeNull();
  });

  it('findFirst fails closed on a row belonging to a different company', async () => {
    const result = await runWithTenantContext(companyB, () =>
      prisma.customer.findFirst({ where: { id: customerA } })
    );
    expect(result).toBeNull();
  });

  it('findUnique succeeds for a row that does belong to the current tenant', async () => {
    const result = await runWithTenantContext(companyA, () =>
      prisma.customer.findUnique({ where: { id: customerA } })
    );
    expect(result?.id).toBe(customerA);
  });

  it('updateMany affects zero rows when the target belongs to a different company', async () => {
    const result = await runWithTenantContext(companyB, () =>
      prisma.customer.updateMany({
        where: { id: customerA },
        data: { arabicName: 'Should not apply' },
      })
    );
    expect(result.count).toBe(0);

    const unchanged = await prisma.customer.findUnique({ where: { id: customerA } });
    expect(unchanged?.arabicName).not.toBe('Should not apply');
  });

  it('deleteMany affects zero rows when the target belongs to a different company', async () => {
    const result = await runWithTenantContext(companyB, () =>
      prisma.customer.deleteMany({ where: { id: customerA } })
    );
    expect(result.count).toBe(0);

    const stillThere = await prisma.customer.findUnique({ where: { id: customerA } });
    expect(stillThere?.id).toBe(customerA);
  });

  it('count only sees rows within the current tenant', async () => {
    const countA = await runWithTenantContext(companyA, () =>
      prisma.customer.count({ where: { id: { in: [customerA, customerB] } } })
    );
    expect(countA).toBe(1);
  });

  it('create auto-stamps companyId from the active tenant context when omitted', async () => {
    const created = await runWithTenantContext(companyA, () =>
      prisma.customer.create({ data: { arabicName: 'Auto-stamped customer' } as never })
    );
    expect(created.companyId).toBe(companyA);
    await prisma.customer.delete({ where: { id: created.id } });
  });

  it('create overrides an explicitly-provided companyId with the active tenant context (Wave 1 fix)', async () => {
    // Regression test for the company-copy cross-tenant write hole: a caller-supplied
    // companyId must never win over the current request's own tenant context.
    const created = await runWithTenantContext(companyA, () =>
      prisma.customer.create({ data: { companyId: companyB, arabicName: 'Context always wins' } })
    );
    expect(created.companyId).toBe(companyA);
    await prisma.customer.delete({ where: { id: created.id } });
  });

  it('runWithoutTenantScoping bypasses enforcement for legitimate cross-tenant reads', async () => {
    const result = await runWithTenantContext(companyB, () =>
      runWithoutTenantScoping(() => prisma.customer.findUnique({ where: { id: customerA } }))
    );
    expect(result?.id).toBe(customerA);
  });

  it('leaves non-tenant-scoped models (e.g. Company) untouched', async () => {
    const result = await runWithTenantContext(companyB, () =>
      prisma.company.findUnique({ where: { id: companyA } })
    );
    expect(result?.id).toBe(companyA);
  });
});
