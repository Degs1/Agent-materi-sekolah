'use client';

import { useEffect, useState } from 'react';

type FileInfo = { id: string; name: string; webViewLink?: string; type: string; extractedText?: string };
type Bab = { _id: string; bab: string; files: FileInfo[] };
type Mapel = { _id: string; mapel: string; babs: Bab[] };

const TYPE_ICON: Record<string, string> = {
  pdf: '▤', jpg: '◫', jpeg: '◫', png: '◫', webp: '◫', txt: '≡', md: '≡',
};

function ext(name: string) {
  const i = name.lastIndexOf('.');
  return i >= 0 ? name.slice(i + 1).toLowerCase() : '';
}

export default function MateriPage() {
  const [materi, setMateri] = useState<Mapel[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [mapelId, setMapelId] = useState('');
  const [babId, setBabId] = useState('');
  
  const [newMapel, setNewMapel] = useState('');
  const [newBab, setNewBab] = useState('');
  const [mapelForBab, setMapelForBab] = useState('');

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
      setError(e.message ?? 'Gagal ambil materi — cek koneksi DB');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  async function createMapel(e: React.FormEvent) {
    e.preventDefault();
    try {
      const res = await fetch('/api/mapel', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newMapel }),
      });
      if (!res.ok) throw new Error((await res.json()).error ?? 'Gagal membuat mapel');
      setNewMapel('');
      load();
    } catch (e: any) {
      setError(e.message);
    }
  }

  async function createBab(e: React.FormEvent) {
    e.preventDefault();
    try {
      const res = await fetch('/api/bab', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mapelId: mapelForBab, name: newBab }),
      });
      if (!res.ok) throw new Error((await res.json()).error ?? 'Gagal membuat bab');
      setNewBab('');
      load();
    } catch (e: any) {
      setError(e.message);
    }
  }

  async function onUpload(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!mapelId || !babId) {
      setMsg('❌ Pilih Mapel dan Bab terlebih dahulu');
      return;
    }
    
    const input = e.currentTarget.elements.namedItem('file') as HTMLInputElement;
    const isFile = !!input?.files?.length;
    
    setMsg(isFile ? '⏳ Mengunggah file (0%)...' : '⏳ Memproses link & mengambil transkrip...'); 
    setUploading(true);
    
    try {
      const fd = new FormData();
      fd.append('mapelId', mapelId);
      fd.append('babId', babId);

      if (isFile) {
        fd.append('file', input.files![0]);
      } else if (ytUrl) {
        fd.append('ytUrl', ytUrl);
      } else {
        throw new Error('Pilih file atau isi link YouTube');
      }
      
      const data = await new Promise<any>((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.open('POST', '/api/upload');
        
        xhr.upload.onprogress = (event) => {
          if (event.lengthComputable && isFile) {
            const percent = Math.round((event.loaded / event.total) * 100);
            if (percent < 100) {
              setMsg(`⏳ Mengunggah file (${percent}%)...`);
            } else {
              setMsg('⏳ Mengekstrak teks (OCR)... Harap tunggu, ini mungkin memakan waktu.');
            }
          }
        };

        xhr.onload = () => {
          try {
            const resData = JSON.parse(xhr.responseText);
            if (xhr.status >= 200 && xhr.status < 300) {
              resolve(resData);
            } else {
              reject(new Error(resData.error ?? 'Upload gagal'));
            }
          } catch(err) {
            reject(new Error('Gagal membaca respons dari server'));
          }
        };

        xhr.onerror = () => reject(new Error('Koneksi terputus saat mengunggah'));
        xhr.send(fd);
      });
      
      setMsg('✅ Berhasil disimpan & teks telah diekstrak!'); 
      setYtUrl('');
      if (input) input.value = '';
      load();
    } catch (e: any) {
      setMsg(`❌ ${e.message}`);
    } finally {
      setUploading(false);
    }
  }

  const [modalData, setModalData] = useState<{title: string, text: string} | null>(null);

  async function deleteMateri(id: string) {
    if (!confirm('Yakin ingin menghapus materi ini?')) return;
    try {
      const res = await fetch(`/api/materi/${id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error((await res.json()).error ?? 'Gagal menghapus');
      load();
    } catch (e: any) {
      alert(e.message);
    }
  }

  const selectedMapelBabs = materi.find(m => m._id === mapelId)?.babs || [];

  return (
    <main className="relative min-h-screen">
      {/* Header */}
      <header className="sticky top-0 z-10 border-b border-line bg-ink/80 backdrop-blur">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-5 py-4">
          <div className="flex items-baseline gap-3">
            <h1 className="font-display text-lg font-bold tracking-tight">Materi Sekolah</h1>
            <span className="eyebrow hidden sm:inline">peta belajar</span>
          </div>
          <nav className="flex items-center gap-1 text-sm">
            <a href="/" className="rounded-lg bg-raised px-3 py-1.5 font-semibold text-fg">Materi</a>
            <a href="/chat" className="rounded-lg px-3 py-1.5 text-muted transition-colors hover:bg-raised hover:text-fg">Chat</a>
          </nav>
        </div>
      </header>

      <div className="mx-auto max-w-5xl px-5 py-8">
        
        {/* Manage Mapel & Bab */}
        <section className="grid md:grid-cols-2 gap-6 mb-8">
          <div className="card p-5">
            <p className="eyebrow mb-3">tambah mapel</p>
            <form onSubmit={createMapel} className="flex gap-2">
              <input value={newMapel} onChange={(e) => setNewMapel(e.target.value)} required placeholder="Matematika" className="input flex-1" />
              <button className="btn btn-accent px-4 py-2">Tambah</button>
            </form>
          </div>
          <div className="card p-5">
            <p className="eyebrow mb-3">tambah bab</p>
            <form onSubmit={createBab} className="flex gap-2">
              <select value={mapelForBab} onChange={(e) => setMapelForBab(e.target.value)} required className="input w-1/3">
                <option value="">Pilih Mapel...</option>
                {materi.map(m => (
                  <option key={m._id} value={m._id}>{m.mapel}</option>
                ))}
              </select>
              <input value={newBab} onChange={(e) => setNewBab(e.target.value)} required placeholder="Bab 1" className="input flex-1" />
              <button className="btn btn-accent px-4 py-2">Tambah</button>
            </form>
          </div>
        </section>

        {/* Upload card */}
        <section className="card mb-8 p-5">
          <p className="eyebrow mb-3">arsip materi</p>
          <form onSubmit={onUpload} className="space-y-4">
            <div className="flex flex-col sm:flex-row flex-wrap sm:items-end gap-3">
              <label className="flex flex-col gap-1 text-xs text-muted w-full sm:w-auto">
                Mapel
                <select value={mapelId} onChange={(e) => { setMapelId(e.target.value); setBabId(''); }} required className="input w-full sm:w-44">
                  <option value="">Pilih Mapel...</option>
                  {materi.map(m => (
                    <option key={m._id} value={m._id}>{m.mapel}</option>
                  ))}
                </select>
              </label>
              <label className="flex flex-col gap-1 text-xs text-muted w-full sm:w-auto">
                Bab / Topik
                <select value={babId} onChange={(e) => setBabId(e.target.value)} required className="input w-full sm:w-44">
                  <option value="">Pilih Bab...</option>
                  {selectedMapelBabs.map(b => (
                    <option key={b._id} value={b._id}>{b.bab}</option>
                  ))}
                </select>
              </label>
              <label className="flex flex-col gap-1 text-xs text-muted w-full sm:w-auto">
                File (PDF / gambar / teks)
                <input type="file" name="file" accept=".pdf,.jpg,.jpeg,.png,.webp,.txt,.md" className="input w-full sm:max-w-xs cursor-pointer" />
              </label>
              <button disabled={uploading} className="btn btn-accent px-4 py-2 w-full sm:w-auto mt-2 sm:mt-0">
                {uploading ? 'Menyimpan…' : 'Simpan Materi'}
              </button>
            </div>
            <div className="flex flex-col sm:flex-row sm:items-center gap-3 border-t border-line pt-3">
              <span className="font-mono text-[0.65rem] uppercase tracking-widest text-faint">atau</span>
              <input value={ytUrl} onChange={(e) => setYtUrl(e.target.value)} placeholder="https://youtube.com/watch?v=…" className="input w-full flex-1" />
              <button disabled={uploading} className="btn btn-ghost px-4 py-2 w-full sm:w-auto border border-line sm:border-none">Simpan Link</button>
            </div>
            {msg && <p className="text-sm text-muted">{msg}</p>}
          </form>
        </section>

        {error && <p className="card mb-6 border-red-500/30 p-3 text-sm text-red-400">{error}</p>}

        {/* Tree materi */}
        <section>
          <p className="eyebrow mb-3">koleksi</p>
          {loading ? (
            <p className="text-sm text-muted">memuat…</p>
          ) : materi.length === 0 ? (
            <div className="card-dashed p-10 text-center">
              <p className="text-sm text-muted">Belum ada materi.</p>
              <p className="mt-1 text-xs text-faint">Arsipkan mapel &amp; bab pertama di atas ↑</p>
            </div>
          ) : (
            <div className="grid gap-4 md:grid-cols-2">
              {materi.map((m, mi) => (
                <div key={m._id} className="card p-5">
                  <h2 className="font-display text-base font-bold tracking-tight">
                    <span className="mr-2 font-mono text-xs text-accent">{String(mi + 1).padStart(2, '0')}</span>
                    {m.mapel}
                  </h2>
                  <div className="mt-4 space-y-4">
                    {m.babs.map((b) => (
                      <div key={b._id}>
                        <p className="mb-1.5 text-xs font-semibold text-muted">{b.bab}</p>
                        <ul className="space-y-1">
                          {b.files.map((f) => {
                            const e = ext(f.name);
                            return (
                              <li key={f.id} className="group flex items-center justify-between gap-2 rounded-lg px-2 py-1.5 text-sm transition-colors hover:bg-raised">
                                <div 
                                  className="flex items-center gap-2 flex-1 min-w-0 cursor-pointer" 
                                  onClick={() => setModalData({ title: f.name, text: f.extractedText ?? '(Tidak ada teks hasil ekstraksi untuk materi ini)' })}
                                >
                                  <span className="font-mono text-xs text-faint group-hover:text-accent shrink-0">{TYPE_ICON[e] ?? '◇'}</span>
                                  <span className="truncate text-fg">{f.name}</span>
                                  <span className="font-mono text-[0.6rem] uppercase text-faint shrink-0 ml-2">{e}</span>
                                </div>
                                <div className="flex shrink-0 items-center gap-2 opacity-0 transition-opacity group-hover:opacity-100 md:opacity-0">
                                  {f.webViewLink && (
                                    <a href={f.webViewLink} target="_blank" rel="noreferrer" title="Buka Asli" className="text-xs text-accent hover:underline">
                                      ↗
                                    </a>
                                  )}
                                  <button onClick={() => deleteMateri(f.id)} title="Hapus materi" className="text-xs text-red-500 hover:text-red-400">
                                    ✕
                                  </button>
                                </div>
                              </li>
                            );
                          })}
                        </ul>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>

      {/* Modal OCR Text */}
      {modalData && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-surface border border-line rounded-2xl shadow-xl w-full max-w-2xl max-h-[85vh] flex flex-col">
            <div className="flex items-center justify-between p-4 border-b border-line">
              <h3 className="font-semibold truncate pr-4">{modalData.title}</h3>
              <button onClick={() => setModalData(null)} className="text-muted hover:text-fg font-bold text-lg leading-none">✕</button>
            </div>
            <div className="p-4 overflow-y-auto whitespace-pre-wrap text-sm text-fg font-mono leading-relaxed bg-base">
              {modalData.text}
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
