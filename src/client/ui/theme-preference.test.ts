import { describe, expect, it } from 'vitest';
import { readThemePreference, writeThemePreference } from './theme-preference.js';

function memoryStorage(initial: Record<string, string> = {}): Storage {
  const values = new Map(Object.entries(initial));
  return {
    getItem: key => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, String(value)),
    removeItem: key => { values.delete(key); },
    clear: () => values.clear(),
    key: index => [...values.keys()][index] ?? null,
    get length() { return values.size; },
  };
}

describe('theme preference persistence', () => {
  it('defaults to light when no preference has been saved', () => {
    expect(readThemePreference(memoryStorage())).toBe('light');
  });

  it('restores a selected dark preference after a new app instance reads storage', () => {
    const storage = memoryStorage();
    writeThemePreference('dark', storage);
    expect(readThemePreference(storage)).toBe('dark');
  });

  it('persists an explicit return to light mode', () => {
    const storage = memoryStorage({ 'sheepwolf.theme': 'dark' });
    writeThemePreference('light', storage);
    expect(readThemePreference(storage)).toBe('light');
  });

  it('uses the safe light default for an invalid stored value', () => {
    expect(readThemePreference(memoryStorage({ 'sheepwolf.theme': 'sepia' }))).toBe('light');
  });

  it('renders safely when reading or writing browser storage is unavailable', () => {
    const unavailable = {
      getItem: () => { throw new Error('storage denied'); },
      setItem: () => { throw new Error('storage denied'); },
    };
    expect(readThemePreference(unavailable)).toBe('light');
    expect(() => writeThemePreference('dark', unavailable)).not.toThrow();
    expect(() => writeThemePreference('light', null)).not.toThrow();
    expect(readThemePreference(null)).toBe('light');
  });
});
