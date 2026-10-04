import { NextRequest, NextResponse } from 'next/server';
import { resolveBackendOrigin } from './backend-origin';

const hopByHop = new Set([
  'connection',
  'keep-alive',
  'proxy-authenticate',
  'proxy-authorization',
  'te',
  'trailers',
  'transfer-encoding',
  'upgrade',
  'host',
]);

function forwardRequestHeaders(request: NextRequest): Headers {
  const headers = new Headers();
  request.headers.forEach((value, key) => {
    if (hopByHop.has(key.toLowerCase())) return;
    headers.set(key, value);
  });
  return headers;
}

function forwardResponseHeaders(upstream: Response): Headers {
  const headers = new Headers();
  upstream.headers.forEach((value, key) => {
    if (hopByHop.has(key.toLowerCase())) return;
    headers.append(key, value);
  });
  return headers;
}

export async function proxyBackendRequest(
  request: NextRequest,
  upstreamPath: string
): Promise<NextResponse> {
  const origin = resolveBackendOrigin();
  const url = new URL(upstreamPath, origin);
  url.search = request.nextUrl.search;

  const init: RequestInit = {
    method: request.method,
    headers: forwardRequestHeaders(request),
    redirect: 'manual',
  };
  if (request.method !== 'GET' && request.method !== 'HEAD') {
    init.body = await request.arrayBuffer();
  }

  let upstream: Response;
  try {
    upstream = await fetch(url, init);
  } catch {
    return NextResponse.json(
      {
        status: 'error',
        message: 'تعذر الاتصال بالخادم. حاول تحديث الصفحة بعد قليل.',
      },
      { status: 502 }
    );
  }

  return new NextResponse(upstream.body, {
    status: upstream.status,
    headers: forwardResponseHeaders(upstream),
  });
}
