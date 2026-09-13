import {
  allowedCategoriesForRoles,
  canReceiveNotification,
  normalizeCallerRoles,
} from '../../modules/ai/sentinel/notification-rbac';

describe('RBAC AI notification isolation', () => {
  it('lets a warehouse keeper see only stock / expiry / unposted drafts', () => {
    const roles = normalizeCallerRoles(['WAREHOUSE_KEEPER']);
    expect(allowedCategoriesForRoles(roles).sort()).toEqual(
      ['EXPIRING_BATCH', 'STOCK_REORDER', 'UNPOSTED_DRAFTS'].sort()
    );
  });

  it('never leaks a financial liquidity alert to warehouse even if targetRoles is poisoned', () => {
    const roles = normalizeCallerRoles(['WAREHOUSE_KEEPER']);
    expect(
      canReceiveNotification({
        callerRoles: roles,
        callerUserId: 'wh-1',
        category: 'FINANCIAL_LIQUIDITY',
        targetRoles: ['WAREHOUSE_KEEPER', 'OWNER'],
        userId: null,
      })
    ).toBe(false);
    expect(
      canReceiveNotification({
        callerRoles: roles,
        callerUserId: 'wh-1',
        category: 'PROFIT_ANOMALY',
        targetRoles: ['OWNER'],
        userId: null,
      })
    ).toBe(false);
  });

  it('lets warehouse receive genuine stock reorder alerts that also include OWNER', () => {
    const roles = normalizeCallerRoles(['WAREHOUSE_KEEPER']);
    expect(
      canReceiveNotification({
        callerRoles: roles,
        callerUserId: 'wh-1',
        category: 'STOCK_REORDER',
        targetRoles: ['WAREHOUSE_KEEPER', 'PURCHASING_MANAGER', 'OWNER'],
        userId: null,
      })
    ).toBe(true);
  });

  it('lets OWNER / SUPER_ADMIN see liquidity and discount audits', () => {
    const owner = normalizeCallerRoles(['OWNER']);
    const admin = normalizeCallerRoles(['SUPER_ADMIN']);
    expect(allowedCategoriesForRoles(owner)).toEqual(
      expect.arrayContaining(['FINANCIAL_LIQUIDITY', 'PROFIT_ANOMALY', 'CHEQUE_DUE'])
    );
    expect(
      canReceiveNotification({
        callerRoles: admin,
        callerUserId: 'owner-1',
        category: 'PROFIT_ANOMALY',
        targetRoles: ['OWNER', 'SUPER_ADMIN'],
        userId: null,
      })
    ).toBe(true);
  });

  it('does not let accountant see owner-only profit anomalies', () => {
    const roles = normalizeCallerRoles(['ACCOUNTANT']);
    expect(allowedCategoriesForRoles(roles)).not.toContain('PROFIT_ANOMALY');
    expect(allowedCategoriesForRoles(roles)).toEqual(
      expect.arrayContaining(['CHEQUE_DUE', 'UNPOSTED_DRAFTS'])
    );
  });
});
