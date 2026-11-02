import { NextResponse } from 'next/server';
import { lookup } from '@/lib/gemini';

const err = (status: number, code: string, message: string, extra = {}) =>
  NextResponse.json({ error: { code, message, ...extra } }, { status });

export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  const query = typeof body?.query === 'string' ? body.query.trim() : '';
  if (!query || query.length > 100) {
    return err(400, 'bad_query', 'query must be 1–100 characters');
  }

  try {
    return NextResponse.json(await lookup(query));
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    const status = (e as { status?: number })?.status;
    if (status === 429) return err(429, 'rate_limited', message);
    if (e instanceof SyntaxError || (e as { name?: string })?.name === 'ZodError') {
      return err(502, 'bad_model_output', message);
    }
    return err(500, 'internal', message);
  }
}
