import { NextResponse } from 'next/server';
import { drive, listMateri, withRetry } from '@/lib/drive';

export async function GET() {
  try {
    const d = await drive();
    const materi = await withRetry(() => listMateri(d));
    return NextResponse.json(materi);
  } catch (e: any) {
    console.error('materi error:', e);
    return NextResponse.json({ error: e?.message ?? 'Gagal ambil daftar materi' }, { status: 500 });
  }
}
