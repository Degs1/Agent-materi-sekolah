import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/store';
import { createSession, listSessions, searchSessions } from '@/lib/db';

export async function GET(req: NextRequest) {
  const db = getDb();
  const q = req.nextUrl.searchParams.get('q')?.trim();
  const sessions = q ? searchSessions(db, q) : listSessions(db);
  return NextResponse.json(sessions);
}

export async function POST(req: NextRequest) {
  const db = getDb();
  const body = await req.json().catch(() => ({}));
  const title = String(body?.title ?? '').trim() || 'Sesi Baru';
  const id = createSession(db, title);
  return NextResponse.json({ id, title }, { status: 201 });
}
