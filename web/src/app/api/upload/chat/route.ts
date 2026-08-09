import { NextRequest } from 'next/server';
import path from 'path';
import fs from 'fs';

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const file = formData.get('file') as File | null;
    if (!file) return new Response(JSON.stringify({ error: 'File tidak ada' }), { status: 400 });

    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);

    const uploadsDir = path.join(process.cwd(), 'public', 'uploads', 'chat');
    if (!fs.existsSync(uploadsDir)) {
      fs.mkdirSync(uploadsDir, { recursive: true });
    }

    const uniqueName = Date.now() + '-' + file.name.replace(/[^a-zA-Z0-9.-]/g, '_');
    const dest = path.join(uploadsDir, uniqueName);
    fs.writeFileSync(dest, buffer);

    const url = `/uploads/chat/${uniqueName}`;

    return new Response(JSON.stringify({ success: true, url, mime: file.type }), { status: 200, headers: { 'Content-Type': 'application/json' } });
  } catch (e: any) {
    return new Response(JSON.stringify({ error: e.message }), { status: 500, headers: { 'Content-Type': 'application/json' } });
  }
}
