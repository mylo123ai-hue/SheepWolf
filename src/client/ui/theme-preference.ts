export type ThemePreference = 'light' | 'dark';

const STORAGE_KEY = 'sheepwolf.theme';

function browserStorage(): Storage | null {
  try {
    return globalThis.localStorage ?? null;
  } catch {
    return null;
  }
}

export function readThemePreference(storage: Pick<Storage, 'getItem'> | null = browserStorage()): ThemePreference {
  try {
    const value = storage?.getItem(STORAGE_KEY);
    return value === 'dark' || value === 'light' ? value : 'light';
  } catch {
    return 'light';
  }
}

export function writeThemePreference(theme: ThemePreference, storage: Pick<Storage, 'setItem'> | null = browserStorage()): void {
  try {
    storage?.setItem(STORAGE_KEY, theme);
  } catch {
    // A blocked or full browser storage area should not prevent the app from rendering.
  }
}
