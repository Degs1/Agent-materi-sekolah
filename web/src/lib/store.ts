import fs from 'fs';
import path from 'path';
import { initDb, Db } from './db';

let db: Db | null = null;

export function getDb(): Db {
  if (!db) {
    const dir = path.join(process.cwd(), 'data');
    fs.mkdirSync(dir, { recursive: true });
    db = initDb(path.join(dir, 'app.db'));
  }
  return db;
}

/** Ekstrak teks dari file lokal: pdf/gambar via Gemini; teks baca langsung. */
export async function extractFileText(filePath: string, mime: string): Promise<string> {
  if (mime === 'text/plain' || mime === 'text/markdown') {
    return fs.readFileSync(filePath, 'utf8');
  }
  const { extractText } = await import('./gemini');
  return extractText(filePath, mime);
}
