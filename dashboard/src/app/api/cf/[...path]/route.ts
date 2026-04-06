import { NextRequest, NextResponse } from 'next/server';

// Server-side only — never exposed to the browser.
const CF_WORKER_URL = process.env.CLOUDFLARE_WORKER_URL ?? '';

export async function POST(
  req: NextRequest,
  ctx: { params: Promise<{ path: string[] }> },
) {
  if (!CF_WORKER_URL) {
    return NextResponse.json(
      { error: 'Cloudflare Worker URL not configured (CLOUDFLARE_WORKER_URL)' },
      { status: 503 },
    );
  }

  const { path } = await ctx.params;
  const pathStr = path?.join('/') ?? '';
  const url = `${CF_WORKER_URL.replace(/\/$/, '')}/${pathStr}`;

  try {
    const body = await req.text();
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body,
    });

    const data = await res.text();
    return new NextResponse(data, {
      status: res.status,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (err) {
    console.error('[api/cf] proxy error:', err);
    return NextResponse.json({ error: 'Cloudflare Worker unavailable' }, { status: 502 });
  }
}
