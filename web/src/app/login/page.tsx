'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function LoginPage() {
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    if (!password) return;
    
    setLoading(true);
    setError('');
    
    try {
      const res = await fetch('/api/auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password }),
      });
      
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Login gagal');
      }
      
      // Jika sukses, refresh halaman (middleware akan mengarahkan ke halaman asal atau ke beranda)
      router.push('/');
      router.refresh();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center p-5 relative overflow-hidden bg-base">
      {/* Background decorations */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-accent opacity-20 blur-[100px] pointer-events-none rounded-full" />
      
      <div className="card w-full max-w-sm p-8 relative z-10">
        <div className="mb-8 text-center">
          <h1 className="font-display text-2xl font-bold tracking-tight mb-2">Login</h1>
          <p className="text-sm text-muted">Akses terkunci. Silakan masukkan password untuk melanjutkan.</p>
        </div>

        <form onSubmit={handleLogin} className="space-y-4">
          <div>
            <input
              type="password"
              placeholder="Masukkan password"
              className="input w-full p-3 font-mono tracking-widest text-center"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              disabled={loading}
              autoFocus
            />
          </div>

          <button
            type="submit"
            disabled={loading || !password}
            className="btn btn-accent w-full py-3 flex justify-center text-center"
          >
            {loading ? 'Memeriksa...' : 'Masuk'}
          </button>
        </form>

        {error && (
          <p className="mt-4 text-sm text-red-400 text-center animate-in fade-in slide-in-from-bottom-2">
            {error}
          </p>
        )}
      </div>
    </main>
  );
}
