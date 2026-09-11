// LABELS — FORM, split into keys.
//
// Every plate's title block carries FORM as one readable phrase ('ISOMETRIC
// GRAPH CITY'). The phrase is a compound of orthogonal keys, and this module
// is the ONE place the key set and the per-plate assignment are spelled:
//
//   subject     what is drawn                 city, coupling, register, …
//   projection  how it is drawn               isometric, plan, chart, graph, …
//   mode        whether it answers a pointer  interactive | static
//   basis       what the same city is counted on — CITY SUBJECTS ONLY
//
// Nothing here is invented: every value is a word the plate it labels already
// uses, in its FORM, its title or its own notes. FORM itself is untouched —
// the phrase stays on the title block; these are what the routed app indexes.
//
// `assertLabels()` is the build-time gate, in the same posture as the atlas's
// missing-member throw: an unknown key, an unknown value, a plate with no
// labels, a basis outside the city group or a `mode` that disagrees with the
// plate's actual interactivity stops the build.

/** The closed vocabulary. A value not on one of these lists is a build error. */
export const VOCAB = {
  subject: ['city', 'circuit', 'coupling', 'map', 'pipeline', 'quarters', 'register', 'sample', 'space', 'spine', 'sprite', 'survey'],
  projection: ['chart', 'graph', 'isometric', 'plan', 'schematic', 'section'],
  mode: ['interactive', 'static'],
  // Only meaningful inside the city group: what the same city is counted on.
  basis: ['bundled', 'delivered', 'isometric', 'isometric graph', 'measured', 'real 3d isometric', 'shipped', 'working'],
};

/** The key order every index, card and chip prints in. */
export const KEYS = ['subject', 'projection', 'mode', 'basis'];

/** The key `basis` qualifies — it says nothing about a plate that is not one. */
export const BASIS_SUBJECT = 'city';

const S = (subject, projection, mode, basis) =>
  basis ? { subject, projection, mode, basis } : { subject, projection, mode };

/**
 * Sheet number → its keys. Read off the plate: FORM first, then the plate's
 * own notes where FORM names only half the compound (sheet 12 argues itself
 * out of isometric and into a punched register; 7A says "plan view").
 */
export const LABELS = {
  '1': S('circuit', 'isometric', 'static'),
  '1i': S('circuit', 'graph', 'interactive'),
  '2': S('coupling', 'isometric', 'static'),
  '2A': S('coupling', 'plan', 'static'),
  '2B': S('coupling', 'graph', 'interactive'),
  '3': S('city', 'isometric', 'static', 'isometric'),
  '3A': S('coupling', 'schematic', 'static'),
  '3B': S('city', 'isometric', 'static', 'isometric graph'),
  '4': S('spine', 'isometric', 'static'),
  '5': S('space', 'chart', 'static'),
  '6': S('sample', 'section', 'static'),
  '7': S('city', 'isometric', 'static', 'measured'),
  '7A': S('survey', 'plan', 'static'),
  '7B': S('city', 'isometric', 'static', 'working'),
  '8': S('city', 'isometric', 'static', 'delivered'),
  '9': S('city', 'isometric', 'static', 'shipped'),
  '10': S('city', 'isometric', 'static', 'bundled'),
  '11': S('quarters', 'isometric', 'static'),
  '12': S('register', 'chart', 'static'),
  '12i': S('register', 'graph', 'interactive'),
  '13': S('map', 'plan', 'static'),
  '14': S('pipeline', 'graph', 'static'),
  '14i': S('pipeline', 'graph', 'interactive'),
  A1: S('sprite', 'isometric', 'static'),
  city: S('city', 'isometric', 'interactive', 'real 3d isometric'),
};

/** The keys for a plate — throws rather than labelling a plate by guess. */
export function labelsFor(num) {
  const labels = LABELS[String(num)];
  if (!labels) throw new Error(`labels: no key set for plate ${String(num)} — add one to generator/labels.mjs`);
  return { ...labels };
}

/**
 * The gate. `plates` is [num, isInteractive] for every plate the set emits.
 * @param {Array<[string, boolean]>} plates
 */
export function assertLabels(plates) {
  const seen = new Set();
  for (const [num, interactive] of plates) {
    const labels = labelsFor(num);
    seen.add(String(num));
    for (const key of KEYS) {
      if (key === 'basis') continue;
      if (!labels[key]) throw new Error(`labels: plate ${num} has no ${key}`);
    }
    for (const [key, value] of Object.entries(labels)) {
      if (!KEYS.includes(key)) throw new Error(`labels: plate ${num} carries unknown key ${key}`);
      if (!VOCAB[key].includes(value)) throw new Error(`labels: plate ${num} ${key}="${value}" is not in the vocabulary`);
    }
    const isCity = labels.subject === BASIS_SUBJECT;
    if (isCity && !labels.basis) throw new Error(`labels: plate ${num} is a ${BASIS_SUBJECT} and carries no basis`);
    if (!isCity && labels.basis) throw new Error(`labels: plate ${num} is not a ${BASIS_SUBJECT} but carries basis="${labels.basis}"`);
    const mode = interactive ? 'interactive' : 'static';
    if (labels.mode !== mode) throw new Error(`labels: plate ${num} is drawn ${mode} but labelled mode="${labels.mode}"`);
  }
  for (const num of Object.keys(LABELS)) {
    if (!seen.has(num)) throw new Error(`labels: generator/labels.mjs labels plate ${num}, which the set does not emit`);
  }
  // A value nothing uses is a vocabulary that has outlived a plate.
  const used = Object.fromEntries(KEYS.map((key) => [key, new Set()]));
  for (const labels of Object.values(LABELS)) for (const [key, value] of Object.entries(labels)) used[key].add(value);
  for (const key of KEYS) {
    for (const value of VOCAB[key]) {
      if (!used[key].has(value)) throw new Error(`labels: vocabulary ${key}="${value}" is on no plate`);
    }
  }
  return plates.length;
}

/** `subject city · projection isometric · mode static` — the readable key line. */
export const labelLine = (labels) =>
  KEYS.filter((key) => labels[key]).map((key) => `${key} ${labels[key]}`).join(' · ');
