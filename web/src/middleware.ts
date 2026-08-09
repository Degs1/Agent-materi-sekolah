import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function middleware(request: NextRequest) {
  const password = process.env.APP_PASSWORD;
  
  // Jika APP_PASSWORD tidak di-set, matikan fitur proteksi (untuk dev)
  if (!password) {
    return NextResponse.next();
  }

  const isLoginPage = request.nextUrl.pathname.startsWith('/login');
  
  // Kecualikan file statis Next.js dan file uploads
  if (
    request.nextUrl.pathname.startsWith('/_next') ||
    request.nextUrl.pathname.startsWith('/favicon.ico') ||
    request.nextUrl.pathname.startsWith('/uploads')
  ) {
    return NextResponse.next();
  }

  const cookiePass = request.cookies.get('auth_pass')?.value;

  // Cek apakah password di cookie cocok dengan di env
  if (cookiePass === password) {
    if (isLoginPage) {
      // Kalau sudah login tapi buka halaman /login, kembalikan ke beranda
      return NextResponse.redirect(new URL('/', request.url));
    }
    return NextResponse.next(); // Lanjut
  }

  // Jika cookie salah atau tidak ada
  if (isLoginPage || request.nextUrl.pathname.startsWith('/api/auth')) {
    return NextResponse.next(); // Izinkan masuk ke halaman login
  }

  // Jika mencoba akses API, tolak dengan 401 dan hapus cookie
  if (request.nextUrl.pathname.startsWith('/api/') && !request.nextUrl.pathname.startsWith('/api/auth')) {
    const res = NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    res.cookies.delete('auth_pass');
    return res;
  }

  // Jika mencoba akses UI, alihkan ke login dan hapus cookie
  const response = NextResponse.redirect(new URL('/login', request.url));
  response.cookies.delete('auth_pass');
  return response;
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
