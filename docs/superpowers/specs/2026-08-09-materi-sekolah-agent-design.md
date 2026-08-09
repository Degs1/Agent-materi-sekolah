# Materi Sekolah Agent — Design Document

Tanggal: 2026-08-09
Status: Draft

## 1. Ringkasan

Sistem penyimpanan materi sekolah (PDF, foto, teks, link YouTube) yang terorganisir per mata pelajaran & bab, plus agent AI (Gemini) yang bisa diajak chat untuk belajar — bikin ringkasan, quiz, dan menjawab pertanyaan menjelang ujian.

Dua komponen:
1. **Web app (Next.js)** — upload & kelola materi, chat agent dengan session system. Deploy di Linux Ubuntu, private (tanpa login).
2. **Hermes skill** — chat belajar dari desktop (Hermes), baca materi dari Google Drive via `gws` CLI.

Satu sumber data: **Google Drive** (Drive API langsung, tanpa Drive for Desktop). Chat history di SQLite lokal server.

## 2. Tujuan & Non-Tujuan

**Tujuan:**
- Simpan semua materi sekolah terorganisir (Mapel → Bab → file).
- Upload dari web: PDF, gambar (OCR), teks, link YouTube.
- Chat agent yang paham konteks materi, bisa rangkum & bikin quiz.
- Session system chat lengkap: list, lanjut, rename, pin, cari, export/share, hapus.
- Hermes skill dengan command "rangkum" & "quiz" dari desktop.

**Non-Tujuan (YAGNI):**
- Auth/login (private, single user).
- Multi-user / kolaborasi.
- Rekomendasi materi otomatis.
- Mobile app native.

## 3. Arsitektur

```
┌─────────────────────┐        ┌──────────────────────────┐
│  Web App (Next.js)  │        │  Hermes Skill (chat)     │
│  - Upload materi    │        │  - Baca materi dari Drive │
│  - Kelola folder    │        │  - Ekstrak PDF/OCR/YT     │
│  - Chat agent +     │  ────► │  - Rangkum + quiz (Gemini)│
│    session system   │        └──────────────────────────┘
└─────────────────────┘
        │                              │
        └───────────► Google Drive ◄───┘
              (folder per mapel/bab,
               meta.json per bab)

SQLite (lokal server): chat sessions & messages
Gemini API: ekstraksi, rangkuman, quiz, chat agent
```

**Prinsip:** Google Drive = database materi (single source of truth). SQLite = chat history (cepat, lokal). Gemini = otak AI. Web app & Hermes skill berbagi struktur Drive + Gemini key yang sama.

## 4. Komponen

### 4.1 Web App (Next.js)

- **Halaman Materi**: sidebar Mapel/Bab tree (dari Drive), view file, tombol upload.
- **Halaman Chat**: chat agent, sidebar sesi (list, rename, pin, cari — cari teks di dalam pesan sesi, export — unduh sesi sebagai file Markdown, hapus).
- **API routes**:
  - `POST /api/upload` — simpan file ke Drive per mapel/bab
  - `GET /api/materi` — list struktur Drive
  - `POST /api/chat` — streaming jawaban agent (SSE), pakai Gemini
  - `CRUD /api/sessions` — session system (SQLite)
- **Auth**: none (private).
- **Deploy**: Linux Ubuntu (Node server, Next.js standalone). Lingkungan: Node 20+, `npm run build && npm run start`.

### 4.2 Hermes Skill (baru, di Hermes)

- Command: "rangkum <mapel> <bab>" dan "quiz <mapel> <bab>" (plus chat bebas bertanya).
- Download materi dari Drive via `gws` CLI (`drive search`, `drive download`).
- Ekstraksi + rangkum/quiz via Gemini API.
- Reuse struktur Drive yang sama.

### 4.3 Google Drive (database materi)

- Struktur: `MateriSekolah/<Mapel>/<Bab>/<file>` + `meta.json` per bab (judul, sumber, tanggal, status proses).
- Akses via Drive API (OAuth) — setup sekali di Hermes (`google-workspace` skill) dan di web app.

### 4.4 SQLite (chat history)

- Tabel: `sessions` (id, title, pinned, created_at, updated_at) dan `messages` (id, session_id, role, content, created_at).
- Lokal di server web app. Hermes skill tidak pakai SQLite (chatnya di Hermes sendiri).

### 4.5 Gemini API

- Ekstraksi: PDF → teks, gambar → OCR, YouTube → transkrip (pakai kemampuan Gemini multimodal + YouTube).
- Rangkuman & quiz generation.
- Chat agent (web + Hermes). API key disimpan di env var.
- **Grounding (Google Search via Gemini)**: saat chat, jika materi di Drive kurang / tidak jelas menjawab pertanyaan, agent otomatis cari di web (Gemini grounding) → jawaban gabungan. Sumber ditandai: "dari materi Drive" vs "tambahan dari web". Grounding dipakai di web app dan Hermes skill (satu mekanisme, tanpa API key tambahan).

## 5. Data Flow

1. **Upload**: web → `POST /api/upload` → simpan ke Drive `MateriSekolah/<Mapel>/<Bab>/` → update `meta.json`.
2. **Browse**: web → `GET /api/materi` → list struktur Drive.
4. **Chat (web)**: user ketik → `POST /api/chat` → server ambil materi relevan dari Drive → Gemini generate jawaban (grounding: cari web otomatis jika materi Drive kurang, sumber ditandai) → streaming SSE ke client → simpan ke SQLite.
5. **Chat (Hermes)**: command → `gws` download materi → Gemini generate (grounding sama) → jawab di Hermes.

## 6. Error Handling

- **Drive API gagal / rate limit** → retry backoff (max 3x), pesan jelas di UI, upload resumable (tidak ada data hilang).
- **File rusak / format tidak didukung** → validasi ekstensi + ukuran (max 50MB), tolak dengan alasan spesifik.
- **Gemini error / timeout** → tampil error + tombol retry; quota habis → pesan "quota habis, coba lagi nanti" (deteksi dari kode error 429/ResourceExhausted).
- **Grounding / web search gagal** → jawaban tetap dari materi Drive saja (fallback), tanpa error; sumber "dari web" tidak ditampilkan.
- **Koneksi putus saat streaming** → client reconnect, history aman di SQLite.
- **File Drive dihapus/dipindah manual** → refresh struktur; meta.json nyangkut diabaikan (tidak crash).

## 7. Testing

- **Unit test** (Vitest): parser ekstraksi, logic session (rename/pin/export), format Drive path.
- **Integration test**: upload → file benar di Drive (folder test terpisah); chat → jawaban sesuai konteks materi.
- **Manual checklist**: upload PDF/foto/teks/YT → muncul di list → chat tanya materi → jawaban ngarah → quiz muncul → export sesi.
- **Hermes skill test**: command "rangkum" & "quiz" terhadap 1 bab contoh.

## 8. Setup yang Dibutuhkan (fase awal)

1. Google Cloud project + OAuth client (sekali) → Drive API enabled.
2. Setup OAuth di Hermes (`google-workspace` skill, `setup.py`).
3. Setup OAuth di web app (Google Drive API).
4. Gemini API key (env var di web app + Hermes).

## 9. Lingkungan

- Node.js 20+, npm.
- Next.js (App Router), TypeScript, Tailwind (UI simpel).
- SQLite via better-sqlite3.
- Deploy: Linux Ubuntu, Next.js standalone, `npm run build && npm run start`.
