# Materi Sekolah Agent — Implementation Plan

> **For Hermes:** Use subagent-driven-development skill to implement this plan task-by-task.

**Goal:** Sistem simpan materi sekolah (PDF/foto/teks/YouTube) per mapel & bab di Google Drive, plus agent AI (Gemini) dengan chat + session system, web app (Next.js) dan Hermes skill.

**Architecture:** Google Drive = database materi (struktur folder `MateriSekolah/<Mapel>/<Bab>/` + `meta.json`), SQLite = chat history, Gemini API = ekstraksi + chat + grounding (web search fallback). Dua permukaan: web app Next.js (deploy Ubuntu, private) dan Hermes skill (pakai `gws` CLI + Gemini key sama).

**Tech Stack:** Next.js 15 (App Router, TypeScript), better-sqlite3, googleapis (Drive), @google/genai (Gemini), Tailwind, Vitest. Deploy: Linux Ubuntu, Next.js standalone.

**Referensi desain:** `docs/superpowers/specs/2026-08-09-materi-sekolah-agent-design.md`

---

## Phase 0 — Scaffold

### Task 0.1: Init Next.js project

**Objective:** Project Next.js TypeScript kosong dengan git.

**Files:**
- Create: seluruh scaffold di `C:\Users\USER\materi-sekolah-agent\web\`

**Step 1: Scaffold**

```bash
cd ~/materi-sekolah-agent && npx create-next-app@latest web --ts --tailwind --eslint --app --src-dir --no-import-alias --use-npm --yes
```

**Step 2: Install deps**

```bash
cd web && npm i better-sqlite3 googleapis @google/genai && npm i -D vitest @types/better-sqlite3
```

**Step 3: Verifikasi**

```bash
cd web && npm run build
```
Expected: build sukses.

**Step 4: Commit**

```bash
cd ~/materi-sekolah-agent && git add -A && git commit -m "feat: scaffold Next.js web app"
```

---

## Phase 1 — SQLite + Session System (TDD)

### Task 1.1: Schema SQLite

**Objective:** Tabel `sessions` & `messages` dibuat via modul `db.ts`.

**Files:**
- Create: `web/src/lib/db.ts`
- Create: `web/src/lib/db.test.ts`

**Step 1: Failing test** — `db.ts` belum ada → test gagal.

```ts
// db.test.ts
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { initDb, createSession, listSessions, getSession, renameSession, deleteSession, togglePin, searchSessions, addMessage, getMessages } from './db';

const DB_PATH = ':memory:';

describe('db', () => {
  it('creates session and lists it', () => {
    const db = initDb(DB_PATH);
    const id = createSession(db, 'Quiz Fisika');
    const list = listSessions(db);
    expect(list).toHaveLength(1);
    expect(list[0].title).toBe('Quiz Fisika');
    expect(list[0].pinned).toBe(0);
  });

  it('renames, pins, deletes', () => {
    const db = initDb(DB_PATH);
    const id = createSession(db, 'A');
    renameSession(db, id, 'B');
    togglePin(db, id);
    expect(getSession(db, id)?.title).toBe('B');
    expect(getSession(db, id)?.pinned).toBe(1);
    deleteSession(db, id);
    expect(getSession(db, id)).toBeUndefined();
  });

  it('stores messages per session', () => {
    const db = initDb(DB_PATH);
    const id = createSession(db, 'S');
    addMessage(db, id, 'user', 'apa itu fotosintesis?');
    addMessage(db, id, 'assistant', 'fotosintesis adalah...');
    const msgs = getMessages(db, id);
    expect(msgs).toHaveLength(2);
    expect(msgs[0].role).toBe('user');
  });

  it('searches within session messages', () => {
    const db = initDb(DB_PATH);
    const id = createSession(db, 'S');
    addMessage(db, id, 'user', 'jelaskan hukum newton');
    const hits = searchSessions(db, 'newton');
    expect(hits[0].id).toBe(id);
  });
});
```

**Step 2: Run** — `npx vitest run src/lib/db.test.ts` → FAIL (module missing).

**Step 3: Implement** — `web/src/lib/db.ts`:

```ts
import Database from 'better-sqlite3';

export type Db = Database.Database;

export function initDb(path: string): Db {
  const db = new Database(path);
  db.exec(`
    CREATE TABLE IF NOT EXISTS sessions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      pinned INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE TABLE IF NOT EXISTS messages (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      session_id INTEGER NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
      role TEXT NOT NULL CHECK (role IN ('user','assistant')),
      content TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
  `);
  return db;
}

