/**
 * Security: /metrics and /health need no login. In production, /metrics needs a bearer
 * token, /health hides dependency error text, and GraphQL can no longer skip its
 * complexity check by naming a query "IntrospectionQuery".
 */
import {
  metricsAccessAllowed,
  publicHealthView,
} from '../../shared/monitoring/public-endpoints';

jest.mock('../../shared/graphql/schema', () => ({ graphqlSchema: {} }));
jest.mock('graphql-http/lib/use/express', () => ({ createHandler: () => () => undefined }));
jest.mock('../../shared/middleware/auth.middleware', () => ({ authenticate: jest.fn() }));
jest.mock('../../shared/middleware/tenant.middleware', () => ({ setTenantContext: jest.fn() }));

import { skipComplexityCheck } from '../../shared/graphql/handler';

describe('metricsAccessAllowed', () => {
  const TOKEN = 'm'.repeat(40);

  it('stays open outside production', () => {
    expect(metricsAccessAllowed(undefined, { NODE_ENV: 'development' })).toBe(true);
  });

  it('is closed in production when no token is configured', () => {
    expect(metricsAccessAllowed(`Bearer ${TOKEN}`, { NODE_ENV: 'production' })).toBe(false);
  });

  it('needs the exact bearer token in production', () => {
    const env = { NODE_ENV: 'production', METRICS_TOKEN: TOKEN };
    expect(metricsAccessAllowed(undefined, env)).toBe(false);
    expect(metricsAccessAllowed('Bearer wrong', env)).toBe(false);
    expect(metricsAccessAllowed(TOKEN, env)).toBe(false);
    expect(metricsAccessAllowed(`Bearer ${TOKEN}`, env)).toBe(true);
  });
});

describe('publicHealthView', () => {
  const health = {
    status: 'unhealthy',
    timestamp: '2026-10-28T00:00:00.000Z',
    uptime: 123,
    checks: {
      database: { status: 'unhealthy', error: "Can't reach database server at mysql.railway.internal:3306" },
      redis: { status: 'healthy', responseTime: 2 },
    },
  };

  it('drops error text and uptime in production', () => {
    const view = publicHealthView(health, true);
    expect(JSON.stringify(view)).not.toContain('railway.internal');
    expect(view).toEqual({
      status: 'unhealthy',
      timestamp: health.timestamp,
      checks: { database: { status: 'unhealthy' }, redis: { status: 'healthy', responseTime: 2 } },
    });
  });

  it('keeps full detail outside production', () => {
    expect(publicHealthView(health, false)).toBe(health);
  });
});

describe('GraphQL complexity check', () => {
  it('cannot be skipped by naming a query IntrospectionQuery in production', () => {
    expect(skipComplexityCheck('IntrospectionQuery', 'production')).toBe(false);
  });

  it('lets local tools introspect', () => {
    expect(skipComplexityCheck('IntrospectionQuery', 'development')).toBe(true);
    expect(skipComplexityCheck('GetInvoices', 'development')).toBe(false);
  });
});
