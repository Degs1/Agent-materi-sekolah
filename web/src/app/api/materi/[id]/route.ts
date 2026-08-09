import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import dbConnect from '@/lib/mongoose';
import { Materi } from '@/models';

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await dbConnect();
    const { id } = await params;
    
    const materi = await Materi.findById(id);
    if (!materi) {
      return NextResponse.json({ error: 'Materi tidak ditemukan' }, { status: 404 });
    }

    // Delete the file from the filesystem if it exists
    if (materi.filePath) {
      const p = path.join(process.cwd(), 'public', materi.filePath);
      if (fs.existsSync(p)) {
        fs.unlinkSync(p);
      }
    }

    // Delete from DB
    await Materi.findByIdAndDelete(id);

    return NextResponse.json({ ok: true, message: 'Materi berhasil dihapus' });
  } catch (e: any) {
    console.error('Delete materi error:', e);
    return NextResponse.json({ error: e?.message ?? 'Gagal menghapus materi' }, { status: 500 });
  }
}
