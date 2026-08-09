'use client';

import { useEffect, useRef, useState } from 'react';
import { useParams } from 'next/navigation';
import Md from '@/components/md';

type Msg = { id: number; session_id: number; role: 'user' | 'assistant'; content: string; created_at: string };
type Session = { id: number; title: string; pinned: number; created_at: string; updated_at: string };
type Bab = { _id: string; bab: string };
type Mapel = { _id: string; mapel: string; babs: Bab[] };

export default function ChatSessionPage() {
  const params = useParams();
  const activeId = params.id ? Number(params.id) : null;

  const [session, setSession] = useState<Session | null>(null);
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState('');
  const [streaming, setStreaming] = useState(false);
  const [err, setErr] = useState('');

  const [materiTree, setMateriTree] = useState<Mapel[]>([]);
  const [selectedMapelName, setSelectedMapelName] = useState('');
  const [selectedBabName, setSelectedBabName] = useState('');
  const [metaInfo, setMetaInfo] = useState('');

  const [tokens, setTokens] = useState({ total: 0, limit: 1048576 });
  const [isUploading, setIsUploading] = useState(false);
  const [partialText, setPartialText] = useState('');
  const [copiedId, setCopiedId] = useState<number | null>(null);

  const bottomRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const pollIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Load Materi Tree
  useEffect(() => {
    fetch('/api/materi')
      .then((r) => r.ok ? r.json() : [])
      .then((tree) => setMateriTree(tree))
      .catch(() => {});

    return () => stopPolling();
  }, []);

  // Load Session details & Messages
  useEffect(() => {
    if (!activeId) return;
    fetch(`/api/sessions/${activeId}`)
      .then((res) => res.ok ? res.json() : null)
      .then((data) => {
        if (data) {
          setSession(data);
          setMessages(data.messages ?? []);
        }
      })
      .catch(() => {});
      
    updateTokens();
    checkStatus();
  }, [activeId]);

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages, partialText]);

  async function updateTokens() {
    if (!activeId) return;
    const materiText = selectedMapelName && selectedBabName ? `${selectedMapelName}/${selectedBabName}` : '';
    fetch(`/api/sessions/${activeId}/tokens?materiText=${encodeURIComponent(materiText)}`)
      .then(r => r.ok ? r.json() : null)
      .then(data => {
        if (data) setTokens({ total: data.totalTokens, limit: data.limit });
      });
  }

  useEffect(() => { updateTokens(); }, [messages, selectedMapelName, selectedBabName]);

  function checkStatus() {
    if (!activeId) return;
    fetch(`/api/chat/status?sessionId=${activeId}`)
      .then(r => r.json())
      .then(data => {
        if (data.active) {
          setStreaming(true);
          setPartialText(data.text);
          startPolling();
        } else {
          stopPolling();
          setStreaming(false);
          setPartialText('');
          fetch(`/api/sessions/${activeId}`).then(r => r.json()).then(d => {
            if (d && d.messages) setMessages(d.messages);
          });
          updateTokens();
        }
      }).catch(() => stopPolling());
  }

  function startPolling() {
    if (pollIntervalRef.current) return;
    pollIntervalRef.current = setInterval(() => checkStatus(), 1500);
  }

  function stopPolling() {
    if (pollIntervalRef.current) {
      clearInterval(pollIntervalRef.current);
      pollIntervalRef.current = null;
    }
  }

  function copyToClipboard(id: number, text: string) {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  }

  async function uploadFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !activeId) return;
    setIsUploading(true);
    const fd = new FormData();
    fd.append('file', file);
    
    try {
      const res = await fetch('/api/upload/chat', { method: 'POST', body: fd });
      const data = await res.json();
      if (data.url) {
        setInput(prev => prev + `\n![Attachment](${data.url})\n`);
      }
    } catch(err) {
      setErr('Gagal upload file');
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  }

  async function stopGeneration() {
    if (!activeId) return;
    await fetch('/api/chat/stop', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sessionId: activeId })
    });
    setStreaming(false);
    setPartialText('');
    stopPolling();
  }

  async function send(e: React.FormEvent) {
    e.preventDefault();
    if (!input.trim() || streaming || !activeId) return;
    
    if (tokens.total >= tokens.limit * 0.95) {
      setErr('Limit token hampir tercapai, harap buat sesi baru.');
      return;
    }

    const prompt = input.trim();
    setInput('');
    setMetaInfo('');
    setMessages((m) => [...m, { id: Date.now(), session_id: activeId, role: 'user', content: prompt, created_at: '' }]);
    setErr('');
    setStreaming(true);
    setPartialText('');

    const materiText = selectedMapelName && selectedBabName ? `${selectedMapelName}/${selectedBabName}` : '';

    const res = await fetch('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sessionId: activeId, prompt, materiText }),
    });
    if (!res.ok || !res.body) {
      const data = await res.json().catch(() => ({}));
      setErr(data.error ?? 'Gagal kirim'); setStreaming(false); return;
    }

    let acc = '';
    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';

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
          if (data.type === 'chunk') { acc += data.text; setPartialText(acc); }
          else if (data.type === 'error') { setErr(data.message); }
          else if (data.type === 'meta') { setMetaInfo(data.materia); }
        }
      }
    } catch (e: any) {
      // Disconnected, let background process continue and start polling
      startPolling();
    } finally {
      // Stream finished or aborted. Polling will double check.
      checkStatus();
    }
  }

  const selectedMapel = materiTree.find(m => m.mapel === selectedMapelName);
  const babOpts = selectedMapel?.babs || [];
  
  const tokenPct = Math.min((tokens.total / tokens.limit) * 100, 100);

  return (
    <section className="flex flex-1 flex-col relative overflow-hidden h-full">
      <header className="flex flex-col border-b border-line bg-surface/70">
        <div className="flex flex-wrap items-center gap-2 px-3 py-2.5 sm:gap-3 sm:px-4">
          <label htmlFor="mobile-sidebar" className="cursor-pointer text-lg md:hidden p-1 mr-1">☰</label>
          <span className="text-sm font-semibold truncate max-w-[120px] sm:max-w-[200px]" title={session?.title}>
            {session?.title ?? 'Memuat sesi...'}
          </span>
          
          <div className="ml-auto flex items-center gap-1 sm:gap-2">
            <span className="text-xs text-muted hidden sm:inline">Fokus:</span>
            <select 
              value={selectedMapelName} 
              onChange={(e) => {
                setSelectedMapelName(e.target.value);
                setSelectedBabName('');
              }}
              className="input w-20 py-1 px-1 sm:px-3 text-xs sm:w-32"
            >
              <option value="">Mapel...</option>
              {materiTree.map(m => (
                <option key={m._id} value={m.mapel}>{m.mapel}</option>
              ))}
            </select>

            <select 
              value={selectedBabName} 
              onChange={(e) => setSelectedBabName(e.target.value)}
              disabled={!selectedMapelName}
              className="input w-20 py-1 px-1 sm:px-3 text-xs sm:w-32"
            >
              <option value="">Bab...</option>
              {babOpts.map(b => (
                <option key={b._id} value={b.bab}>{b.bab}</option>
              ))}
            </select>
          </div>
        </div>
        
        {/* Token Progress Bar */}
        <div className="w-full bg-raised h-1 relative" title={`${tokens.total} / ${tokens.limit} tokens`}>
          <div 
            className={`h-full ${tokenPct > 90 ? 'bg-red-500' : tokenPct > 70 ? 'bg-yellow-500' : 'bg-accent'}`} 
            style={{ width: `${tokenPct}%` }} 
          />
        </div>
      </header>

      <div className="flex-1 space-y-3 overflow-y-auto p-4">
        {messages.map((m, i) => (
          <div key={i} className="flex flex-col">
            <div
              className={`max-w-[85%] md:max-w-[78%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed ${
                m.role === 'user'
                  ? 'ml-auto bg-accent text-ink whitespace-pre-wrap'
                  : 'border border-line bg-surface'
              }`}
            >
              {m.role === 'user' ? m.content : <Md text={m.content} />}
            </div>
            {m.role === 'assistant' && (
              <div className="mt-1 flex items-center gap-2 px-2">
                <button 
                  onClick={() => copyToClipboard(m.id, m.content)} 
                  className="text-[0.7rem] text-faint hover:text-accent transition-colors flex items-center gap-1"
                  title="Salin jawaban"
                >
                  {copiedId === m.id ? '✓ Tersalin' : '📋 Salin'}
                </button>
              </div>
            )}
          </div>
        ))}
        {streaming && partialText && (
          <div className="max-w-[78%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed border border-line bg-surface">
            <Md text={partialText} />
          </div>
        )}
        {streaming && !partialText && <div className="ml-14 text-xs text-faint typing">agent sedang memproses...</div>}
        {metaInfo && (
          <p className="ml-14 max-w-[70%] truncate rounded-lg border border-line bg-raised/50 px-3 py-1.5 text-[0.7rem] text-muted" title={metaInfo}>
            📎 materi: {metaInfo.slice(0, 200)}{metaInfo.length > 200 ? '…' : ''}
          </p>
        )}
        {err && (
          <div className="flex items-center gap-3 rounded-xl border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-400">
            {err}
            <button onClick={() => setErr('')} className="ml-auto text-xs underline">tutup</button>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      <form onSubmit={send} className="flex gap-2 border-t border-line bg-surface p-3 items-center">
        <input 
          type="file" 
          ref={fileInputRef} 
          className="hidden" 
          onChange={uploadFile} 
          accept="image/*,.pdf"
        />
        <button 
          type="button" 
          title="Attach Image/PDF"
          onClick={() => fileInputRef.current?.click()}
          disabled={!activeId || streaming || isUploading}
          className="btn btn-ghost px-3 py-2"
        >
          {isUploading ? '...' : '📎'}
        </button>
        <input
          value={input} onChange={(e) => setInput(e.target.value)}
          placeholder="Ketik pesan atau upload file..."
          disabled={!activeId || streaming || isUploading || tokenPct > 95}
          className="input flex-1"
        />
        {streaming ? (
          <button type="button" onClick={stopGeneration} className="btn bg-red-500/20 text-red-500 hover:bg-red-500/30 px-5 py-2">
            Stop
          </button>
        ) : (
          <button
            disabled={!activeId || !input.trim() || isUploading || tokenPct > 95}
            className="btn btn-accent px-5 py-2"
          >
            Kirim
          </button>
        )}
      </form>
    </section>
  );
}
