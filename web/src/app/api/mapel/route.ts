import { NextRequest, NextResponse } from 'next/server';
import dbConnect from '@/lib/mongoose';
import { Mapel } from '@/models';

export async function GET() {
  try {
    await dbConnect();
    const mapels = await Mapel.find({}).sort({ createdAt: 1 });
    return NextResponse.json(mapels);
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? 'Gagal mengambil mapel' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const { name } = await req.json();
    if (!name?.trim()) {
      return NextResponse.json({ error: 'Nama mapel wajib diisi' }, { status: 400 });
    }
    await dbConnect();
    const mapel = await Mapel.create({ name: name.trim() });
    return NextResponse.json(mapel);
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? 'Gagal membuat mapel' }, { status: 500 });
  }
}
