/**
 * Test Helper Utilities
 * Common utilities for testing
 */

import { PrismaClient } from '@prisma/client';

export interface TestContext {
  prisma: PrismaClient;
  companyId: string;
  userId: string;
}

/**
 * Create test company
 */
export async function createTestCompany(prisma: PrismaClient): Promise<string> {
  const company = await prisma.company.create({
    data: {
      arabicName: 'شركة اختبار',
      englishName: 'Test Company',
      isActive: true,
    },
  });
  return company.id;
}

/**
 * Create test user
 */
export async function createTestUser(
  prisma: PrismaClient,
  companyId: string
): Promise<string> {
  const user = await prisma.user.create({
    data: {
      companyId,
      email: `test-${Date.now()}@example.com`,
      username: `testuser-${Date.now()}`,
      passwordHash: 'hashed_password',
      isActive: true,
    },
  });
  return user.id;
}

/**
 * Clean up test data
 */
export async function cleanupTestData(
  prisma: PrismaClient,
  companyId: string
): Promise<void> {
  // Delete in reverse order of dependencies
  await prisma.user.deleteMany({ where: { companyId } });
  await prisma.company.delete({ where: { id: companyId } });
}

/**
 * Mock request object
 */
export function createMockRequest(overrides: any = {}): any {
  return {
    headers: {},
    body: {},
    query: {},
    params: {},
    user: null,
    companyId: null,
    tenantId: null,
    ...overrides,
  };
}

/**
 * Mock response object
 */
export function createMockResponse(): any {
  const res: any = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  res.send = jest.fn().mockReturnValue(res);
  res.setHeader = jest.fn().mockReturnValue(res);
  return res;
}

