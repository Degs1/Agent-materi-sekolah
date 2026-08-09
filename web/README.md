# Materi Sekolah Agent — Web App

Sistem simpan materi sekolah (PDF/foto/teks/link YouTube) per mata pelajaran & bab di **Google Drive**, plus chat agent AI (Gemini) untuk belajar: rangkuman, quiz, tanya jawab dengan web-search fallback (grounding).

## Fitur

- 📤 Upload materi: PDF, gambar (OCR via Gemini), teks, link YouTube
- 📂 Browse struktur Drive: `MateriSekolah/<Mapel>/<Bab>/`
- 💬 Chat agent dengan **session system**: list, lanjut, rename, pin, cari, export (.md), hapus
- 🧠 Gemini grounding: jawab dari materi dulu, kalau kurang → cari web otomatis, sumber ditandai `[Dari materi]` vs `[Dari web]`
- 🔒 Private, tanpa login

## Setup

1. **Prasyarat**: Node.js 20+.

2. **Google Cloud** (sekali):
   - Enable **Google Drive API** di https://console.cloud.google.com/apis/library
   - Buat Service Account (IAM & Admin → Service Accounts) → buat key JSON → download.
   - (Opsional: bagikan folder Drive ke email service account jika pakai Drive pribadi.)

3. **Gemini API key**: https://aistudio.google.com/apikey

4. **Env**: `cp .env.example .env`, isi `GOOGLE_SERVICE_ACCOUNT` (path JSON) & `GEMINI_API_KEY`.

5. **Jalankan**:
   ```bash
   npm ci
   npm run dev        # development (http://localhost:3000)
   # atau production:
   npm run build && npm run start
   ```

## Deploy ke Linux Ubuntu

```bash
# di server
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash - && sudo apt-get install -y nodejs build-essential
git clone <repo-url> && cd web
npm ci && npm run build
# env:
#   GOOGLE_SERVICE_ACCOUNT=/path/creds.json
#   GEMINI_API_KEY=...
npm run start -- -p 3000
```

Opsional: systemd unit agar jalan terus:

```ini
# /etc/systemd/system/materi.service
[Unit]
Description=Materi Sekolah Agent
After=network.target
[Service]
WorkingDirectory=/opt/materi/web
ExecStart=/usr/bin/npm run start -- -p 3000
EnvironmentFile=/opt/materi/web/.env
Restart=always
[Install]
WantedBy=multi-user.target
```

```bash
sudo systemctl daemon-reload && sudo systemctl enable --now materi
```

Akses: `http://<server-ip>:3000`

## Catatan

- SQLite chat history tersimpan di `web/data/app.db` (backup otomatis jika folder disync).
- `better-sqlite3` butuh build tools (`build-essential`) di Ubuntu — sudah termasuk di atas.
- Materi >50MB ditolak; materi panjang di-chunk ke Gemini (50k chars per call).
