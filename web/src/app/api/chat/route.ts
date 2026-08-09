import { NextRequest } from 'next/server';
import { getDb } from '@/lib/store';
import { getSession, getMessages, addMessage } from '@/lib/db';
import { chatStream } from '@/lib/gemini';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  const db = getDb();
  const body = await req.json().catch(() => ({}));
  const sessionId = Number(body?.sessionId);
  const prompt = String(body?.prompt ?? '').trim();
  const materiText = String(body?.materiText ?? '');

  if (!sessionId || !prompt) {
    return new Response(JSON.stringify({ error: 'sessionId dan prompt wajib diisi' }), { status: 400, headers: { 'Content-Type': 'application/json' } });
  }
  if (!getSession(db, sessionId)) {
    return new Response(JSON.stringify({ error: 'Sesi tidak ditemukan' }), { status: 404, headers: { 'Content-Type': 'application/json' } });
  }

  const history = getMessages(db, sessionId).map((m) => ({ role: m.role, content: m.content }));

  addMessage(db, sessionId, 'user', prompt);

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const send = (obj: object) => controller.enqueue(encoder.encode(`data: ${JSON.stringify(obj)}\n\n`));
      try {
        const full = await chatStream(materiText, history, prompt, (chunk) => send({ type: 'chunk', text: chunk }));
        addMessage(db, sessionId, 'assistant', full);
        send({ type: 'done' });
      } catch (e: any) {
        console.error('chat error:', e);
        const isQuota = e?.status === 429 || e?.message?.includes('ResourceExhausted') || e?.message?.includes('quota');
        send({ type: 'error', message: isQuota ? 'Quota Gemini habis, coba lagi nanti' : `Gagal: ${e?.message ?? 'unknown error'}` });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache', Connection: 'keep-alive' },
  });
}
