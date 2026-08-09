import Database from 'better-sqlite3';

export type Db = Database.Database;
export type Session = { id: number; title: string; pinned: number; created_at: string; updated_at: string };
export type Message = { id: number; session_id: number; role: 'user' | 'assistant'; content: string; created_at: string };

export function initDb(path: string): Db {
  const db = new Database(path);
  db.exec(`
    CREATE TABLE IF NOT EXISTS sessions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      pinned INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE TABLE IF NOT EXISTS messages (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      session_id INTEGER NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
      role TEXT NOT NULL CHECK (role IN ('user','assistant')),
      content TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
  `);
  return db;
}

export function createSession(db: Db, title = 'Sesi Baru'): number {
  const r = db.prepare('INSERT INTO sessions (title) VALUES (?)').run(title);
  return Number(r.lastInsertRowid);
}

export function listSessions(db: Db): Session[] {
  return db.prepare('SELECT * FROM sessions ORDER BY pinned DESC, updated_at DESC').all() as Session[];
}

export function getSession(db: Db, id: number): Session | undefined {
  return db.prepare('SELECT * FROM sessions WHERE id = ?').get(id) as Session | undefined;
}

export function renameSession(db: Db, id: number, title: string) {
  db.prepare("UPDATE sessions SET title = ?, updated_at = datetime('now') WHERE id = ?").run(title, id);
}

export function togglePin(db: Db, id: number) {
  db.prepare("UPDATE sessions SET pinned = 1 - pinned, updated_at = datetime('now') WHERE id = ?").run(id);
}

export function deleteSession(db: Db, id: number) {
  db.prepare('DELETE FROM sessions WHERE id = ?').run(id);
}

export function addMessage(db: Db, sessionId: number, role: 'user' | 'assistant', content: string) {
  db.prepare('INSERT INTO messages (session_id, role, content) VALUES (?, ?, ?)').run(sessionId, role, content);
  db.prepare("UPDATE sessions SET updated_at = datetime('now') WHERE id = ?").run(sessionId);
}

export function getMessages(db: Db, sessionId: number): Message[] {
  return db.prepare('SELECT * FROM messages WHERE session_id = ? ORDER BY id').all(sessionId) as Message[];
}

export function searchSessions(db: Db, q: string): Session[] {
  return db.prepare(
    'SELECT DISTINCT s.* FROM sessions s JOIN messages m ON m.session_id = s.id WHERE m.content LIKE ? ORDER BY s.updated_at DESC'
  ).all(`%${q}%`) as Session[];
}
