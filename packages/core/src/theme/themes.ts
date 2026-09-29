import {
  mix,
  shift,
} from '@karotto/core/theme/oklch';

export const hueNames = [
  'maroon',
  'red',
  'orange',
  'yellow',
  'green',
  'teal',
  'blue',
] as const;
export type HueName = (typeof hueNames)[number];

export const brandSteps = [
  50,
  100,
  200,
  300,
  400,
  500,
  600,
  700,
  800,
] as const;
export const neutralSteps = [
  10,
  50,
  100,
  200,
  300,
  400,
  500,
  600,
  700,
] as const;
export const hueSteps = [
  1,
  5,
  10,
  50,
  100,
  500,
  600,
  700,
] as const;

export type ThemeMode = 'light' | 'dark';

export type ThemeVariant = {
  /** Strongest text colour; the neutral scale runs from here to `page`. */
  ink: string;
  page: string;
  /** Card and input background. Defaults to white on light themes and a barely lifted page on dark ones. */
  surface?: string;
  /** The brand colour at its main step (300). */
  brand: string;
  /** Top bar background and its hover shade; default to the darker brand steps. */
  nav?: string;
  navHover?: string;
  brandRamp?: Partial<Record<(typeof brandSteps)[number], string>>;
  /** Each hue's representative colour (its 100 step). */
  hues: Record<HueName, string>;
  hueRamps?: Partial<Record<HueName, Partial<Record<(typeof hueSteps)[number], string>>>>;
  /** Muted mid-tone per hue, used for secondary text on tinted forms. */
  hueSubText?: Partial<Record<HueName, string>>;
};

export type ThemeSpec = {
  id: string;
  name: string;
  light?: ThemeVariant;
  dark?: ThemeVariant;
};

/** Flat token map: `brand-300`, `neutral-50`, `red-100`, `surface`, `ink`, `page`, `well` (recessed input), `popover` (floating panels), `nav` (top bar). */
export type ThemeTokens = Record<string, string>;

type NeutralPositions = Record<(typeof neutralSteps)[number], number>;

const lightNeutralPositions: NeutralPositions = {
  10: 0,
  50: 0.14,
  100: 0.3,
  200: 0.46,
  300: 0.6,
  400: 0.74,
  500: 0.86,
  600: 0.93,
  700: 1,
};

/** Dark themes lift the column background so cards, which sit near the page, read as darker inserts. */
const darkNeutralPositions: NeutralPositions = {
  10: 0,
  50: 0.14,
  100: 0.3,
  200: 0.46,
  300: 0.6,
  400: 0.72,
  500: 0.82,
  600: 0.9,
  700: 1,
};

function brandRamp(variant: ThemeVariant): Record<string, string> {
  const base = variant.brand;
  const generated: Record<(typeof brandSteps)[number], string> = {
    50: shift(
      base,
      -0.2,
      0.9,
    ),
    100: shift(
      base,
      -0.14,
      0.95,
    ),
    200: shift(
      base,
      -0.07,
    ),
    300: base,
    400: shift(
      base,
      0.13,
      0.95,
    ),
    500: shift(
      base,
      0.27,
      0.6,
    ),
    600: shift(
      base,
      0.34,
      0.4,
    ),
    700: shift(
      base,
      0.4,
      0.22,
    ),
    800: shift(
      base,
      0.44,
      0.12,
    ),
  };
  const tokens: Record<string, string> = {};
  brandSteps.forEach((step) => {
    tokens[`brand-${step}`] = variant.brandRamp?.[step] ?? generated[step];
  });
  return tokens;
}

