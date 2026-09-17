import { DocumentEditLeaseService, DocumentOccupiedError } from '../../modules/platform/services/document-edit-lease.service';

describe('document edit lease', () => {
  const service = new DocumentEditLeaseService();

  it('lets the first session keep the document and blocks the second', async () => {
    const first = await service.acquire({
      companyId: 'c1',
      resourceKey: '/accounting/vouchers:doc-1',
      userId: 'u1',
      sessionId: 's1',
      userName: 'أحمد',
    });
    expect(first.granted).toBe(true);

    await expect(
      service.acquire({
        companyId: 'c1',
        resourceKey: '/accounting/vouchers:doc-1',
        userId: 'u2',
        sessionId: 's2',
        userName: 'سارة',
      })
    ).rejects.toBeInstanceOf(DocumentOccupiedError);

    await service.release({
      companyId: 'c1',
      resourceKey: '/accounting/vouchers:doc-1',
      userId: 'u1',
      sessionId: 's1',
    });

    const second = await service.acquire({
      companyId: 'c1',
      resourceKey: '/accounting/vouchers:doc-1',
      userId: 'u2',
      sessionId: 's2',
      userName: 'سارة',
    });
    expect(second.granted).toBe(true);
  });

  it('lets the same user refresh the lease from another session', async () => {
    await service.acquire({
      companyId: 'c1',
      resourceKey: '/accounting/vouchers:doc-2',
      userId: 'u1',
      sessionId: 's1',
      userName: 'أحمد',
    });

    const again = await service.acquire({
      companyId: 'c1',
      resourceKey: '/accounting/vouchers:doc-2',
      userId: 'u1',
      sessionId: 's2',
      userName: 'أحمد',
    });
    expect(again.granted).toBe(true);
  });
});
