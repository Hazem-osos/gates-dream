import { permissionGrantedFromCache } from '../../shared/cache/tenant-context.cache';

describe('attendance permission aliases', () => {
  const snap = {
    grantAll: false,
    permissions: [{ resource: 'attendance', action: 'edit', allow: true, module: 'hr', branchId: null }],
  };

  it('legacy edit satisfies manage via alias check', () => {
    expect(permissionGrantedFromCache(snap, 'attendance', 'edit')).toBe(true);
    expect(permissionGrantedFromCache(snap, 'attendance', 'manage')).toBe(false);
  });
});
