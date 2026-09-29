import {
  describe,
  expect,
  it,
} from 'vitest';
import {
  hexToOklch,
  oklchToHex,
} from '@karotto/core/theme/oklch';
import {
  buildTokens,
  findTheme,
  hueNames,
  hueSteps,
  neutralSteps,
  resolveTheme,
  themeModes,
  themes,
} from '@karotto/core/theme/themes';

const hex = /^#[0-9a-f]{6}$/;

describe(
  'oklch',
  () => {
    it(
      'round-trips sRGB colours',
      () => {
        [
          '#6133b4',
          '#ffbe5d',
          '#1a1b26',
          '#ffffff',
          '#000000',
        ].forEach((color) => {
          expect(oklchToHex(hexToOklch(color))).toBe(color);
        });
      },
    );
  },
);

describe(
  'themes',
  () => {
    it(
      'builds a complete token set for every variant',
      () => {
        themes.forEach((theme) => {
          themeModes(theme).forEach((mode) => {
            const { tokens } = resolveTheme(
              theme,
              mode,
            );
            [
              'ink',
              'page',
              'surface',
              'well',
              'well-hover',
              'popover',
              'nav',
              'nav-hover',
            ].forEach((key) => expect(tokens[key]).toMatch(hex));
            neutralSteps.forEach((step) => expect(tokens[`neutral-${step}`]).toMatch(hex));
            hueNames.forEach((name) => hueSteps.forEach((step) => expect(tokens[`${name}-${step}`]).toMatch(hex)));
            expect(tokens['brand-300']).toMatch(hex);
          });
        });
      },
    );

    it(
      'keeps the classic palette byte-identical to the original',
      () => {
        const classic = findTheme('classic');
        const tokens = buildTokens(
          classic.light!,
          'light',
        );
        expect(tokens['brand-300']).toBe('#6133b4');
        expect(tokens['brand-600']).toBe('#d5c8ff');
        expect(tokens['yellow-5']).toBe('#ee9109');
        expect(tokens['maroon-500']).toBe('#f19595');
        expect(tokens['neutral-10']).toBe('#34313a');
        expect(tokens['neutral-700']).toBe('#f9f9f9');
      },
    );

    it(
      'falls back to an available mode',
      () => {
        expect(resolveTheme(
          findTheme('tokyo-night'),
          'light',
        ).mode).toBe('dark');
        expect(resolveTheme(
          findTheme('classic'),
          'dark',
        ).mode).toBe('light');
        expect(findTheme('nope').id).toBe('carrot');
      },
    );

    it(
      'orders neutral scales from ink to page',
      () => {
        const { tokens } = resolveTheme(
          findTheme('tokyo-night'),
          'dark',
        );
        expect(hexToOklch(tokens['neutral-10']!).l).toBeGreaterThan(hexToOklch(tokens['neutral-700']!).l);
      },
    );
  },
);
