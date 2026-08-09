'use client';

import { useEffect, useRef, useState } from 'react';

type Msg = { id: number; session_id: number; role: 'user' | 'assistant'; content: string; created_at: string };
type Session = { id: number; title: string; pinned: number; created_at: string; updated_at: string };

export default function ChatPage() {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [activeId, setActiveId] = useState<number | null>(null);
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState('');
  const [streaming, setStreaming] = useState(false);
  const [err, setErr] = useState('');
  const [search, setSearch] = useState('');
  const [materiPick, setMateriPick] = useState(''); // mapel/bab, opsional
  const bottomRef = useRef<HTMLDivElement>(null);

  async function loadSessions() {
    const res = await fetch(`/api/sessions${search ? `?q=${encodeURIComponent(search)}` : ''}`);
    if (res.ok) setSessions(await res.json());
  }

  useEffect(() => { loadSessions(); }, [search]);

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages]);

  async function newSession() {
    const res = await fetch('/api/sessions', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({}) });
    const s = await res.json();
    setActiveId(s.id); setMessages([]); setErr('');
    loadSessions();
  }

  async function openSession(id: number) {
    setActiveId(id);
    const res = await fetch(`/api/sessions/${id}`);
    if (res.ok) {
      const s = await res.json();
      setMessages(s.messages ?? []);
    }
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
    if (id === activeId) { setActiveId(null); setMessages([]); }
    loadSessions();
  }

  async function exportSession() {
    if (!activeId) return;
    const res = await fetch(`/api/sessions/${activeId}`);
    const s = await res.json();
    const md = `# ${s.title}\n\n` + s.messages.map((m: Msg) => `**${m.role === 'user' ? '🧑‍🎓 Kamu' : '🤖 Agent'}:** ${m.content}`).join('\n\n');
    const blob = new Blob([md], { type: 'text/markdown' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `sesi-${s.title.replace(/\W+/g, '-').slice(0, 30)}.md`;
    a.click();
    URL.revokeObjectURL(a.href);
  }

  async function send(e: React.FormEvent) {
    e.preventDefault();
    if (!input.trim() || streaming || !activeId) return;
    const prompt = input.trim();
    setInput('');
    setMessages((m) => [...m, { id: Date.now(), session_id: activeId, role: 'user', content: prompt, created_at: '' }]);
    setErr('');
    setStreaming(true);

    const res = await fetch('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sessionId: activeId, prompt, materiText: materiPick }),
    });
    if (!res.ok || !res.body) {
      const data = await res.json().catch(() => ({}));
      setErr(data.error ?? 'Gagal kirim'); setStreaming(false); return;
    }

    let acc = '';
    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    const update = (text: string) =>
      setMessages((m) => {
        const copy = [...m];
        const last = copy[copy.length - 1];
        if (last?.role === 'assistant') copy[copy.length - 1] = { ...last, content: text };
        else copy.push({ id: Date.now(), session_id: activeId, role: 'assistant', content: text, created_at: '' });
        return copy;
      });

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const parts = buffer.split('\n\n');
        buffer = parts.pop() ?? '';
        for (const p of parts) {
          if (!p.startsWith('data: ')) continue;
          const data = JSON.parse(p.slice(6));
          if (data.type === 'chunk') { acc += data.text; update(acc); }
          else if (data.type === 'done') { loadSessions(); }
          else if (data.type === 'error') setErr(data.message);
        }
      }
    } catch (e: any) {
      setErr(`Koneksi terputus: ${e.message}`);
    } finally {
      setStreaming(false);
    }
  }

  return (
    <main className="flex h-screen bg-gray-50">
      {/* Sidebar sesi */}
      <aside className="flex w-72 flex-col border-r bg-white">
        <div className="flex items-center justify-between p-3 border-b">
          <span className="font-bold">💬 Sesi</span>
          <div className="flex gap-1">
            <button onClick={newSession} title="Sesi baru" className="rounded bg-blue-600 px-2 py-1 text-xs font-semibold text-white">+ Baru</button>
            <button onClick={exportSession} title="Export sesi (.md)" className="rounded bg-gray-200 px-2 py-1 text-xs font-semibold">⬇️</button>
          </div>
        </div>
        <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="🔍 Cari sesi..." className="m-3 rounded border px-2 py-1 text-sm" />
        <div className="flex-1 overflow-y-auto">
          {sessions.map((s) => (
            <div key={s.id} className={`flex items-center justify-between px-3 py-2 cursor-pointer hover:bg-gray-100 ${s.id === activeId ? 'bg-blue-50' : ''}`} onClick={() => openSession(s.id)}>
              <span className="truncate text-sm">{s.pinned ? '📌 ' : ''}{s.title}</span>
              <span className="flex shrink-0 gap-1">
                <button onClick={(e) => { e.stopPropagation(); rename(s.id); }} title="Rename" className="text-xs text-gray-500 hover:text-blue-600">✏️</button>
                <button onClick={(e) => { e.stopPropagation(); pin(s.id); }} title="Pin" className="text-xs text-gray-500 hover:text-yellow-600">📌</button>
                <button onClick={(e) => { e.stopPropagation(); del(s.id); }} title="Hapus" className="text-xs text-gray-500 hover:text-red-600">🗑️</button>
              </span>
            </div>
          ))}
        </div>
      </aside>

      {/* Chat area */}
      <section className="flex flex-1 flex-col">
        <header className="flex items-center gap-3 border-b bg-white p-3">
          <span className="text-sm font-semibold">{activeId ? (sessions.find((s) => s.id === activeId)?.title ?? 'Sesi') : 'Pilih / buat sesi'}</span>
          <input value={materiPick} onChange={(e) => setMateriPick(e.target.value)} placeholder="Fokus materi (opsional): Matematika/Bab 1" className="flex-1 rounded border px-2 py-1 text-sm" />
        </header>

        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {!activeId && <p className="text-center text-gray-400 mt-10">Buat sesi baru atau pilih sesi untuk mulai belajar 💡</p>}
          {messages.map((m, i) => (
            <div key={i} className={`max-w-[80%] whitespace-pre-wrap rounded-lg p-3 text-sm ${m.role === 'user' ? 'ml-auto bg-blue-600 text-white' : 'bg-white shadow-sm'}`}>
              {m.content}
            </div>
          ))}
          {streaming && <div className="text-xs text-gray-400">mengetik...</div>}
          {err && <div className="rounded bg-red-50 p-3 text-sm text-red-700">
            {err}
            <button onClick={() => setErr('')} className="ml-2 text-xs underline">tutup</button>
          </div>}
          <div ref={bottomRef} />
        </div>

        <form onSubmit={send} className="border-t bg-white p-3 flex gap-2">
          <input value={input} onChange={(e) => setInput(e.target.value)} placeholder="Tanya materi, minta rangkuman/quiz..." disabled={!activeId || streaming} className="flex-1 rounded border px-3 py-2 text-sm" />
          <button disabled={!activeId || streaming || !input.trim()} className="rounded bg-blue-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">Kirim</button>
        </form>
      </section>
    </main>
  );
}
