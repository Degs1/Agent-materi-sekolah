import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import dbConnect from '@/lib/mongoose';
import { Mapel, Bab, Materi } from '@/models';
import { extractText, youtubeTranscript } from '@/lib/gemini';

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
    await dbConnect();
    const form = await req.formData();
    const mapelId = String(form.get('mapelId') ?? '').trim();
    const babId = String(form.get('babId') ?? '').trim();
    const file = form.get('file');
    const ytUrl = String(form.get('ytUrl') ?? '').trim();

    if (!mapelId || !babId) {
      return NextResponse.json({ error: 'mapelId dan babId wajib diisi' }, { status: 400 });
    }

    // Verify Mapel & Bab exist
    const mapel = await Mapel.findById(mapelId);
    const bab = await Bab.findById(babId);
    if (!mapel || !bab) {
      return NextResponse.json({ error: 'Mapel atau Bab tidak ditemukan' }, { status: 404 });
    }

    // Upload file
    if (file && file instanceof File) {
      const ext = (file.name.split('.').pop() ?? '').toLowerCase();
      const mime = ALLOWED[ext as keyof typeof ALLOWED];
      if (!mime) return NextResponse.json({ error: `Format .${ext} tidak didukung` }, { status: 400 });
      if (file.size > MAX_SIZE) return NextResponse.json({ error: 'File melebihi 50MB' }, { status: 400 });

      const uploadDir = path.join(process.cwd(), 'public', 'uploads');
      if (!fs.existsSync(uploadDir)) {
        fs.mkdirSync(uploadDir, { recursive: true });
      }

      const fileName = `${Date.now()}-${file.name.replace(/[^a-zA-Z0-9.-]/g, '_')}`;
      const filePath = path.join(uploadDir, fileName);
      
      const buffer = Buffer.from(await file.arrayBuffer());
      fs.writeFileSync(filePath, buffer);

      // Pre-extract text for fast chat queries
      let extractedText = '';
      if (mime.startsWith('text/')) {
        extractedText = fs.readFileSync(filePath, 'utf8');
      } else {
        try {
          extractedText = await extractText(filePath, mime);
        } catch (err) {
          console.error('Extraction error on upload:', err);
        }
      }

      const materi = await Materi.create({
        mapelId,
        babId,
        name: file.name,
        type: 'file',
        mimeType: mime,
        filePath: `/uploads/${fileName}`,
        extractedText,
      });

      return NextResponse.json({ ok: true, fileId: materi._id });
    }

    // Link YouTube
    if (ytUrl) {
      if (!YT_RE.test(ytUrl)) return NextResponse.json({ error: 'URL YouTube tidak valid' }, { status: 400 });
      
      let extractedText = '';
      try {
        extractedText = await youtubeTranscript(ytUrl);
      } catch (err) {
        console.error('YouTube transcript error on upload:', err);
      }

      const materi = await Materi.create({
        mapelId,
        babId,
        name: `youtube-${Date.now()}`,
        type: 'youtube',
        url: ytUrl,
        extractedText,
      });

      return NextResponse.json({ ok: true, fileId: materi._id, note: 'Link & transkrip disimpan.' });
    }

    return NextResponse.json({ error: 'Tidak ada file atau link YouTube' }, { status: 400 });
  } catch (e: any) {
    console.error('upload error:', e);
    return NextResponse.json({ error: e?.message ?? 'Upload gagal' }, { status: 500 });
  }
}