export function createSession(db: Db, title = 'Sesi Baru'): number {
  const r = db.prepare('INSERT INTO sessions (title) VALUES (?)').run(title);
  return Number(r.lastInsertRowid);
}

export function listSessions(db: Db) {
  return db.prepare('SELECT * FROM sessions ORDER BY pinned DESC, updated_at DESC').all();
}

export function getSession(db: Db, id: number) {
  return db.prepare('SELECT * FROM sessions WHERE id = ?').get(id);
}

export function renameSession(db: Db, id: number, title: string) {
  db.prepare('UPDATE sessions SET title = ?, updated_at = datetime(\'now\') WHERE id = ?').run(title, id);
}

export function togglePin(db: Db, id: number) {
  db.prepare('UPDATE sessions SET pinned = 1 - pinned, updated_at = datetime(\'now\') WHERE id = ?').run(id);
}

export function deleteSession(db: Db, id: number) {
  db.prepare('DELETE FROM sessions WHERE id = ?').run(id);
}

export function addMessage(db: Db, sessionId: number, role: 'user' | 'assistant', content: string) {
  db.prepare('INSERT INTO messages (session_id, role, content) VALUES (?, ?, ?)').run(sessionId, role, content);
  db.prepare('UPDATE sessions SET updated_at = datetime(\'now\') WHERE id = ?').run(sessionId);
}

export function getMessages(db: Db, sessionId: number) {
  return db.prepare('SELECT * FROM messages WHERE session_id = ? ORDER BY id').all(sessionId);
}

export function searchSessions(db: Db, q: string) {
  return db.prepare(
    'SELECT DISTINCT s.* FROM sessions s JOIN messages m ON m.session_id = s.id WHERE m.content LIKE ? ORDER BY s.updated_at DESC'
  ).all(`%${q}%`);
}
```

**Step 4: Run** — `npx vitest run src/lib/db.test.ts` → PASS.

**Step 5: Commit** — `git add -A && git commit -m "feat: SQLite session & message store"`

---

## Phase 2 — Drive Service

### Task 2.1: Konfigurasi + OAuth Drive

**Objective:** Service Drive bisa upload, list struktur folder, download via Drive API dengan OAuth.

**Files:**
- Create: `web/src/lib/drive.ts`
- Create: `web/.env.example`
- Create: `web/src/lib/drive.test.ts` (test path helper murni)

**Step 1: Implement** `web/src/lib/drive.ts`:

```ts
import { google } from 'googleapis';
import fs from 'fs';
import path from 'path';

const SCOPES = ['https://www.googleapis.com/auth/drive.file'];
const ROOT = 'MateriSekolah';

function getAuth() {
  const creds = JSON.parse(fs.readFileSync(process.env.GOOGLE_SERVICE_ACCOUNT!, 'utf8'));
  return new google.auth.GoogleAuth({ credentials: creds, scopes: SCOPES });
}

