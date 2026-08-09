'use client';

import { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';

type Session = { id: number; title: string; pinned: number; created_at: string; updated_at: string };

export default function ChatLayout({ children }: { children: React.ReactNode }) {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [search, setSearch] = useState('');
  const router = useRouter();
  const params = useParams();
  const activeId = params.id ? Number(params.id) : null;

  async function loadSessions() {
    const res = await fetch(`/api/sessions${search ? `?q=${encodeURIComponent(search)}` : ''}`);
    if (res.ok) setSessions(await res.json());
  }

  useEffect(() => { loadSessions(); }, [search, activeId]);

  async function newSession() {
    const res = await fetch('/api/sessions', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({}) });
    const s = await res.json();
    loadSessions();
    router.push(`/chat/${s.id}`);
  }

  function openSession(id: number) {
    router.push(`/chat/${id}`);
  }

  async function rename(id: number) {
    const title = prompt('Nama baru:');
    if (!title?.trim()) return;
    await fetch(`/api/sessions/${id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ title }) });
    loadSessions();
  }

  async function pin(id: number) {
    await fetch(`/api/sessions/${id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ pin: true }) });
    loadSessions();
  }

  async function del(id: number) {
    if (!confirm('Hapus sesi ini?')) return;
    await fetch(`/api/sessions/${id}`, { method: 'DELETE' });
    loadSessions();
    if (id === activeId) {
      router.push('/chat');
    }
  }

  async function exportSession() {
    if (!activeId) return;
    const res = await fetch(`/api/sessions/${activeId}`);
    if (!res.ok) return;
    const s = await res.json();
    const md = `# ${s.title}\n\n` + s.messages.map((m: any) => `**${m.role === 'user' ? '🧑‍🎓 Kamu' : '🤖 Agent'}:** ${m.content}`).join('\n\n');
    const blob = new Blob([md], { type: 'text/markdown' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `sesi-${s.title.replace(/\W+/g, '-').slice(0, 30)}.md`;
    a.click();
    URL.revokeObjectURL(a.href);
  }

  return (
    <main className="flex h-screen relative overflow-hidden">
      {/* CSS-only mobile sidebar toggle */}
      <input type="checkbox" id="mobile-sidebar" className="peer hidden" />
      
      {/* Mobile Backdrop */}
      <label 
        htmlFor="mobile-sidebar" 
        className="fixed inset-0 z-40 hidden bg-black/50 backdrop-blur-sm peer-checked:block md:peer-checked:hidden md:hidden"
      />

      {/* Sidebar sesi */}
      <aside className="absolute inset-y-0 left-0 z-50 flex w-72 -translate-x-full flex-col border-r border-line bg-surface transition-transform duration-300 peer-checked:translate-x-0 md:static md:translate-x-0">
        <div className="flex items-center justify-between border-b border-line p-3">
          <a href="/" className="font-display text-sm font-bold tracking-tight hover:text-accent">← Materi</a>
          <div className="flex gap-1.5">
            <button onClick={exportSession} title="Export sesi (.md)" className="btn btn-ghost px-2 py-1.5 text-xs">⬇</button>
            <button onClick={newSession} className="btn btn-accent px-3 py-1.5 text-xs">+ Sesi baru</button>
          </div>
        </div>
        <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Cari sesi…" className="input m-3" />
        <div className="flex-1 overflow-y-auto">
          {sessions.length === 0 && !search && (
            <p className="px-4 py-6 text-center text-xs text-faint">Belum ada sesi.<br />Mulai yang pertama ↑</p>
          )}
          {sessions.map((s) => (
            <div
              key={s.id}
              onClick={() => {
                openSession(s.id);
                // Close sidebar on mobile after clicking
                const cb = document.getElementById('mobile-sidebar') as HTMLInputElement;
                if (cb && window.innerWidth < 768) cb.checked = false;
              }}
              className={`group flex cursor-pointer items-center justify-between gap-1 px-3 py-2.5 text-sm transition-colors ${
                s.id === activeId ? 'bg-raised text-fg' : 'text-muted hover:bg-raised/60 hover:text-fg'
              }`}
            >
              <span className="truncate">{s.pinned ? '📌 ' : ''}{s.title}</span>
              <span className="flex shrink-0 gap-0.5 opacity-0 transition-opacity group-hover:opacity-100 md:opacity-0">
                <button onClick={(e) => { e.stopPropagation(); rename(s.id); }} title="Rename" className="rounded px-1 text-xs text-faint hover:text-accent">✎</button>
                <button onClick={(e) => { e.stopPropagation(); pin(s.id); }} title="Pin" className="rounded px-1 text-xs text-faint hover:text-accent">📌</button>
                <button onClick={(e) => { e.stopPropagation(); del(s.id); }} title="Hapus" className="rounded px-1 text-xs text-faint hover:text-red-400">✕</button>
              </span>
            </div>
          ))}
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex flex-1 flex-col relative w-full overflow-hidden">
        {children}
      </div>
    </main>
  );
}
