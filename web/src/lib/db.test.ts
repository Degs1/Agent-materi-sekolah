import { describe, it, expect } from 'vitest';
import { initDb, createSession, listSessions, getSession, renameSession, deleteSession, togglePin, searchSessions, addMessage, getMessages } from './db';

describe('db', () => {
  it('creates session and lists it', () => {
    const db = initDb(':memory:');
    const id = createSession(db, 'Quiz Fisika');
    const list = listSessions(db);
    expect(list).toHaveLength(1);
    expect(list[0].title).toBe('Quiz Fisika');
    expect(list[0].pinned).toBe(0);
    expect(id).toBeGreaterThan(0);
  });

  it('renames, pins, deletes', () => {
    const db = initDb(':memory:');
    const id = createSession(db, 'A');
    renameSession(db, id, 'B');
    togglePin(db, id);
    expect(getSession(db, id)?.title).toBe('B');
    expect(getSession(db, id)?.pinned).toBe(1);
    deleteSession(db, id);
    expect(getSession(db, id)).toBeUndefined();
  });

  it('stores messages per session', () => {
    const db = initDb(':memory:');
    const id = createSession(db, 'S');
    addMessage(db, id, 'user', 'apa itu fotosintesis?');
    addMessage(db, id, 'assistant', 'fotosintesis adalah...');
    const msgs = getMessages(db, id);
    expect(msgs).toHaveLength(2);
    expect(msgs[0].role).toBe('user');
  });

  it('searches within session messages', () => {
    const db = initDb(':memory:');
    const id = createSession(db, 'S');
    addMessage(db, id, 'user', 'jelaskan hukum newton');
    const hits = searchSessions(db, 'newton');
    expect(hits[0].id).toBe(id);
  });
});