function hueRamp(
  name: HueName,
  variant: ThemeVariant,
): Record<string, string> {
  const base = variant.hues[name];
  const generated: Record<(typeof hueSteps)[number], string> = {
    1: shift(
      base,
      -0.4,
      0.8,
      0.22,
    ),
    5: shift(
      base,
      -0.15,
      1.05,
    ),
    10: shift(
      base,
      -0.1,
      1.08,
    ),
    50: shift(
      base,
      -0.05,
      1.04,
    ),
    100: base,
    500: shift(
      base,
      0.14,
      0.55,
      0.08,
      0.93,
    ),
    600: shift(
      base,
      0.24,
      0.2,
      0.08,
      0.96,
    ),
    700: shift(
      base,
      0.27,
      0.1,
      0.08,
      0.985,
    ),
  };
  const tokens: Record<string, string> = {};
  hueSteps.forEach((step) => {
    tokens[`${name}-${step}`] = variant.hueRamps?.[name]?.[step] ?? generated[step];
  });
  tokens[`${name}-sub`] = variant.hueSubText?.[name] ?? shift(
    base,
    -0.12,
    0.35,
  );
  return tokens;
}

export function buildTokens(
  variant: ThemeVariant,
  mode: ThemeMode,
): ThemeTokens {
  const tokens: ThemeTokens = {
    ink: variant.ink,
    page: variant.page,
    surface: variant.surface ?? (mode === 'light'
      ? '#ffffff'
      : mix(
          variant.page,
          variant.ink,
          0.04,
        )),
    ...brandRamp(variant),
  };
  const positions = mode === 'light' ? lightNeutralPositions : darkNeutralPositions;
  neutralSteps.forEach((step) => {
    tokens[`neutral-${step}`] = mix(
      variant.ink,
      variant.page,
      positions[step],
    );
  });
  hueNames.forEach((name) => {
    Object.assign(
      tokens,
      hueRamp(
        name,
        variant,
      ),
    );
  });
  const column = tokens['neutral-600']!;
  tokens.well = mode === 'light'
    ? mix(
        column,
        variant.ink,
        0.06,
      )
    : mix(
        variant.page,
        variant.ink,
        0.015,
      );
  /* Tinted form backgrounds: pale hue tints on light themes, hue-washed page on dark ones. */
  const washed = (
    accent: string,
    amount: number,
  ) => mix(
    variant.page,
    accent,
    amount,
  );
  hueNames.forEach((name) => {
    tokens[`${name}-tint`] = mode === 'light'
      ? tokens[`${name}-700`]!
      : washed(
          variant.hues[name],
          0.08,
        );
    tokens[`${name}-tint-offset`] = mode === 'light'
      ? tokens[`${name}-600`]!
      : washed(
          variant.hues[name],
          0.18,
        );
  });
  tokens['brand-tint'] = mode === 'light'
    ? tokens['brand-800']!
    : washed(
        variant.brand,
        0.08,
      );
  tokens['brand-tint-offset'] = mode === 'light'
    ? tokens['brand-700']!
    : washed(
        variant.brand,
        0.18,
      );
  tokens.nav = variant.nav ?? tokens['brand-100']!;
  tokens['nav-hover'] = variant.navHover ?? tokens['brand-200']!;
  tokens.popover = mode === 'light'
    ? tokens.surface!
    : mix(
        variant.page,
        variant.ink,
        0.1,
      );
  tokens['well-hover'] = mode === 'light'
    ? mix(
        column,
        variant.ink,
        0.1,
      )
    : mix(
        variant.page,
        variant.ink,
        0.06,
      );
  return tokens;
}

export function themeModes(spec: ThemeSpec): ThemeMode[] {
  return [
    ...(spec.light ? ['light' as const] : []),
    ...(spec.dark ? ['dark' as const] : []),
  ];
}

export function resolveTheme(
  spec: ThemeSpec,
  preferred: ThemeMode,
): {
  mode: ThemeMode;
  tokens: ThemeTokens;
} {
  const variant = spec[preferred] ?? spec.light ?? spec.dark;
  if (!variant) {
    throw new Error(`Theme ${spec.id} has no variants`);
  }
  const mode = spec[preferred] ? preferred : (spec.light ? 'light' : 'dark');
  return {
    mode,
    tokens: buildTokens(
      variant,
      mode,
    ),
  };
}

