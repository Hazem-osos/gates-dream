import { isPrivateOrLocalIp, resolveClientIp } from '../../shared/http/client-ip';

describe('client IP', () => {
  it('treats loopback and RFC1918 as private', () => {
    expect(isPrivateOrLocalIp('127.0.0.1')).toBe(true);
    expect(isPrivateOrLocalIp('10.1.2.3')).toBe(true);
    expect(isPrivateOrLocalIp('192.168.1.9')).toBe(true);
    expect(isPrivateOrLocalIp('41.38.210.41')).toBe(false);
  });

  it('prefers x-real-ip over the shared Railway hop', () => {
    const req = {
      headers: {
        'x-real-ip': '41.38.210.41',
        'x-forwarded-for': '41.38.210.41, 79.127.178.81',
      },
      ip: '79.127.178.82',
      socket: { remoteAddress: '10.238.1.2' },
    } as any;
    expect(resolveClientIp(req)).toEqual({ ip: '41.38.210.41', sharedProxy: false });
  });

  it('does not treat a proxy-only address as a client to block', () => {
    const req = {
      headers: {},
      ip: '79.127.178.82',
      socket: { remoteAddress: '10.238.1.2' },
    } as any;
    expect(resolveClientIp(req).sharedProxy).toBe(true);
  });
});