export async function drive() {
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
export async function ensureFolder(d, segments: string[], parent?: string): Promise<string> {
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
export async function uploadFile(d, filePath: string, fileName: string, mapel: string, bab: string) {
  const { mapel: m, bab: b } = validatePathSegments(mapel, bab);
  const folderId = await ensureFolder(d, [ROOT, m, b]);
  const { data } = await d.files.create({
    requestBody: { name: fileName, parents: [folderId] },
    media: { body: fs.createReadStream(filePath) },
    fields: 'id, webViewLink',
  });
  return data;
}

/** List struktur: [{mapel, bab, files: [{name, id}]}] */
export async function listMateri(d) {
  const root = await ensureFolder(d, [ROOT]);
  const { data: mapels } = await d.files.list({ q: `'${root}' in parents and trashed = false`, fields: 'files(id,name)', pageSize: 200 });
  const out = [];
  for (const mp of mapels.files ?? []) {
    const { data: babs } = await d.files.list({ q: `'${mp.id}' in parents and trashed = false`, fields: 'files(id,name)', pageSize: 200 });
    const babList = [];
    for (const bb of babs.files ?? []) {
      const { data: files } = await d.files.list({ q: `'${bb.id}' in parents and trashed = false`, fields: 'files(id,name,webViewLink)', pageSize: 200 });
      babList.push({ bab: bb.name, files: files.files ?? [] });
    }
    out.push({ mapel: mp.name, babs: babList });
  }
  return out;
}

/** Download file → temp path. */
export async function downloadFile(d, fileId: string, destPath: string) {
  const { data } = await d.files.get({ fileId, alt: 'media' }, { responseType: 'stream' });
  await new Promise((res, rej) => {
    const w = fs.createWriteStream(destPath);
    data.pipe(w).on('finish', res).on('error', rej);
  });
}
```

**Step 2: Test** `drive.test.ts` (fungsi murni saja, tanpa API):

```ts
import { describe, it, expect } from 'vitest';
import { validatePathSegments } from './drive';

describe('validatePathSegments', () => {
  it('cleans illegal chars', () => {
    expect(validatePathSegments('Matematika/ X', 'Bab 1: A').mapel).toBe('Matematika- X');
    expect(validatePathSegments('Fisika', 'Bab 2*').bab).toBe('Bab 2-');
  });
  it('rejects empty', () => {
    expect(() => validatePathSegments('', 'Bab 1')).toThrow();
  });
});
```

**Step 3: Run** — `npx vitest run src/lib/drive.test.ts` → PASS.

**Step 4: Commit** — `git commit -m "feat: Drive service (upload, list, download, OAuth)"`

---

## Phase 3 — Gemini Service

### Task 3.1: Chat dengan grounding + ekstraksi

**Objective:** Modul `gemini.ts` — chat streaming (SSE), rangkum, quiz, ekstraksi PDF/OCR/YouTube.

**Files:**
- Create: `web/src/lib/gemini.ts`

**Step 1: Implement**

```ts
import { GoogleGenAI } from '@google/genai';

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! });
export const MODEL = 'gemini-2.5-flash';

const SYSTEM = `Kamu adalah asisten belajar. Jawab berdasarkan materi yang diberikan.
Jika materi tidak cukup menjawab, gunakan pencarian web (grounding) untuk melengkapi.
Tandai sumber: "[Dari materi]" untuk isi dari materi pengguna, "[Dari web]" untuk tambahan dari internet.
Gunakan bahasa Indonesia.`;

/** Streaming chat; callback per chunk teks. Return teks lengkap. */
export async function chatStream(materiText: string, history: { role: string; content: string }[], prompt: string, onChunk: (t: string) => void) {
  const contents = [
    { role: 'model', parts: [{ text: SYSTEM + '\n\n=== MATERI ===\n' + materiText }] },
    ...history.map((m) => ({ role: m.role === 'assistant' ? 'model' : 'user', parts: [{ text: m.content }] })),
    { role: 'user', parts: [{ text: prompt }] },
  ];
  const res = await ai.models.generateContentStream({
    model: MODEL,
    contents,
    config: { googleSearch: { displayTitle: true } }, // grounding: cari web bila materi kurang
  });
  let full = '';
  for await (const chunk of res) {
    const t = chunk.text ?? '';
    full += t;
    onChunk(t);
  }
  return full;
}

/** Rangkum materi → markdown ringkas. */
export async function summarize(materiText: string): Promise<string> {
  const res = await ai.models.generateContent({
    model: MODEL,
    contents: [{ role: 'user', parts: [{ text: `Rangkum materi berikut menjadi catatan belajar ringkas (poin-poin penting, bahasa Indonesia):\n\n${materiText.slice(0, 50000)}` }] }],
  });
  return res.text ?? '';
}

/** Generate quiz (5 soal pilihan ganda) → JSON. */
export async function generateQuiz(materiText: string): Promise<string> {
  const res = await ai.models.generateContent({
    model: MODEL,
    contents: [{ role: 'user', parts: [{ text: `Buat 5 soal pilihan ganda dari materi berikut, format JSON array: [{"question":"...","options":["a","b","c","d"],"answer":0}]. Hanya JSON, tanpa teks lain:\n\n${materiText.slice(0, 50000)}` }] }],
  });
  return res.text ?? '[]';
}

/** Ekstrak teks dari file lokal (pdf/gambar) via Gemini multimodal. */
export async function extractText(filePath: string, mime: string): Promise<string> {
  const fs = await import('fs');
  const b64 = fs.readFileSync(filePath).toString('base64');
  const res = await ai.models.generateContent({
    model: MODEL,
    contents: [{ role: 'user', parts: [{ inlineData: { mimeType: mime, data: b64 } }, { text: 'Ekstrak semua teks dari dokumen ini. Output teks saja.' }] }],
  });
  return res.text ?? '';
}