const classicLight: ThemeVariant = {
  ink: '#34313a',
  page: '#f9f9f9',
  surface: '#ffffff',
  brand: '#6133b4',
  brandRamp: {
    50: '#36205d',
    100: '#432874',
    200: '#4f2a93',
    300: '#6133b4',
    400: '#925cf3',
    500: '#bda8ff',
    600: '#d5c8ff',
    700: '#eeebf8',
    800: '#f6f4fc',
  },
  hueSubText: {
    maroon: '#ab6565',
    red: '#ab6570',
    orange: '#ab8165',
    yellow: '#ab9065',
    green: '#65ab94',
    teal: '#65a7ab',
    blue: '#6594ab',
  },
  hues: {
    maroon: '#de3f3f',
    red: '#ff6165',
    orange: '#ff944c',
    yellow: '#ffbe5d',
    green: '#24cc8f',
    teal: '#3bcad7',
    blue: '#50b5e9',
  },
  hueRamps: {
    maroon: {
      1: '#4c0001',
      5: '#7d0c0c',
      10: '#b01515',
      50: '#c92b2b',
      500: '#f19595',
      600: '#f7e9e9',
      700: '#fff7f7',
    },
    red: {
      1: '#6c0406',
      5: '#bf262b',
      10: '#f23035',
      50: '#f74e52',
      500: '#ffb6b8',
      600: '#f7e9e9',
      700: '#fff7f7',
    },
    orange: {
      1: '#7f3300',
      5: '#a85219',
      10: '#f47825',
      50: '#fa8537',
      500: '#ffc8a7',
      600: '#f7eded',
      700: '#fff9f5',
    },
    yellow: {
      1: '#794b00',
      5: '#ee9109',
      10: '#ffa624',
      50: '#ffb445',
      500: '#fedead',
      600: '#fcf3e5',
      700: '#fffcf7',
    },
    green: {
      1: '#005737',
      5: '#168059',
      10: '#1ca372',
      50: '#20b780',
      500: '#77f4c7',
      600: '#ebf5f5',
      700: '#f3fbf8',
    },
    teal: {
      1: '#005158',
      5: '#1a7078',
      10: '#26a0ab',
      50: '#34b5c1',
      500: '#8eedf6',
      600: '#e5f5f5',
      700: '#f5fffe',
    },
    blue: {
      1: '#033f5e',
      5: '#217aa6',
      10: '#2995cd',
      50: '#46a7d9',
      500: '#a9dcf6',
      600: '#eef5f9',
      700: '#fafdff',
    },
  },
};

