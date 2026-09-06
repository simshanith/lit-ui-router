// The reservation policy, apart from the browser: what a measured example
// demands of the height the docs reserve for it.

/** ExampleEmbed's iframe border, which `height` includes (box-sizing: border-box). */
export const FRAME_BORDER_PX = 2;

/**
 * The docs content column: VitePress's 688px `.content-container`, minus the
 * frame's border, is the width the embedded example lays out at.
 */
export const COLUMN_WIDTH_PX = 686;

/**
 * Headroom over the measurement. Text wraps at engine-specific metrics, and
 * this browser is not the one readers use: the docs' own browser measured one
 * embed's content 11px (1.4%) taller than headless Chromium does.
 * A reservation that merely equals what we measured therefore scrolls where it
 * counts, so the drift is part of the requirement rather than advice attached
 * to the suggestion.
 */
const HEADROOM = 1.03;

/** Above this the reservation is stale, not deliberate slack. */
const STALE_FACTOR = 1.5;
const STALE_SLACK_PX = 100;

export type Status = 'ok' | 'under' | 'stale';

export interface Verdict {
  /** Tallest content height measured across the example's states. */
  measured: number;
  /** What the embed must reserve: the content, the border, and engine drift. */
  required: number;
  /** The height the docs declare. */
  declared: number;
  /** Suggested declaration for a new (or failing) example. */
  suggested: number;
  status: Status;
}

/** `'800px'` -> 800. Throws on anything else: the manifest is authored, not parsed. */
export function parsePx(value: string): number {
  const match = /^(\d+(?:\.\d+)?)px$/.exec(value.trim());
  if (!match)
    throw new Error(`expected a px height, got ${JSON.stringify(value)}`);
  return Number(match[1]);
}

/** The smallest honest reservation for measured content. */
export function requiredFor(measured: number): number {
  return Math.ceil((measured + FRAME_BORDER_PX) * HEADROOM);
}

export function suggest(measured: number): number {
  return Math.ceil(requiredFor(measured) / 10) * 10;
}

export function judge(measured: number, declared: number): Verdict {
  const required = requiredFor(measured);
  const status: Status =
    declared < required
      ? 'under'
      : declared > required * STALE_FACTOR + STALE_SLACK_PX
        ? 'stale'
        : 'ok';
  return { measured, required, declared, suggested: suggest(measured), status };
}
