# Agen Materi Sekolah 🎓

Aplikasi asisten belajar berbasis AI (Gemini) terintegrasi yang memungkinkan pengguna untuk mengunggah berbagai sumber belajar (PDF, gambar, teks, dan video YouTube). Agen akan otomatis melakukan ekstraksi teks (OCR) dan merangkum isinya untuk kemudian digunakan sebagai konteks utama saat mengobrol (chat) dengan AI.

## Fitur Utama ✨

- **Mendukung Multi-Format:** Unggah dokumen PDF, gambar (.jpg, .png), file teks, atau cukup tempelkan (paste) tautan video YouTube.
- **Ekstraksi Teks (OCR) Otomatis:** Menggunakan teknologi multimodal Gemini API untuk mengubah gambar dan PDF menjadi teks secara instan saat file diunggah.
- **Penyimpanan Lokal & MongoDB:** File fisik disimpan di server, sementara teks hasil OCR disimpan secara efisien di MongoDB untuk pencarian super cepat.
- **Agen Chat Berkonteks (Context-Aware):** Bertanya spesifik tentang bab pelajaran tertentu. Agen akan membaca *semua* file yang ada di bab tersebut sekaligus untuk memberikan jawaban paling akurat.
- **Sistem Proses Latar Belakang (Background Job):** Proses generasi jawaban AI atau ekstraksi OCR tidak akan terputus meskipun pengguna menutup tab peramban (browser).
- **Proteksi Kata Sandi Global:** Akses situs dikunci dengan *middleware* menggunakan satu *password* statis yang bisa diatur lewat *environment variable*, sehingga sangat aman untuk di-deploy ke server publik.

---

## Prasyarat 🛠️

Sebelum memulai, pastikan kamu telah menginstal:
- **Node.js** (versi 18 atau lebih baru)
- **MongoDB** (bisa menggunakan MongoDB Compass lokal atau MongoDB Atlas)
- **Akun Google AI Studio** (untuk mendapatkan `GEMINI_API_KEY` gratis)

---

## Cara Instalasi & Menjalankan di Lokal 🚀

1. **Clone Repositori**
   ```bash
   git clone https://github.com/USERNAME/agent-materi-sekolah.git
   cd agent-materi-sekolah/web
   ```

2. **Instal Dependensi**
   ```bash
   npm install
   ```

3. **Konfigurasi Environment**
   Salin file `.env.example` menjadi `.env` lalu isi nilai-nilainya:
   ```bash
   cp .env.example .env
   ```
   Buka file `.env` dan atur variabel berikut:
   - `MONGODB_URI`: URL koneksi ke MongoDB kamu (misal: `mongodb://localhost:27017/materi_sekolah` atau URL Atlas).
   - `GEMINI_API_KEY`: Dapatkan dari [Google AI Studio](https://aistudio.google.com/apikey).
   - `APP_PASSWORD`: Atur kata sandi rahasia untuk masuk ke dalam web (opsional saat *development*, tapi sangat disarankan).

4. **Jalankan Server Development**
   ```bash
   npm run dev
   ```
   Aplikasi akan berjalan di `http://localhost:3000`. Jika kamu mengatur `APP_PASSWORD`, kamu akan langsung diarahkan ke halaman login.

---

## Cara Deploy ke Server Publik (Vercel) 🌍

Aplikasi ini menggunakan Next.js App Router, sehingga sangat mudah untuk di-deploy ke Vercel:

1. Buat akun dan masuk ke [Vercel](https://vercel.com).
2. Klik **Add New...** > **Project**.
3. Import repositori GitHub `agent-materi-sekolah` milikmu.
4. Pada bagian **Root Directory**, pastikan kamu memilih folder `web` (jika aplikasi Next.js berada di dalam folder `web`).
5. Pada bagian **Environment Variables**, tambahkan:
   - `MONGODB_URI` (Gunakan MongoDB Atlas untuk *cloud database*).
   - `GEMINI_API_KEY`
   - `APP_PASSWORD`
6. Klik **Deploy** dan tunggu prosesnya selesai!

> **Catatan:** Karena Vercel menggunakan arsitektur *Serverless*, folder `public/uploads` (untuk menyimpan file fisik) akan terhapus (*reset*) setiap kali aplikasi *restart* atau *deploy* ulang. Jika kamu ingin file PDF/gambar tersimpan permanen di *production*, sangat disarankan untuk menggunakan VPS (seperti DigitalOcean, Railway, dll) atau mengganti logika penyimpanan ke layanan Cloud Storage seperti AWS S3 atau Supabase Storage. Teks OCR di MongoDB akan tetap aman.

---

Dibuat dengan ❤️ untuk kemudahan belajar.