export const themes: ThemeSpec[] = [
  {
    id: 'carrot',
    name: 'Carrot',
    light: {
      ink: '#2b2731',
      page: '#f7f4ef',
      surface: '#ffffff',
      brand: '#e0662a',
      nav: '#2b2731',
      navHover: '#3d3844',
      hues: {
        maroon: '#c6393a',
        red: '#ee5a5e',
        orange: '#f4914a',
        yellow: '#f2b64a',
        green: '#2ec27e',
        teal: '#2cb7c4',
        blue: '#4a9fdc',
      },
    },
    dark: {
      ink: '#efe8df',
      page: '#1c1a1f',
      brand: '#f28444',
      nav: '#26232a',
      navHover: '#353139',
      hues: {
        maroon: '#d2494a',
        red: '#f2686b',
        orange: '#f79a58',
        yellow: '#f5c05d',
        green: '#3ccb8a',
        teal: '#3ec4d0',
        blue: '#5aaae6',
      },
    },
  },
  {
    id: 'classic',
    name: 'Classic',
    light: classicLight,
  },
  {
    id: 'tokyo-night',
    name: 'Tokyo Night',
    dark: {
      ink: '#c0caf5',
      page: '#1a1b26',
      brand: '#7aa2f7',
      hues: {
        maroon: '#db4b4b',
        red: '#f7768e',
        orange: '#ff9e64',
        yellow: '#e0af68',
        green: '#9ece6a',
        teal: '#73daca',
        blue: '#7dcfff',
      },
    },
  },
  {
    id: 'synthwave',
    name: 'Synthwave \'84',
    dark: {
      ink: '#f4f0fa',
      page: '#2a2139',
      brand: '#ff7edb',
      nav: '#241b2f',
      navHover: '#302445',
      hues: {
        maroon: '#f92aad',
        red: '#fe4450',
        orange: '#ff8b39',
        yellow: '#fede5d',
        green: '#72f1b8',
        teal: '#36f9f6',
        blue: '#5ea8f8',
      },
    },
  },
  {
    id: 'catppuccin',
    name: 'Catppuccin',
    light: {
      ink: '#4c4f69',
      page: '#eff1f5',
      surface: '#ffffff',
      brand: '#8839ef',
      hues: {
        maroon: '#e64553',
        red: '#d20f39',
        orange: '#fe640b',
        yellow: '#df8e1d',
        green: '#40a02b',
        teal: '#179299',
        blue: '#1e66f5',
      },
    },
    dark: {
      ink: '#cdd6f4',
      page: '#1e1e2e',
      brand: '#cba6f7',
      hues: {
        maroon: '#eba0ac',
        red: '#f38ba8',
        orange: '#fab387',
        yellow: '#f9e2af',
        green: '#a6e3a1',
        teal: '#94e2d5',
        blue: '#89b4fa',
      },
    },
  },
  {
    id: 'nord',
    name: 'Nord',
    light: {
      ink: '#2e3440',
      page: '#eceff4',
      surface: '#ffffff',
      brand: '#5e81ac',
      hues: {
        maroon: '#a54e56',
        red: '#bf616a',
        orange: '#d08770',
        yellow: '#d9b465',
        green: '#8fa876',
        teal: '#76a8a6',
        blue: '#81a1c1',
      },
    },
    dark: {
      ink: '#eceff4',
      page: '#2e3440',
      brand: '#88c0d0',
      hues: {
        maroon: '#bf616a',
        red: '#d8828a',
        orange: '#d08770',
        yellow: '#ebcb8b',
        green: '#a3be8c',
        teal: '#8fbcbb',
        blue: '#81a1c1',
      },
    },
  },
  {
    id: 'gruvbox',
    name: 'Gruvbox',
    light: {
      ink: '#3c3836',
      page: '#fbf1c7',
      surface: '#f9f5d7',
      brand: '#d65d0e',
      hues: {
        maroon: '#9d0006',
        red: '#cc241d',
        orange: '#d65d0e',
        yellow: '#d79921',
        green: '#98971a',
        teal: '#689d6a',
        blue: '#458588',
      },
    },
    dark: {
      ink: '#ebdbb2',
      page: '#282828',
      brand: '#fe8019',
      hues: {
        maroon: '#cc241d',
        red: '#fb4934',
        orange: '#fe8019',
        yellow: '#fabd2f',
        green: '#b8bb26',
        teal: '#8ec07c',
        blue: '#83a598',
      },
    },
  },
  {
    id: 'solarized',
    name: 'Solarized',
    light: {
      ink: '#073642',
      page: '#eee8d5',
      surface: '#fdf6e3',
      brand: '#268bd2',
      hues: {
        maroon: '#b5232a',
        red: '#dc322f',
        orange: '#cb4b16',
        yellow: '#b58900',
        green: '#859900',
        teal: '#2aa198',
        blue: '#268bd2',
      },
    },
    dark: {
      ink: '#eee8d5',
      page: '#002b36',
      brand: '#268bd2',
      hues: {
        maroon: '#b5232a',
        red: '#dc322f',
        orange: '#cb4b16',
        yellow: '#b58900',
        green: '#859900',
        teal: '#2aa198',
        blue: '#268bd2',
      },
    },
  },
];

export const defaultThemeId = 'carrot';

export function findTheme(id: string | null | undefined): ThemeSpec {
  return themes.find((theme) => theme.id === id) ?? themes[0]!;
}
