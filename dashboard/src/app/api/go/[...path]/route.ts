import { NextRequest, NextResponse } from 'next/server';

const GO_API_URL = process.env.GO_API_URL ?? 'http://localhost:8080';

export async function GET(
  _req: NextRequest,
  ctx: { params: Promise<{ path: string[] }> }
) {
  return proxy('GET', ctx, undefined);
}

export async function POST(
  req: NextRequest,
  ctx: { params: Promise<{ path: string[] }> }
) {
  return proxy('POST', ctx, req);
}

async function proxy(
  method: string,
  ctx: { params: Promise<{ path: string[] }> },
  req?: NextRequest
) {
  const { path } = await ctx.params;
  const pathStr = path?.join('/') ?? '';
  const url = `${GO_API_URL.replace(/\/$/, '')}/${pathStr}`;

  try {
    const headers = new Headers();
    const skip = new Set(['host', 'expect']);
    req?.headers.forEach((v, k) => {
      if (!skip.has(k.toLowerCase())) headers.set(k, v);
    });

    const body = req && method === 'POST' ? await req.text() : undefined;

    const res = await fetch(url, {
      method,
      headers,
      body,
    });

    const data = await res.text();
    return new NextResponse(data, {
      status: res.status,
      statusText: res.statusText,
      headers: {
        'Content-Type': res.headers.get('Content-Type') ?? 'application/json',
      },
    });
  } catch (err) {
    console.error('[api/go] proxy error:', err);
    return NextResponse.json(
      { message: 'Go API unavailable' },
      { status: 502 }
    );
  }
}
