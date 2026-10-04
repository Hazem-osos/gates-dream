import type { NextRequest } from 'next/server';
import { proxyBackendRequest } from '@/lib/server/proxy-backend-request';

type Ctx = { params: Promise<{ segment: string }> };

export async function GET(request: NextRequest, ctx: Ctx) {
  const { segment } = await ctx.params;
  return proxyBackendRequest(request, `/health/${segment}`);
}
