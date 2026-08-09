'use client';

import { useEffect, useState } from 'react';

type FileInfo = { name: string; id: string; webViewLink?: string };
type Bab = { bab: string; files: FileInfo[] };
type Mapel = { mapel: string; babs: Bab[] };

export default function MateriPage() {
  const [materi, setMateri] = useState<Mapel[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [mapel, setMapel] = useState('');
  const [bab, setBab] = useState('');
  const [ytUrl, setYtUrl] = useState('');
  const [uploading, setUploading] = useState(false);
  const [msg, setMsg] = useState('');

  async function load() {
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/materi');
      if (!res.ok) throw new Error((await res.json()).error ?? 'gagal');
      setMateri(await res.json());
    } catch (e: any) {
      setError(e.message ?? 'Gagal ambil materi — cek GOOGLE_SERVICE_ACCOUNT / koneksi');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  async function uploadFile(f: File) {
    const fd = new FormData();
    fd.append('mapel', mapel); fd.append('bab', bab); fd.append('file', f);
    const res = await fetch('/api/upload', { method: 'POST', body: fd });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error ?? 'Upload gagal');
  }

  async function onUpload(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setMsg(''); setUploading(true);
    try {
      const input = e.currentTarget.elements.namedItem('file') as HTMLInputElement;
      if (input?.files?.length) {
        await uploadFile(input.files[0]);
      } else if (ytUrl) {
        const res = await fetch('/api/upload', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ mapel, bab, ytUrl }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error ?? 'Upload gagal');
      } else {
        throw new Error('Pilih file atau isi link YouTube');
      }
      setMsg('✅ Berhasil diupload'); setYtUrl('');
      if (input) input.value = '';
      load();
    } catch (e: any) {
      setMsg(`❌ ${e.message}`);
    } finally {
      setUploading(false);
    }
  }

  return (
    <main className="min-h-screen bg-gray-50 p-6">
      <header className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold">📚 Materi Sekolah</h1>
        <nav className="flex gap-3 text-sm">
          <a href="/" className="font-semibold text-blue-600">Materi</a>
          <a href="/chat" className="text-gray-600 hover:text-blue-600">Chat</a>
        </nav>
      </header>

      {/* Upload */}
      <form onSubmit={onUpload} className="mb-6 rounded-xl bg-white p-4 shadow-sm">
        <div className="flex flex-wrap items-end gap-3">
          <label className="flex flex-col text-sm">
            Mapel
            <input value={mapel} onChange={(e) => setMapel(e.target.value)} required placeholder="Matematika" className="mt-1 rounded border px-2 py-1" />
          </label>
          <label className="flex flex-col text-sm">
            Bab/Topik
            <input value={bab} onChange={(e) => setBab(e.target.value)} required placeholder="Bab 1" className="mt-1 rounded border px-2 py-1" />
          </label>
          <label className="flex flex-col text-sm">
            File (PDF/gambar/teks)
            <input type="file" name="file" accept=".pdf,.jpg,.jpeg,.png,.webp,.txt,.md" className="mt-1 text-sm" />
          </label>
          <button disabled={uploading} className="rounded bg-blue-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">
            {uploading ? 'Uploading...' : 'Upload'}
          </button>
        </div>
        <div className="mt-3 flex items-center gap-3">
          <span className="text-xs text-gray-500">atau link YouTube:</span>
          <input value={ytUrl} onChange={(e) => setYtUrl(e.target.value)} placeholder="https://youtube.com/watch?v=..." className="flex-1 rounded border px-2 py-1 text-sm" />
          <button disabled={uploading} className="rounded bg-gray-800 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">
            Simpan Link
          </button>
        </div>
        {msg && <p className="mt-2 text-sm">{msg}</p>}
      </form>

      {error && <p className="mb-4 rounded bg-red-50 p-3 text-sm text-red-700">{error}</p>}

      {/* Tree materi */}
      {loading ? <p className="text-gray-500">Memuat materi...</p> : (
        materi.length === 0 ? <p className="text-gray-500">Belum ada materi. Upload yang pertama di atas 👆</p> : (
          <div className="grid gap-4 md:grid-cols-2">
            {materi.map((m) => (
              <div key={m.mapel} className="rounded-xl bg-white p-4 shadow-sm">
                <h2 className="mb-2 font-bold text-blue-700">{m.mapel}</h2>
                {m.babs.map((b) => (
                  <div key={b.bab} className="mb-2">
                    <h3 className="text-sm font-semibold text-gray-700">📁 {b.bab}</h3>
                    <ul className="ml-4 list-disc text-sm text-gray-600">
                      {b.files.map((f) => (
                        <li key={f.id}>
                          {f.webViewLink
                            ? <a href={f.webViewLink} target="_blank" rel="noreferrer" className="text-blue-600 hover:underline">{f.name}</a>
                            : f.name}
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            ))}
          </div>
        )
      )}
    </main>
  );
}
