import { GoogleGenAI } from '@google/genai';

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! });
export const MODEL = 'gemini-2.5-flash';

const SYSTEM = `Kamu adalah asisten belajar (agent materi sekolah). Jawab berdasarkan materi yang diberikan.
Jika materi tidak cukup menjawab pertanyaan, gunakan pencarian web (grounding) untuk melengkapi.
Tandai sumber: "[Dari materi]" untuk isi dari materi pengguna, "[Dari web]" untuk tambahan dari internet.
Gunakan bahasa Indonesia yang jelas dan ringkas.`;

/** Streaming chat; callback per chunk teks. Return teks lengkap. */
export async function chatStream(
  materiText: string,
  history: { role: string; content: string }[],
  prompt: string,
  onChunk: (t: string) => void
): Promise<string> {
  const contents = [
    ...history.map((m) => ({ role: m.role === 'assistant' ? 'model' : 'user', parts: [{ text: m.content }] })),
    { role: 'user', parts: [{ text: prompt }] },
  ];
  const res = await ai.models.generateContentStream({
    model: MODEL,
    contents,
    config: {
      systemInstruction: SYSTEM + '\n\n=== MATERI ===\n' + materiText,
      tools: [{ googleSearch: {} }], // grounding: cari web bila materi kurang
    },
  });
  let full = '';
  for await (const chunk of res) {
    const t = chunk.text ?? '';
    full += t;
    onChunk(t);
  }
  return full;
}

/** Rangkum materi → markdown ringkas. */
export async function summarize(materiText: string): Promise<string> {
  const res = await ai.models.generateContent({
    model: MODEL,
    contents: [{ role: 'user', parts: [{ text: `Rangkum materi berikut menjadi catatan belajar ringkas (poin-poin penting, bahasa Indonesia):\n\n${materiText.slice(0, 50000)}` }] }],
  });
  return res.text ?? '';
}

/** Generate quiz (5 soal pilihan ganda) → JSON string. */
export async function generateQuiz(materiText: string): Promise<string> {
  const res = await ai.models.generateContent({
    model: MODEL,
    contents: [{ role: 'user', parts: [{ text: `Buat 5 soal pilihan ganda dari materi berikut, format JSON array: [{"question":"...","options":["a","b","c","d"],"answer":0}]. Hanya JSON, tanpa teks lain:\n\n${materiText.slice(0, 50000)}` }] }],
    config: { responseMimeType: 'application/json' },
  });
  return res.text ?? '[]';
}

/** Ekstrak teks dari file lokal (pdf/gambar) via Gemini multimodal. */
export async function extractText(filePath: string, mime: string): Promise<string> {
  const fs = await import('fs');
  const b64 = fs.readFileSync(filePath).toString('base64');
  const res = await ai.models.generateContent({
    model: MODEL,
    contents: [{ role: 'user', parts: [{ inlineData: { mimeType: mime, data: b64 } }, { text: 'Ekstrak semua teks dari dokumen ini. Output teks saja.' }] }],
  });
  return res.text ?? '';
}

/** Transkrip YouTube via Gemini (URL → ringkasan poin materi). */
export async function youtubeTranscript(url: string): Promise<string> {
  const res = await ai.models.generateContent({
    model: MODEL,
    contents: [{ role: 'user', parts: [{ text: `Ambil transkrip/ringkasan isi video YouTube ini (bisa pakai pencarian web): ${url}. Output: ringkasan poin-poin materi, bahasa Indonesia.` }] }],
    config: { tools: [{ googleSearch: {} }] },
  });
  return res.text ?? '';
}
