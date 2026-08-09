import { NextResponse } from 'next/server';
import dbConnect from '@/lib/mongoose';
import { Mapel, Bab, Materi } from '@/models';

export async function GET() {
  try {
    await dbConnect();
    
    // Fetch all mapels
    const mapels = await Mapel.find({}).sort({ createdAt: 1 });
    const babs = await Bab.find({}).sort({ createdAt: 1 });
    const materis = await Materi.find({}).sort({ createdAt: 1 });

    const result = mapels.map((mapel) => {
      const mapelBabs = babs.filter(b => b.mapelId.toString() === mapel._id.toString());
      return {
        _id: mapel._id,
        mapel: mapel.name,
        babs: mapelBabs.map((bab) => {
          const babMateris = materis.filter(m => m.babId.toString() === bab._id.toString());
          return {
            _id: bab._id,
            bab: bab.name,
            files: babMateris.map(m => ({
              id: m._id,
              name: m.name,
              webViewLink: m.url || undefined,
              type: m.type,
              extractedText: m.extractedText || undefined
            }))
          };
        })
      };
    });

    return NextResponse.json(result);
  } catch (e: any) {
    console.error('materi error:', e);
    return NextResponse.json({ error: e?.message ?? 'Gagal ambil daftar materi' }, { status: 500 });
  }
}
