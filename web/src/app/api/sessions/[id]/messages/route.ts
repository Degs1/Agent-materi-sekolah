import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/store';
import { getSession, getMessages } from '@/lib/db';

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const db = getDb();
  const sid = Number(id);
  if (!getSession(db, sid)) return NextResponse.json({ error: 'Sesi tidak ditemukan' }, { status: 404 });
  return NextResponse.json(getMessages(db, sid));
}
