import { NextRequest, NextResponse } from 'next/server';
import dbConnect from '@/lib/mongoose';
import { Bab } from '@/models';

export async function GET(req: NextRequest) {
  try {
    const mapelId = req.nextUrl.searchParams.get('mapelId');
    if (!mapelId) {
      return NextResponse.json({ error: 'mapelId wajib diisi' }, { status: 400 });
    }
    await dbConnect();
    const babs = await Bab.find({ mapelId }).sort({ createdAt: 1 });
    return NextResponse.json(babs);
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? 'Gagal mengambil bab' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const { mapelId, name } = await req.json();
    if (!mapelId || !name?.trim()) {
      return NextResponse.json({ error: 'mapelId dan nama bab wajib diisi' }, { status: 400 });
    }
    await dbConnect();
    const bab = await Bab.create({ mapelId, name: name.trim() });
    return NextResponse.json(bab);
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? 'Gagal membuat bab' }, { status: 500 });
  }
}
