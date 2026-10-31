// THE COLOUR ROLES — one row per `light-dark()` token in chrome.mjs's `:root`.
//
// `kind` sets the floor check-colour.mjs holds the token to, against each
// background in `on`, in both themes: TEXT 4.5:1 and MARK 3:1 (the thresholds
// the docs site's role guard uses), RULE and SURFACE none. A RULE is a stroke
// that carries no reading alone (WCAG 1.4.11 leaves it out); its ratios are
// printed, not gated. A token with no row here, or a row with no token, stops the build.

/** The floor per kind; a SURFACE is what the others are measured against. */
export const FLOORS = { TEXT: 4.5, MARK: 3, RULE: 0, SURFACE: 0 };

/** The surfaces a TEXT, MARK or RULE token may stand on. */
export const BACKGROUNDS = ['ground', 'paper', 'paper-2'];

export const ROLES = {
  ground: {
    kind: 'SURFACE',
    on: [],
    role: 'The table the sheets lie on: the page behind every sheet, the rail and the utility bar.',
  },
  paper: {
    kind: 'SURFACE',
    on: [],
    role: 'The sheet itself: the drawing ground, the roof of a block, the knockout behind a dimension code.',
  },
  'paper-2': {
    kind: 'SURFACE',
    on: [],
    role: 'Stone: the shaded left face of a block, the ground under a hatch, the fill of an unlit lamp.',
  },
  ink: {
    kind: 'TEXT',
    on: ['ground', 'paper', 'paper-2'],
    role: 'The heaviest weight: body lettering, headings, the sheet frame and the outline of every mass.',
  },
  'ink-soft': {
    kind: 'TEXT',
    on: ['ground', 'paper', 'paper-2'],
    role: 'The second weight: soft lettering, schedule numbers, dimension lines and the strokes behind the subject.',
  },
  'ink-faint': {
    kind: 'TEXT',
    on: ['paper', 'paper-2'],
    role: 'The third weight: faint lettering for the least of what a plate says, set small and never on a mass.',
  },
  line: {
    kind: 'RULE',
    on: ['paper', 'paper-2'],
    role: 'The hairline: construction grid, extension lines, an empty outline. Structure that carries no reading alone.',
  },
  edge: {
    kind: 'RULE',
    on: ['ground', 'paper'],
    role: 'The rule: the inner frame of a sheet, the edge it casts on the table, the borders of the rail and cards.',
  },
  accent: {
    kind: 'TEXT',
    on: ['ground', 'paper', 'paper-2'],
    role: 'The one editorial colour: one meaning per sheet, named in its key, two elements a plate at most; links and focus.',
  },
  'accent-soft': {
    kind: 'MARK',
    on: ['ground', 'paper'],
    role: 'The accent at rest: a link underline and the glass of the brand card, never lettering.',
  },
  red: {
    kind: 'TEXT',
    on: ['paper', 'paper-2'],
    role: 'Gate severity: the roof that halts a publish, red lettering on its badge, and the crossed-out tie.',
  },
  'red-hatch': {
    kind: 'MARK',
    on: ['paper-2'],
    role: 'The red as a hatch stroke over stone, drawn at 0.55 opacity: the side face of a block that halts a publish.',
  },
  green: {
    kind: 'MARK',
    on: ['paper', 'paper-2'],
    role: 'The open side of a gate: a lamp lit, the artifact that ships, a task whose cache is off by design.',
  },
  halo: {
    kind: 'SURFACE',
    on: [],
    role: 'The accent at a tenth over whatever lies under it: the glow round a selected or full-bright mass. An overlay, so no floor.',
  },
  pencil: {
    kind: 'TEXT',
    on: ['paper'],
    role: 'The annotation grey: the hand-lettered callout and the DRAWN BY signature, set in the hand face.',
  },
  cherokee: {
    kind: 'MARK',
    on: ['paper'],
    role: 'The chop: the square stamp at the corner of the title block, and nothing else on a plate.',
  },
};
