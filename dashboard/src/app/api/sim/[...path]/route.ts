import { NextRequest, NextResponse } from 'next/server';

const SIMULATION_URL = process.env.SIMULATION_URL ?? 'http://localhost:3000';

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

export async function PATCH(
  req: NextRequest,
  ctx: { params: Promise<{ path: string[] }> }
) {
  return proxy('PATCH', ctx, req);
}

async function proxy(
  method: string,
  ctx: { params: Promise<{ path: string[] }> },
  req?: NextRequest
) {
  const { path } = await ctx.params;
  const pathStr = path?.join('/') ?? '';
  const url = `${SIMULATION_URL.replace(/\/$/, '')}/${pathStr}`;

  try {
    const headers = new Headers();
    const skip = new Set(['host', 'expect']);
    req?.headers.forEach((v, k) => {
      if (!skip.has(k.toLowerCase())) headers.set(k, v);
    });

    const body = req && (method === 'POST' || method === 'PATCH')
      ? await req.text()
      : undefined;

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
    console.error('[api/sim] proxy error:', err);
    return NextResponse.json(
      { message: 'Simulation service unavailable' },
      { status: 502 }
    );
  }
}
