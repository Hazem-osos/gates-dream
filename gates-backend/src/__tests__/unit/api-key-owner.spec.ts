/**
 * Security: POST /api/v1/api-keys used to take `userId` from the request body, so a caller
 * could mint a key in another user's name. The key now always belongs to the caller.
 */
const createAPIKey = jest.fn(async (input: unknown) => ({ key: 'gates_x', apiKey: input }));

jest.mock('../../shared/middleware/auth.middleware', () => ({
  authenticate: (_req: unknown, _res: unknown, next: () => void) => next(),
}));
jest.mock('../../shared/middleware/authorize.middleware', () => ({
  authorize: () => (_req: unknown, _res: unknown, next: () => void) => next(),
}));
jest.mock('../../shared/middleware/validate', () => ({
  validate: () => (_req: unknown, _res: unknown, next: () => void) => next(),
}));
jest.mock('../../shared/database/prisma', () => ({ prisma: {} }));
jest.mock('../../shared/security/api-key-manager', () => ({
  createAPIKey: (input: unknown) => createAPIKey(input),
  listAPIKeys: jest.fn(),
  revokeAPIKey: jest.fn(),
  rotateAPIKey: jest.fn(),
  resolveApiKeyTenantId: (session: string | undefined) => ({ tenantId: session }),
}));

import router from '../../modules/common/routes/api-key.routes';

type Layer = { route?: { path: string; methods: Record<string, boolean>; stack: Array<{ handle: Function }> } };

function postHandler() {
  const layer = (router as unknown as { stack: Layer[] }).stack.find(
    (l) => l.route?.path === '/' && l.route.methods.post
  );
  const stack = layer!.route!.stack;
  return stack[stack.length - 1].handle;
}

async function post(body: Record<string, unknown>) {
  const res = { statusCode: 200, body: undefined as unknown } as {
    statusCode: number;
    body: unknown;
    status: (c: number) => typeof res;
    json: (b: unknown) => typeof res;
  };
  res.status = (c) => ((res.statusCode = c), res);
  res.json = (b) => ((res.body = b), res);
  const req = { body, user: { sub: 'me' }, companyId: 'co-a', tenantId: 'co-a' };
  await postHandler()(req, res, jest.fn());
  return res;
}

beforeEach(() => createAPIKey.mockClear());

describe('POST /api-keys owner', () => {
  it('creates the key for the caller', async () => {
    const res = await post({ name: 'n8n', permissions: ['automation:internal'] });
    expect(res.statusCode).toBe(201);
    expect(createAPIKey).toHaveBeenCalledWith(expect.objectContaining({ userId: 'me', tenantId: 'co-a' }));
  });

  it('refuses a body userId naming another user', async () => {
    const res = await post({ name: 'n8n', permissions: [], userId: 'someone-else' });
    expect(res.statusCode).toBe(403);
    expect(createAPIKey).not.toHaveBeenCalled();
  });

  it('accepts a body userId equal to the caller', async () => {
    const res = await post({ name: 'n8n', permissions: [], userId: 'me' });
    expect(res.statusCode).toBe(201);
  });
});
