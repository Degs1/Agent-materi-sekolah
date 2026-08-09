import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/store';
import { getSession, renameSession, togglePin, deleteSession, getMessages } from '@/lib/db';

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const db = getDb();
  const sid = Number(id);
  const session = getSession(db, sid);
  if (!session) return NextResponse.json({ error: 'Sesi tidak ditemukan' }, { status: 404 });
  return NextResponse.json({ ...session, messages: getMessages(db, sid) });
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const db = getDb();
  const sid = Number(id);
  if (!getSession(db, sid)) return NextResponse.json({ error: 'Sesi tidak ditemukan' }, { status: 404 });

  const body = await req.json().catch(() => ({}));
  if (typeof body?.title === 'string' && body.title.trim()) renameSession(db, sid, body.title.trim());
  if (body?.pin !== undefined) togglePin(db, sid);
  return NextResponse.json({ ok: true });
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const db = getDb();
  deleteSession(db, Number(id));
  return NextResponse.json({ ok: true });
}
