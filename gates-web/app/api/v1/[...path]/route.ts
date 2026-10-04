import type { NextRequest } from 'next/server';
import { proxyBackendRequest } from '@/lib/server/proxy-backend-request';

type Ctx = { params: Promise<{ path: string[] }> };

async function handle(request: NextRequest, ctx: Ctx) {
  const { path } = await ctx.params;
  const suffix = path?.length ? path.join('/') : '';
  return proxyBackendRequest(request, `/api/v1/${suffix}`);
}

export const GET = handle;
export const POST = handle;
export const PUT = handle;
export const PATCH = handle;
export const DELETE = handle;
export const OPTIONS = handle;
