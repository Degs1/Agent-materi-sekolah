import { describe, it, expect } from 'vitest';
import { validatePathSegments } from './drive';

describe('validatePathSegments', () => {
  it('cleans illegal chars', () => {
    expect(validatePathSegments('Matematika/ X', 'Bab 1: A').mapel).toBe('Matematika- X');
    expect(validatePathSegments('Fisika', 'Bab 2*').bab).toBe('Bab 2-');
  });
  it('rejects empty', () => {
    expect(() => validatePathSegments('', 'Bab 1')).toThrow();
    expect(() => validatePathSegments('Matematika', '  ')).toThrow();
  });
});
