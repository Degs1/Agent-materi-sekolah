import { NextResponse } from 'next/server';

export async function POST(req: Request) {
  try {
    const { password } = await req.json();
    const envPass = process.env.APP_PASSWORD;
    
    // Jika tidak ada APP_PASSWORD di env, anggap saja berhasil login
    if (!envPass) {
      return NextResponse.json({ ok: true });
    }

    if (password === envPass) {
      const res = NextResponse.json({ ok: true });
      // Set cookie auth_pass dengan umur 30 hari
      res.cookies.set('auth_pass', password, {
        httpOnly: true, // Tidak bisa diakses oleh client JS (lebih aman terhadap XSS)
        secure: process.env.NODE_ENV === 'production', // Harus pakai https jika production
        sameSite: 'lax',
        path: '/',
        maxAge: 60 * 60 * 24 * 30, // 30 hari
      });
      return res;
    }
    
    return NextResponse.json({ error: 'Password salah' }, { status: 401 });
  } catch (e: any) {
    return NextResponse.json({ error: 'Terjadi kesalahan' }, { status: 500 });
  }
}
