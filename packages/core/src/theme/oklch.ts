export type Oklch = {
  l: number;
  c: number;
  h: number;
};

type Rgb = [number, number, number];

function clamp01(value: number): number {
  return Math.min(
    1,
    Math.max(
      0,
      value,
    ),
  );
}

function srgbToLinear(channel: number): number {
  return channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
}

function linearToSrgb(channel: number): number {
  const c = clamp01(channel);
  return c <= 0.0031308 ? c * 12.92 : 1.055 * c ** (1 / 2.4) - 0.055;
}

export function parseHex(hex: string): Rgb {
  const clean = hex.replace(
    '#',
    '',
  );
  const full = clean.length === 3 ? clean.split('').map((ch) => ch + ch).join('') : clean;
  if (!/^[0-9a-fA-F]{6}$/.test(full)) {
    throw new Error(`Bad hex colour: ${hex}`);
  }
  return [
    Number.parseInt(
      full.slice(
        0,
        2,
      ),
      16,
    ) / 255,
    Number.parseInt(
      full.slice(
        2,
        4,
      ),
      16,
    ) / 255,
    Number.parseInt(
      full.slice(
        4,
        6,
      ),
      16,
    ) / 255,
  ];
}

function toHex(rgb: Rgb): string {
  return `#${rgb.map((channel) => Math.round(clamp01(channel) * 255).toString(16).padStart(
    2,
    '0',
  )).join('')}`;
}

function rgbToOklab(rgb: Rgb): [number, number, number] {
  const [
    r,
    g,
    b,
  ] = rgb.map(srgbToLinear) as Rgb;
  const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b);
  const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b);
  const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);
  return [
    0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s,
    1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s,
    0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s,
  ];
}

function oklabToLinearRgb(lab: [number, number, number]): Rgb {
  const [
    L,
    a,
    b,
  ] = lab;
  const l = (L + 0.3963377774 * a + 0.2158037573 * b) ** 3;
  const m = (L - 0.1055613458 * a - 0.0638541728 * b) ** 3;
  const s = (L - 0.0894841775 * a - 1.291485548 * b) ** 3;
  return [
    4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
    -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
    -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s,
  ];
}

export function hexToOklch(hex: string): Oklch {
  const [
    l,
    a,
    b,
  ] = rgbToOklab(parseHex(hex));
  const c = Math.hypot(
    a,
    b,
  );
  const h = c < 1e-6
    ? 0
    : ((Math.atan2(
        b,
        a,
      ) * 180) / Math.PI + 360) % 360;
  return {
    l,
    c,
    h,
  };
}

function inGamut(rgb: Rgb): boolean {
  return rgb.every((channel) => channel >= -0.0005 && channel <= 1.0005);
}

/** Reduces chroma until the colour fits in sRGB, keeping lightness and hue. */
export function oklchToHex(color: Oklch): string {
  const l = clamp01(color.l);
  let c = Math.max(
    0,
    color.c,
  );
  const radians = (color.h * Math.PI) / 180;
  let rgb = oklabToLinearRgb([
    l,
    c * Math.cos(radians),
    c * Math.sin(radians),
  ]);
  let low = 0;
  let high = c;
  if (!inGamut(rgb)) {
    for (let i = 0; i < 20; i += 1) {
      c = (low + high) / 2;
      rgb = oklabToLinearRgb([
        l,
        c * Math.cos(radians),
        c * Math.sin(radians),
      ]);
      if (inGamut(rgb)) {
        low = c;
      } else {
        high = c;
      }
    }
    rgb = oklabToLinearRgb([
      l,
      low * Math.cos(radians),
      low * Math.sin(radians),
    ]);
  }
  return toHex(rgb.map(linearToSrgb) as Rgb);
}

export function shift(
  hex: string,
  dl: number,
  chromaScale = 1,
  minL = 0.08,
  maxL = 0.97,
): string {
  const base = hexToOklch(hex);
  return oklchToHex({
    l: Math.min(
      maxL,
      Math.max(
        minL,
        base.l + dl,
      ),
    ),
    c: base.c * chromaScale,
    h: base.h,
  });
}

/** Perceptual mix in OKLab; t = 0 gives `from`, t = 1 gives `to`. */
export function mix(
  from: string,
  to: string,
  t: number,
): string {
  const a = rgbToOklab(parseHex(from));
  const b = rgbToOklab(parseHex(to));
  const lab: [number, number, number] = [
    a[0] + (b[0] - a[0]) * t,
    a[1] + (b[1] - a[1]) * t,
    a[2] + (b[2] - a[2]) * t,
  ];
  return toHex(oklabToLinearRgb(lab).map(linearToSrgb) as Rgb);
}