/** Transkrip YouTube via Gemini (URL → teks). */
export async function youtubeTranscript(url: string): Promise<string> {
  const res = await ai.models.generateContent({
    model: MODEL,
    contents: [{ role: 'user', parts: [{ text: `Ambil transkrip/ringkasan isi video YouTube ini (bisa pakai pencarian web): ${url}. Output: ringkasan poin-poin materi, bahasa Indonesia.` }] }],
    config: { googleSearch: {} },
  });
  return res.text ?? '';
}
```

**Step 2: Verifikasi manual** (butuh `GEMINI_API_KEY`):

```bash
cd web && GEMINI_API_KEY=... node -e "require('tsx').register... " # atau lewat route API nanti
```

> Verifikasi penuh menunggu API key; tanpa key, pastikan modul compile (`npx tsc --noEmit`).

**Step 3: Commit** — `git commit -m "feat: Gemini service (chat grounding, summarize, quiz, extract)"`

---

## Phase 4 — API Routes

### Task 4.1: Routes upload, materi, sessions, chat (SSE)

**Objective:** API Next.js lengkap: upload, list materi, CRUD sessions, chat streaming.

**Files:**
- Create: `web/src/app/api/upload/route.ts`
- Create: `web/src/app/api/materi/route.ts`
- Create: `web/src/app/api/sessions/route.ts`
- Create: `web/src/app/api/sessions/[id]/route.ts`
- Create: `web/src/app/api/sessions/[id]/messages/route.ts`
- Create: `web/src/app/api/chat/route.ts`
- Create: `web/src/lib/store.ts` (singleton db + retry helper)

**Step 1: Implement** `web/src/lib/store.ts`:

```ts
import { initDb, Db } from './db';
import path from 'path';

let db: Db | null = null;
export function getDb(): Db {
  if (!db) {
    const dir = path.join(process.cwd(), 'data');
    fs.mkdirSync(dir, { recursive: true });
    db = initDb(path.join(dir, 'app.db'));
  }
  return db;
}
```

**Step 2: Routes** — pola:

- `api/upload`: `POST`, `formData()` → validasi ekstensi (`pdf,jpg,jpeg,png,webp,txt,md,yt`) + ukuran (≤50MB) → simpan ke temp → `uploadFile(drive, ...)` → untuk link YouTube simpan `meta.json` dengan URL → respond `{ok}`.
- `api/materi`: `GET` → `listMateri(drive())`.
- `api/sessions`: `GET` → list; `POST` → create (title dari body atau default).
- `api/sessions/[id]`: `PATCH` (rename/pin), `DELETE`.
- `api/sessions/[id]/messages`: `GET` → pesan sesi.
- `api/chat`: `POST` body `{sessionId, prompt, mapel?, bab?}` → ambil materi Drive relevan (download bab → `extractText`/baca teks, cache per bab) → `chatStream` → streaming SSE (`text/event-stream`), simpan user+assistant ke SQLite setelah selesai.

**Step 3: Verifikasi** — `npm run build` sukses; test manual via curl setelah server jalan.

**Step 4: Commit** — `git commit -m "feat: API routes (upload, materi, sessions, chat SSE)"`

---

## Phase 5 — UI

### Task 5.1: Halaman Materi (upload & browse)

**Objective:** Sidebar mapel/bab + upload form + daftar file.

**Files:**
- Create: `web/src/app/page.tsx` (halaman materi)
- Create: `web/src/components/MateriSidebar.tsx`
- Create: `web/src/components/UploadForm.tsx`
- Create: `web/src/app/chat/page.tsx` (halaman chat)

**Step 1: Implement** — Halaman materi: fetch `GET /api/materi`, render tree; `UploadForm` (pilih mapel/bab — input teks, file atau link YouTube) → `POST /api/upload` → refresh.

**Step 2: Verifikasi** — `npm run dev`, buka `http://localhost:3000`, upload file test, cek muncul di list.

**Step 3: Commit** — `git commit -m "feat: materi page (browse + upload)"`

### Task 5.2: Halaman Chat + Session System

**Objective:** Chat streaming + sidebar sesi lengkap (list, rename, pin, cari, export, hapus).

