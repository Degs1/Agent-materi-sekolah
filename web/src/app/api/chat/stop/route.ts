import { NextRequest } from 'next/server';
import { activeGenerations } from '@/lib/store';

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const sessionId = Number(body?.sessionId);

  if (!sessionId) {
    return new Response(JSON.stringify({ error: 'sessionId diperlukan' }), { status: 400, headers: { 'Content-Type': 'application/json' } });
  }

  const gen = activeGenerations.get(sessionId);
  if (gen) {
    gen.abort.abort('User stopped generation');
    // Note: The user requested NOT to save partial text, so we just abort and let the POST /api/chat route discard the text.
    return new Response(JSON.stringify({ success: true, message: 'Dihentikan.' }), { status: 200, headers: { 'Content-Type': 'application/json' } });
  }

  return new Response(JSON.stringify({ success: false, message: 'Tidak ada proses berjalan.' }), { status: 404, headers: { 'Content-Type': 'application/json' } });
}
