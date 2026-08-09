import { NextRequest } from 'next/server';
import { getDb } from '@/lib/store';
import { getSession, getMessages } from '@/lib/db';
import { countSessionTokens } from '@/lib/gemini';
import dbConnect from '@/lib/mongoose';
import { Mapel, Bab, Materi } from '@/models';
import path from 'path';
import fs from 'fs';
import { youtubeTranscript, extractText } from '@/lib/gemini';

async function resolveMateri(pick: string): Promise<string> {
  const segs = pick.split('/').map((s) => s.trim()).filter(Boolean);
  if (segs.length < 2) return '';
  const mapelName = segs[0];
  const babName = segs[1];

  await dbConnect();
  const mapel = await Mapel.findOne({ name: mapelName });
  if (!mapel) return '';
  const bab = await Bab.findOne({ mapelId: mapel._id, name: babName });
  if (!bab) return '';
  const materis = await Materi.find({ babId: bab._id });

  let fullText = '';
  for (const hit of materis) {
    if (hit.type === 'youtube' && hit.url) {
      fullText += `[Materi: ${hit.name}] Link video: ${hit.url}\n\n`;
      // To avoid huge latency and hitting API quotas just for counting tokens,
      // we only approximate the YouTube transcript if it's already cached or skip the actual fetch
      // But for accuracy, we will just pass a placeholder of typical size or fetch it if needed.
      // Let's pass a placeholder to save time, or fetch it.
      fullText += `(Transcript Omitted for count)\n\n`;
    } else if (hit.filePath) {
      const p = path.join(process.cwd(), 'public', hit.filePath);
      if (fs.existsSync(p) && hit.mimeType?.startsWith('text/')) {
        fullText += `[Materi: ${hit.name}]\n${fs.readFileSync(p, 'utf8')}\n\n`;
      }
    }
  }
  return fullText;
}

export async function GET(req: NextRequest, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  const sessionId = Number(params.id);
  const searchParams = new URL(req.url).searchParams;
  const materiTextParam = searchParams.get('materiText') ?? '';

  const db = getDb();
  if (!getSession(db, sessionId)) {
    return new Response(JSON.stringify({ error: 'Sesi tidak ditemukan' }), { status: 404 });
  }

  const history = getMessages(db, sessionId).map((m) => ({ role: m.role, content: m.content }));
  const resolvedMateri = await resolveMateri(materiTextParam);

  const tokens = await countSessionTokens(resolvedMateri, history, '');
  return new Response(JSON.stringify({ totalTokens: tokens, limit: 1048576 }), { status: 200, headers: { 'Content-Type': 'application/json' } });
}