**Files:**
- Create: `web/src/components/ChatPanel.tsx`
- Create: `web/src/components/SessionSidebar.tsx`
- Create: `web/src/components/MessageList.tsx`
- Create: `web/src/lib/export.ts` (sesi → file .md)

**Step 1: Implement**
- SessionSidebar: `GET /api/sessions`, tombol baru/rename/pin/hapus, input cari (searchSessions), tombol export → unduh `.md` (`# title` + pesan).
- ChatPanel: `POST /api/chat` dengan `fetch` + `ReadableStream` parse SSE, render streaming, tombol retry saat error, badge sumber `[Dari materi]`/`[Dari web]`.

**Step 2: Verifikasi** — chat tanya materi, jawaban streaming, buat/hapus/rename/pin sesi, export sesi.

**Step 3: Commit** — `git commit -m "feat: chat page with full session system"`

---

## Phase 6 — Hermes Skill

### Task 6.1: Skill `materi-sekolah`

**Objective:** Hermes skill yang bisa "rangkum <mapel> <bab>" dan "quiz <mapel> <bab>" dari Drive.

**Files:**
- Create: `C:\Users\USER\AppData\Local\hermes\skills\materi-sekolah\SKILL.md`

**Step 1: Implement** — SKILL.md:

- Trigger: user minta rangkum/quiz materi sekolah, atau nanya materi.
- Langkah: `gws drive search "MateriSekolah"` → temukan bab → `gws drive download <fileId> --output <tmp>` → ekstrak (PDF via Gemini/Gemini vision; foto via Gemini; teks baca langsung) → `summarize`/`generateQuiz` via Gemini (pakai `GEMINI_API_KEY` env) → jawab, tandai sumber.
- Setup: pastikan `google-workspace` skill sudah OAuth (`setup.py --check`); `GEMINI_API_KEY` di env Hermes.
- Pitfall: `NOT_AUTHENTICATED` = belum setup, bukan bug; grounding untuk jawaban yang butuh web.

**Step 2: Verifikasi** — dari Hermes: "rangkum Matematika bab 1" → jawaban dari materi Drive.

**Step 3: Commit** — `git add -A && git commit -m "feat: Hermes skill materi-sekolah"`

---

## Phase 7 — Deploy & Setup

### Task 7.1: Deploy ke Ubuntu + OAuth setup

**Objective:** Web app jalan di Linux Ubuntu (`npm run build && npm run start`), OAuth Drive & Gemini aktif.

**Files:**
- Create: `web/.env` (GEMINI_API_KEY, GOOGLE_SERVICE_ACCOUNT path, atau OAuth token)
- Create: `web/README.md` (instruksi deploy)

**Step 1: Setup OAuth Drive**
- Google Cloud Console: enable Drive API → Service Account (atau OAuth desktop) → download JSON → simpan ke server → set `GOOGLE_SERVICE_ACCOUNT=/path/creds.json`.
- Gemini API key → `GEMINI_API_KEY`.

**Step 2: Deploy Ubuntu**

```bash
# di server: install Node 20+, clone repo, cd web
npm ci && npm run build && npm run start -- -p 3000
# atau pakai systemd/pm2; akses via http://server:3000
```

**Step 3: Verifikasi** — upload file test dari browser, chat menjawab dari materi, sesi tersimpan (restart server → history tetap).

**Step 4: Commit** — `git add -A && git commit -m "docs: deploy & setup guide"`

---

## Testing & Validation Ringkas

| Level | Alat | Cakupan |
|---|---|---|
| Unit | Vitest | db.ts, drive path helper |
| Integration | Manual + curl | upload → file di Drive; chat → jawaban kontekstual |
| Manual | Checklist | upload 4 jenis (PDF/foto/teks/YT) → list → chat → quiz → export sesi |
| Skill | Manual di Hermes | "rangkum" & "quiz" terhadap bab contoh |

## Risiko & Catatan

- **OAuth per-environment**: setup Hermes (`google-workspace`) dan web app terpisah; cek `setup.py --check` dulu.
- **Rate limit Gemini**: 429 → pesan "quota habis" + retry.
- **YouTube transkrip** via Gemini grounding — butuh koneksi & quota.
- **better-sqlite3** butuh native build — pastikan build tools ada di Ubuntu (`build-essential`).
- **Materi besar** (>50MB) ditolak di upload; materi panjang di-chunk ke Gemini (slice 50k).
