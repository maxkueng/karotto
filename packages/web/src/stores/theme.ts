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

export const resolvedTheme = createMemo(() => resolveTheme(
  theme(),
  preferredMode(),
));

/** True when the current theme ships both a light and a dark variant. */
export const canSwitchMode = createMemo(() => themeModes(theme()).length === 2);

function apply(): void {
  const root = document.documentElement;
  const {
    mode,
    tokens,
  } = resolvedTheme();
  Object.entries(tokens).forEach(([
    key,
    value,
  ]) => root.style.setProperty(
    `--color-${key}`,
    value,
  ));
  root.style.colorScheme = mode;
  root.dataset.theme = theme().id;
  root.dataset.mode = mode;
}

/** Installs the theme before the first render and keeps the document in sync afterwards. */
export function initTheme(): void {
  createRoot(() => {
    createEffect(apply);
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

export function resetTheme(): void {
  setThemeId(defaultThemeId);
  setModePreference('system');
}
