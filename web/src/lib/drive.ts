import { google } from 'googleapis';
import fs from 'fs';

const SCOPES = ['https://www.googleapis.com/auth/drive.file'];
const ROOT = 'MateriSekolah';

export type DriveClient = ReturnType<typeof google.drive>;

function getAuth() {
  const credsPath = process.env.GOOGLE_SERVICE_ACCOUNT;
  if (!credsPath) throw new Error('GOOGLE_SERVICE_ACCOUNT env tidak di-set (path ke JSON kredensial)');
  const creds = JSON.parse(fs.readFileSync(credsPath, 'utf8'));
  return new google.auth.GoogleAuth({ credentials: creds, scopes: SCOPES });
}

export async function drive(): Promise<DriveClient> {
  const auth = await getAuth();
  return google.drive({ version: 'v3', auth });
}

/** "Matematika/Bab 1" → path segmen; validasi nama folder aman. */
export function validatePathSegments(mapel: string, bab: string) {
  const clean = (s: string) => s.trim().replace(/[\\/:*?"<>|]/g, '-').slice(0, 100);
  const m = clean(mapel), b = clean(bab);
  if (!m || !b) throw new Error('Mapel dan bab wajib diisi');
  return { mapel: m, bab: b };
}

/** Cari folder by path (walk), buat jika belum ada. */
export async function ensureFolder(d: DriveClient, segments: string[], parent?: string): Promise<string> {
  let pid = parent ?? 'root';
  for (const seg of segments) {
    const q = `name = '${seg.replace(/'/g, "\\'")}' and '${pid}' in parents and trashed = false`;
    const { data } = await d.files.list({ q, fields: 'files(id)', pageSize: 1 });
    if (data.files?.length) { pid = data.files[0].id!; continue; }
    const { data: created } = await d.files.create({
      requestBody: { name: seg, mimeType: 'application/vnd.google-apps.folder', parents: [pid] },
      fields: 'id',
    });
    pid = created.id!;
  }
  return pid;
}

/** Upload file → folder bab. Return file id. */
export async function uploadFile(d: DriveClient, filePath: string, fileName: string, mapel: string, bab: string) {
  const { mapel: m, bab: b } = validatePathSegments(mapel, bab);
  const folderId = await ensureFolder(d, [ROOT, m, b]);
  const { data } = await d.files.create({
    requestBody: { name: fileName, parents: [folderId] },
    media: { body: fs.createReadStream(filePath) },
    fields: 'id, webViewLink',
  });
  return data;
}

/** List struktur: [{mapel, babs: [{bab, files: [{name, id, webViewLink}]}]}] */
export async function listMateri(d: DriveClient) {
  const root = await ensureFolder(d, [ROOT]);
  const { data: mapels } = await d.files.list({ q: `'${root}' in parents and trashed = false`, fields: 'files(id,name)', pageSize: 200 });
  const out: { mapel: string; babs: { bab: string; files: { name: string; id: string; webViewLink?: string }[] }[] }[] = [];
  for (const mp of mapels.files ?? []) {
    const { data: babs } = await d.files.list({ q: `'${mp.id}' in parents and trashed = false`, fields: 'files(id,name)', pageSize: 200 });
    const babList: { bab: string; files: { name: string; id: string; webViewLink?: string }[] }[] = [];
    for (const bb of babs.files ?? []) {
      const { data: files } = await d.files.list({ q: `'${bb.id}' in parents and trashed = false`, fields: 'files(id,name,webViewLink)', pageSize: 200 });
      babList.push({
        bab: bb.name ?? '',
        files: (files.files ?? []).map((f) => ({ name: f.name ?? '', id: f.id ?? '', webViewLink: f.webViewLink ?? undefined })),
      });
    }
    out.push({ mapel: mp.name ?? '', babs: babList });
  }
  return out;
}

/** Download file → destPath. */
export async function downloadFile(d: DriveClient, fileId: string, destPath: string) {
  const { data } = await d.files.get({ fileId, alt: 'media' }, { responseType: 'stream' });
  await new Promise<void>((res, rej) => {
    const w = fs.createWriteStream(destPath);
    data.pipe(w).on('finish', () => res()).on('error', rej);
  });
}

/** Retry helper untuk Drive API calls (rate limit dkk). */
export async function withRetry<T>(fn: () => Promise<T>, max = 3): Promise<T> {
  for (let i = 0; ; i++) {
    try { return await fn(); }
    catch (e: any) {
      const code = e?.code || e?.status;
      const retriable = code === 429 || code === 500 || code === 503 || code === 408;
      if (i >= max - 1 || !retriable) throw e;
      await new Promise((r) => setTimeout(r, 1000 * 2 ** i));
    }
  }
}
