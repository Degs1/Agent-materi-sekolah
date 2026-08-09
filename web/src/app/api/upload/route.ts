import { NextRequest, NextResponse } from 'next/server';
import { drive, uploadFile, withRetry } from '@/lib/drive';
import fs from 'fs';
import path from 'path';
import os from 'os';

const ALLOWED = {
  pdf: 'application/pdf',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  webp: 'image/webp',
  txt: 'text/plain',
  md: 'text/markdown',
};
const MAX_SIZE = 50 * 1024 * 1024; // 50MB
const YT_RE = /^(https?:\/\/)?(www\.)?(youtube\.com|youtu\.be)\//i;

export async function POST(req: NextRequest) {
  try {
    const form = await req.formData();
    const mapel = String(form.get('mapel') ?? '').trim();
    const bab = String(form.get('bab') ?? '').trim();
    const file = form.get('file');
    const ytUrl = String(form.get('ytUrl') ?? '').trim();

    if (!mapel || !bab) {
      return NextResponse.json({ error: 'Mapel dan bab wajib diisi' }, { status: 400 });
    }

    // Upload file
    if (file && file instanceof File) {
      const ext = (file.name.split('.').pop() ?? '').toLowerCase();
      const mime = ALLOWED[ext as keyof typeof ALLOWED];
      if (!mime) return NextResponse.json({ error: `Format .${ext} tidak didukung` }, { status: 400 });
      if (file.size > MAX_SIZE) return NextResponse.json({ error: 'File melebihi 50MB' }, { status: 400 });

      const tmp = path.join(os.tmpdir(), `${Date.now()}-${file.name}`);
      fs.writeFileSync(tmp, Buffer.from(await file.arrayBuffer()));
      const d = await drive();
      const res = await withRetry(() => uploadFile(d, tmp, file.name, mapel, bab));
      fs.rmSync(tmp, { force: true });
      return NextResponse.json({ ok: true, fileId: res.id });
    }

    // Link YouTube
    if (ytUrl) {
      if (!YT_RE.test(ytUrl)) return NextResponse.json({ error: 'URL YouTube tidak valid' }, { status: 400 });
      const d = await drive();
      const res = await withRetry(() => uploadFile(d, ytUrl, `youtube-${Date.now()}.txt`, mapel, bab));
      return NextResponse.json({ ok: true, fileId: res.id, note: 'Link disimpan, transkrip diambil saat chat' });
    }

    return NextResponse.json({ error: 'Tidak ada file atau link YouTube' }, { status: 400 });
  } catch (e: any) {
    console.error('upload error:', e);
    return NextResponse.json({ error: e?.message ?? 'Upload gagal' }, { status: 500 });
  }
}
