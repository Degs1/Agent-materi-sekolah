import { NextRequest } from 'next/server';
import { getDb } from '@/lib/store';
import { getSession, getMessages, addMessage } from '@/lib/db';
import { chatStream, youtubeTranscript, extractText } from '@/lib/gemini';
import dbConnect from '@/lib/mongoose';
import { Mapel, Bab, Materi } from '@/models';
import path from 'path';
import fs from 'fs';

export const dynamic = 'force-dynamic';

/** "Matematika/Bab 1" → cari di MongoDB */
async function resolveMateri(pick: string): Promise<string> {
  const segs = pick.split('/').map((s) => s.trim()).filter(Boolean);
  if (segs.length < 2) return '';
  const mapelName = segs[0];
  const babName = segs[1];

  await dbConnect();
  const mapel = await Mapel.findOne({ name: mapelName });
  if (!mapel) return `(mapel "${mapelName}" tidak ditemukan)`;
  
  const bab = await Bab.findOne({ mapelId: mapel._id, name: babName });
  if (!bab) return `(bab "${babName}" tidak ditemukan)`;

  const materis = await Materi.find({ babId: bab._id });
  if (materis.length === 0) return `(materi untuk "${pick}" kosong)`;

  let fullText = '';
  for (const hit of materis) {
    // If text/transcript is already pre-extracted in MongoDB, use it instantly!
    if (hit.extractedText) {
      fullText += `[Materi: ${hit.name}]\n${hit.extractedText}\n\n`;
      continue;
    }

    // Fallback: extract on the fly and cache to MongoDB for future queries
    if (hit.type === 'youtube' && hit.url) {
      const transcript = await youtubeTranscript(hit.url);
      hit.extractedText = transcript;
      await hit.save();
      fullText += `[Materi: ${hit.name}] Link video: ${hit.url}\n${transcript}\n\n`;
    } else if (hit.filePath) {
      const p = path.join(process.cwd(), 'public', hit.filePath);
      if (fs.existsSync(p)) {
        let text = '';
        if (hit.mimeType?.startsWith('text/')) {
          text = fs.readFileSync(p, 'utf8');
        } else {
          text = await extractText(p, hit.mimeType!);
        }
        hit.extractedText = text;
        await hit.save();
        fullText += `[Materi: ${hit.name}]\n${text}\n\n`;
      } else {
        fullText += `[Materi: ${hit.name}] (file tidak ditemukan di server)\n\n`;
      }
    }
  }
  return fullText || `(tidak ada teks yang bisa diekstrak dari "${pick}")`;
}

import { activeGenerations } from '@/lib/store';

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

  // Parse inline attachments from history and prompt (e.g. ![Image](/uploads/chat/xyz.jpg))
  const historyRaw = getMessages(db, sessionId);
  const history = historyRaw.map((m) => {
    let parts: any[] = [];
    let textContent = m.content;
    const imgRegex = /!\[.*?\]\(\/uploads\/chat\/(.*?)\)/g;
    let match;
    while ((match = imgRegex.exec(m.content)) !== null) {
      const filename = match[1];
      const p = path.join(process.cwd(), 'public', 'uploads', 'chat', filename);
      if (fs.existsSync(p)) {
        const mime = filename.endsWith('.png') ? 'image/png' : filename.endsWith('.pdf') ? 'application/pdf' : 'image/jpeg';
        parts.push({ inlineData: { mimeType: mime, data: fs.readFileSync(p).toString('base64') } });
      }
    }
    parts.push({ text: textContent });
    return { role: m.role, content: m.content, parts };
  });

  const inlineAttachments: any[] = [];
  const imgRegex = /!\[.*?\]\(\/uploads\/chat\/(.*?)\)/g;
  let match;
  while ((match = imgRegex.exec(prompt)) !== null) {
    const filename = match[1];
    const p = path.join(process.cwd(), 'public', 'uploads', 'chat', filename);
    if (fs.existsSync(p)) {
      const mime = filename.endsWith('.png') ? 'image/png' : filename.endsWith('.pdf') ? 'application/pdf' : 'image/jpeg';
      inlineAttachments.push({ inlineData: { mimeType: mime, data: fs.readFileSync(p).toString('base64') } });
    }
  }

  addMessage(db, sessionId, 'user', prompt);

  const abortController = new AbortController();
  activeGenerations.set(sessionId, { text: '', abort: abortController });

  const encoder = new TextEncoder();
  let clientConnected = true;

  const stream = new ReadableStream({
    async start(controller) {
      const send = (obj: object) => {
        if (!clientConnected) return;
        try { controller.enqueue(encoder.encode(`data: ${JSON.stringify(obj)}\n\n`)); } 
        catch (e) { clientConnected = false; }
      };

      // Run generation in background (detached)
      (async () => {
        try {
          const resolved = await resolveMateri(materiText);
          send({ type: 'meta', materia: resolved });
          
          const full = await chatStream(resolved, history, prompt, (chunk) => {
            const gen = activeGenerations.get(sessionId);
            if (gen) gen.text += chunk;
            send({ type: 'chunk', text: chunk });
          }, abortController.signal, inlineAttachments);
          
          addMessage(db, sessionId, 'assistant', full);
          send({ type: 'done' });
        } catch (e: any) {
          console.error('chat error:', e);
          if (e.name === 'AbortError' || e.message?.includes('abort')) {
            // User explicitly requested to stop (via Stop button). We DO NOT save partial text per user's request!
            send({ type: 'error', message: 'Dihentikan.' });
          } else {
            const isQuota = e?.status === 429 || e?.message?.includes('ResourceExhausted') || e?.message?.includes('quota');
            send({ type: 'error', message: isQuota ? 'Quota Gemini habis, coba lagi nanti' : `Gagal: ${e?.message ?? 'unknown error'}` });
          }
        } finally {
          activeGenerations.delete(sessionId);
          if (clientConnected) {
            try { controller.close(); } catch(e){}
          }
        }
      })();
    },
    cancel() {
      // Client closed the tab. 
      // Do NOT abort the generation. Just mark client as disconnected.
      clientConnected = false;
    }
  });

  return new Response(stream, {
    headers: { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache', Connection: 'keep-alive' },
  });
}
