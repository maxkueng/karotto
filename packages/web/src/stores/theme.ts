import {
  defaultThemeId,
  findTheme,
  resolveTheme,
  themeModes,
} from '@karotto/core';
import type {
  ThemeMode,
  ThemeSpec,
} from '@karotto/core';
import {
  createEffect,
  createMemo,
  createRoot,
  createSignal,
} from 'solid-js';
import { takeHashParam } from '@/lib/hash';

export type ModePreference = 'system' | 'light' | 'dark';

const THEME_KEY = 'karotto.theme';
const MODE_KEY = 'karotto.mode';

function stored(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function store(
  key: string,
  value: string,
): void {
  try {
    localStorage.setItem(
      key,
      value,
    );
  } catch {
    // Storage unavailable; the choice still applies for this page load.
  }
}

const isModePreference = (value: string | null): value is ModePreference => value === 'system' || value === 'light' || value === 'dark';

export const [
  themeId,
  setThemeId,
] = createSignal<string>(findTheme(stored(THEME_KEY)).id);

export const [
  modePreference,
  setModePreference,
] = createSignal<ModePreference>(isModePreference(stored(MODE_KEY)) ? stored(MODE_KEY) as ModePreference : 'system');

const darkQuery = window.matchMedia('(prefers-color-scheme: dark)');
const [
  systemDark,
  setSystemDark,
] = createSignal(darkQuery.matches);
darkQuery.addEventListener(
  'change',
  (event) => setSystemDark(event.matches),
);

export const theme = createMemo<ThemeSpec>(() => findTheme(themeId()));

export const preferredMode = createMemo<ThemeMode>(() => {
  const preference = modePreference();
  if (preference === 'system') {
    return systemDark() ? 'dark' : 'light';
  }
  return preference;
});

/** True when the current theme ships both a light and a dark variant. */
export const canSwitchMode = createMemo(() => themeModes(theme()).length === 2);

function paint(
  root: HTMLElement,
  spec: ThemeSpec,
  preferred: ThemeMode,
): void {
  const {
    mode,
    tokens,
  } = resolveTheme(
    spec,
    preferred,
  );
  Object.entries(tokens).forEach(([
    key,
    value,
  ]) => root.style.setProperty(
    `--color-${key}`,
    value,
  ));
  root.style.colorScheme = mode;
  root.dataset.theme = spec.id;
  root.dataset.mode = mode;
}

/** Installs the theme before the first render and keeps the document in sync afterwards. */
export function initTheme(): void {
  createRoot(() => {
    createEffect(() => paint(
      document.documentElement,
      theme(),
      preferredMode(),
    ));
    createEffect(() => store(
      THEME_KEY,
      themeId(),
    ));
    createEffect(() => store(
      MODE_KEY,
      modePreference(),
    ));
  });
}

/** Themes one element without touching the document or the saved choice. */
export function themeElement(
  root: HTMLElement,
  id: () => string,
  mode: () => ThemeMode,
): () => void {
  return createRoot((dispose) => {
    createEffect(() => paint(
      root,
      findTheme(id()),
      mode(),
    ));
    return dispose;
  });
}

export function applyHashTheme(): void {
  const id = takeHashParam('theme');
  if (id !== null && findTheme(id).id === id) {
    setThemeId(id);
  }
  const mode = takeHashParam('mode');
  if (isModePreference(mode)) {
    setModePreference(mode);
  }
}

export function resetTheme(): void {
  setThemeId(defaultThemeId);
  setModePreference('system');
}
