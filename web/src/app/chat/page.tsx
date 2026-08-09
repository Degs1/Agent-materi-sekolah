'use client';

import { useRouter } from 'next/navigation';

export default function ChatIndexPage() {
  const router = useRouter();

  async function newSession() {
    const res = await fetch('/api/sessions', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({}) });
    const s = await res.json();
    router.push(`/chat/${s.id}`);
  }

  return (
    <section className="flex flex-1 flex-col h-full relative">
      <header className="flex flex-col border-b border-line bg-surface/70 md:hidden">
        <div className="flex items-center gap-3 px-3 py-2.5">
          <label htmlFor="mobile-sidebar" className="cursor-pointer text-lg p-1 mr-1">☰</label>
          <span className="text-sm font-semibold">Pilih Sesi</span>
        </div>
      </header>
      <div className="flex flex-1 flex-col items-center justify-center bg-base p-4">
        <div className="max-w-sm text-center">
          <p className="font-display text-2xl font-bold tracking-tight">Buka sesi untuk mulai.</p>
          <p className="mt-2 text-sm text-muted">
            Buat sesi baru, lalu tanya materi, minta rangkuman, atau kuis.
          </p>
          <button onClick={newSession} className="btn btn-accent mt-6 px-4 py-2">+ Sesi baru</button>
        </div>
      </div>
    </section>
  );
}
