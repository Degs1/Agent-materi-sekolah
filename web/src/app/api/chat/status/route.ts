import { NextRequest } from 'next/server';
import { activeGenerations } from '@/lib/store';

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const sessionId = Number(searchParams.get('sessionId'));

  if (!sessionId) {
    return new Response(JSON.stringify({ error: 'sessionId diperlukan' }), { status: 400, headers: { 'Content-Type': 'application/json' } });
  }

  const gen = activeGenerations.get(sessionId);
  if (gen) {
    return new Response(JSON.stringify({ active: true, text: gen.text }), { status: 200, headers: { 'Content-Type': 'application/json' } });
  }

  return new Response(JSON.stringify({ active: false }), { status: 200, headers: { 'Content-Type': 'application/json' } });
}
