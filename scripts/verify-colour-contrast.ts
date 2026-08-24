import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const css = readFileSync(
  resolve(import.meta.dirname, '../apps/observatory/src/styles.css'),
  'utf8',
);

function colour(variable: string): readonly [number, number, number] {
  const match = css.match(new RegExp(`--${variable}:\\s*(#[a-fA-F0-9]{6})`));
  if (!match?.[1]) throw new Error(`Missing six-digit colour variable --${variable}.`);
  return [1, 3, 5].map((offset) => Number.parseInt(match[1]!.slice(offset, offset + 2), 16)) as [
    number,
    number,
    number,
  ];
}

function channel(value: number): number {
  const normalised = value / 255;
  return normalised <= 0.04045 ? normalised / 12.92 : ((normalised + 0.055) / 1.055) ** 2.4;
}

function luminance(rgb: readonly number[]): number {
  return channel(rgb[0]!) * 0.2126 + channel(rgb[1]!) * 0.7152 + channel(rgb[2]!) * 0.0722;
}

function contrast(first: readonly number[], second: readonly number[]): number {
  const [bright, dark] = [luminance(first), luminance(second)].sort((a, b) => b - a);
  return (bright! + 0.05) / (dark! + 0.05);
}

const checks = [
  ['ivory', 'night', 4.5],
  ['ivory-muted', 'night', 4.5],
  ['steel', 'night', 4.5],
  ['cyan', 'night', 4.5],
  ['amber', 'night', 4.5],
  ['red', 'night', 4.5],
  ['focus', 'night', 3],
  ['ivory', 'instrument-black', 4.5],
  ['ivory-muted', 'instrument-black', 4.5],
  ['night', 'cyan', 4.5],
  ['night', 'amber', 4.5],
] as const;

for (const [foreground, background, threshold] of checks) {
  const ratio = contrast(colour(foreground), colour(background));
  if (ratio < threshold) {
    throw new Error(
      `${foreground} on ${background} is ${ratio.toFixed(2)}:1; expected at least ${threshold}:1.`,
    );
  }
  console.log(`${foreground} on ${background}: ${ratio.toFixed(2)}:1`);
}
