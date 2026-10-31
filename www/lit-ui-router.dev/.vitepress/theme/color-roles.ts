// The docs theme's colour roles: what each colour is for and which grounds it may sit on.
// test/color-roles.test.ts resolves every pair from custom.css and VitePress's vars.css.

/** A ground a role may sit on; `over` composites a translucent ground onto another. */
export interface Ground {
  property: string;
  over?: string;
}

export const GROUNDS = {
  surface: { property: '--site-color-surface' },
  'surface-soft': { property: '--site-color-surface-soft' },
  'surface-alt': { property: '--vp-c-bg-alt' },
  'surface-hover': {
    property: '--site-color-surface-hover',
    over: 'surface',
  },
  'ground-shade': {
    property: '--site-color-ground-shade',
    over: 'surface-soft',
  },
  code: { property: '--vp-code-bg', over: 'surface' },
  'callout-tip': { property: '--vp-custom-block-tip-bg', over: 'surface' },
  'callout-warning': {
    property: '--vp-custom-block-warning-bg',
    over: 'surface',
  },
  'interaction-fill': { property: '--vp-button-brand-bg' },
  'interaction-fill-hover': { property: '--vp-button-brand-hover-bg' },
  'interaction-fill-active': { property: '--vp-button-brand-active-bg' },
  'status-ok': { property: '--status-ok' },
  'status-redirect': { property: '--status-redirect' },
  'status-not-found': { property: '--status-not-found' },
  'status-as-served': { property: '--status-as-served' },
} as const satisfies Record<string, Ground>;

export type GroundName = keyof typeof GROUNDS;

/** `text` holds 4.5:1, `mark` 3:1; `exempt` names the reason WCAG gives none. */
export type RoleKind = 'text' | 'mark' | 'exempt';

export interface Role {
  property: string;
  kind: RoleKind;
  use: string;
  on: readonly GroundName[];
  exempt?: string;
  /** Defined by the HTTP status colors block (#1757); checked once that block is in custom.css. */
  status?: true;
}

const PAGE_GROUNDS = [
  'surface',
  'surface-soft',
  'surface-alt',
  'surface-hover',
] as const satisfies readonly GroundName[];

export const ROLES = [
  {
    property: '--site-color-text',
    kind: 'text',
    use: 'body text, control labels, inline code',
    on: [...PAGE_GROUNDS, 'code', 'callout-tip', 'callout-warning'],
  },
  {
    property: '--site-color-text-muted',
    kind: 'text',
    use: 'secondary text: captions, blurbs, idle tabs, notes',
    on: [...PAGE_GROUNDS, 'ground-shade'],
  },
  {
    property: '--site-color-text-inactive',
    kind: 'exempt',
    use: 'disabled controls and aria-hidden decoration',
    on: [],
    exempt: 'WCAG 1.4.3 sets no minimum for inactive controls or decoration',
  },
  {
    property: '--site-color-interaction',
    kind: 'text',
    use: 'links, focus rings, hover and active borders',
    on: PAGE_GROUNDS,
  },
  {
    property: '--site-color-interaction-hover',
    kind: 'text',
    use: 'hovered links',
    on: PAGE_GROUNDS,
  },
  {
    property: '--vp-button-brand-text',
    kind: 'text',
    use: 'label on a brand button, at rest, hovered and pressed',
    on: [
      'interaction-fill',
      'interaction-fill-hover',
      'interaction-fill-active',
    ],
  },
  {
    property: '--site-color-identity-ink',
    kind: 'text',
    use: "the hero name and this stack's marks on the spectrum",
    on: ['surface', 'surface-soft'],
  },
  {
    property: '--site-color-identity-start',
    kind: 'exempt',
    use: 'the logo gradient',
    on: [],
    exempt: 'the logo is a brand mark and carries no information',
  },
  {
    property: '--site-color-identity-end',
    kind: 'exempt',
    use: 'the logo gradient',
    on: [],
    exempt: 'the logo is a brand mark and carries no information',
  },
  {
    property: '--site-color-line',
    kind: 'exempt',
    use: 'dividers and control outlines',
    on: [],
    exempt: 'separators are decorative; each control is named by its text',
  },
  {
    property: '--status-ok',
    kind: 'mark',
    use: 'HTTP 200 chips and diagram fills',
    on: ['surface', 'surface-soft'],
    status: true,
  },
  {
    property: '--status-redirect',
    kind: 'mark',
    use: 'HTTP 3xx chips and diagram fills',
    on: ['surface', 'surface-soft'],
    status: true,
  },
  {
    property: '--status-not-found',
    kind: 'mark',
    use: 'HTTP 404 chips and diagram fills',
    on: ['surface', 'surface-soft'],
    status: true,
  },
  {
    property: '--status-as-served',
    kind: 'mark',
    use: 'responses passed through as served',
    on: ['surface', 'surface-soft'],
    status: true,
  },
  {
    property: '--status-ink',
    kind: 'text',
    use: 'a status chip label',
    on: [
      'status-ok',
      'status-redirect',
      'status-not-found',
      'status-as-served',
    ],
    status: true,
  },
] as const satisfies readonly Role[];

export const MINIMUM: Record<Exclude<RoleKind, 'exempt'>, number> = {
  text: 4.5,
  mark: 3,
};
