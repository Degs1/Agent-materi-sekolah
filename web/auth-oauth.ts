/**
 * One-time OAuth setup: dapatkan refresh token untuk akun Google pribadimu.
 *
 * Jalankan dua langkah:
 *   1) npx tsx auth-oauth.ts            → print URL untuk dibuka di browser
 *   2) npx tsx auth-oauth.ts '<code>'   → code = nilai "code=" dari URL redirect setelah approve
 *
 * Butuh GOOGLE_CLIENT_ID & GOOGLE_CLIENT_SECRET di .env (dari OAuth client "Desktop app").
 */
import fs from 'fs';

// Load .env manual (tanpa dependency dotenv)
for (const line of fs.readFileSync('.env', 'utf8').split('\n')) {
  const m = line.match(/^([A-Z_]+)=(.*)$/);
  if (m) process.env[m[1]] = m[2];
}
import { google } from 'googleapis';

const SCOPES = ['https://www.googleapis.com/auth/drive.file'];

async function main() {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    console.error('Isi GOOGLE_CLIENT_ID & GOOGLE_CLIENT_SECRET di .env dulu.');
    process.exit(1);
  }

  const oauth = new google.auth.OAuth2(clientId, clientSecret, 'http://localhost');
  const codeArg = process.argv[2];

  if (!codeArg) {
    const authUrl = oauth.generateAuthUrl({ access_type: 'offline', prompt: 'consent', scope: SCOPES });
    console.log('AUTH_URL_BEGIN\n' + authUrl + '\nAUTH_URL_END');
    return;
  }

  const code = codeArg.includes('code=') ? decodeURIComponent(codeArg.split('code=')[1].split('&')[0]) : codeArg;
  const { tokens } = await oauth.getToken(code);
  if (!tokens.refresh_token) {
    console.error('Tidak dapat refresh_token (mungkin sudah pernah). Hapus akses app di myaccount.google.com → Security → Third-party access, lalu ulangi dengan prompt=consent.');
    process.exit(1);
  }
  console.log('REFRESH_TOKEN_BEGIN\n' + tokens.refresh_token + '\nREFRESH_TOKEN_END');
}
main();
