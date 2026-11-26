// Pure faceted-index model and query helpers shared by FacetedIndex.vue and tests.

/** One facet axis in the catalog vocabulary. */
export interface FacetDefinition {
  key: string;
  /** Short description shown in the "+ Add facet" dropdown. */
  hint: string;
  /** Vocabulary values in display order. */
  values: readonly string[];
  /** Baseline value rendered muted on entry rows; other values are highlighted. */
  defaultValue?: string;
  /** When false, shown in the filter picker only (not repeated as a pill on each entry row). */
  showOnRow?: boolean;
}

/** An entry's action or reference link. */
export interface FacetLink {
  text: string;
  href: string;
  /** Static app or worker route that VitePress's client router must not intercept. */
  self?: boolean;
  /** External link opened in a new tab. */
  external?: boolean;
}

/** One entry rendered inside a group section. */
export interface FacetEntry {
  id: string;
  /** Heading anchor slug matching VitePress's default slugify. */
  slug: string;
  title: string;
  monoTitle?: boolean;
  /** Optional summary text with inline backtick code spans. */
  summary?: string;
  group: string;
  facets: Readonly<Record<string, readonly string[]>>;
  links: readonly FacetLink[];
  embeddedIn?: readonly FacetLink[];
  entryPoints?: readonly string[];
}

/** A display group heading (kind for examples, role for packages). */
export interface FacetGroup {
  id: string;
  label: string;
}

/** Complete build-time dataset for one faceted index page. */
export interface FacetIndexData {
  itemSingular: string;
  itemPlural: string;
  /** Facet row shown open by default when no URL query is present. */
  defaultFacet: string;
  /** Preferred order in the "+ Add facet" dropdown; omitted keys follow in catalog order. */
  pickerOrder?: readonly string[];
  /** Canonical facet definitions in fixed key order. */
  facets: readonly FacetDefinition[];
  groups: readonly FacetGroup[];
  entries: readonly FacetEntry[];
}

export type FacetFilter = ReadonlyMap<string, string>;

export interface FacetValueCount {
  value: string;
  count: number;
}

export interface FacetCountsResult {
  all: number;
  values: FacetValueCount[];
}

export interface FacetRowRemoval {
  visible: string[];
  filter: FacetFilter;
}

export interface FacetRelaxation {
  key: string;
  value: string;
  count: number;
}

export interface InlineSegment {
  text: string;
  code: boolean;
}

/** Splits backtick-delimited inline code spans for safe rendering without v-html. */
export function splitInlineCode(text: string): InlineSegment[] {
  const parts: InlineSegment[] = [];
  let cursor = 0;

  for (const match of text.matchAll(/`([^`]+)`/g)) {
    const start = match.index;

    if (start > cursor)
      parts.push({ text: text.slice(cursor, start), code: false });
    parts.push({ text: match[1], code: true });
    cursor = start + match[0].length;
  }

  if (cursor < text.length)
    parts.push({ text: text.slice(cursor), code: false });

  return parts;
}

/** Returns the values an entry carries for `key`. */
export function facetValuesOf(
  entry: FacetEntry,
  key: string,
): readonly string[] {
  return entry.facets[key] ?? [];
}

/** Drops unpopulated values and omits any facet with fewer than two populated values. */
export function activeFacetsOf(
  facets: readonly FacetDefinition[],
  entries: readonly FacetEntry[],
): FacetDefinition[] {
  return facets.flatMap((facet) => {
    const populated = facet.values.filter((value) =>
      entries.some((entry) => facetValuesOf(entry, facet.key).includes(value)),
    );

    return populated.length >= 2 ? [{ ...facet, values: populated }] : [];
  });
}

/** Orders active facets for the "+ Add facet" dropdown, putting pickerOrder keys first. */
export function orderedPickerFacets(
  activeFacets: readonly FacetDefinition[],
  pickerOrder: readonly string[] = [],
): FacetDefinition[] {
  const rank = new Map(pickerOrder.map((key, index) => [key, index]));

  return [...activeFacets].sort((a, b) => {
    const rankA = rank.get(a.key) ?? Number.MAX_SAFE_INTEGER;
    const rankB = rank.get(b.key) ?? Number.MAX_SAFE_INTEGER;

    return rankA - rankB;
  });
}

/** True when an entry satisfies every active constraint in `filter`. */
export function matchesFilter(entry: FacetEntry, filter: FacetFilter): boolean {
  for (const [key, wanted] of filter) {
    if (!facetValuesOf(entry, key).includes(wanted)) return false;
  }

  return true;
}

/** Returns a copy of `filter` with `key` cleared. */
export function withoutKey(filter: FacetFilter, key: string): FacetFilter {
  const next = new Map(filter);

  next.delete(key);

  return next;
}

/** Disjunctive sibling counts for one facet row (evaluated with that key cleared). */
export function facetCounts(
  entries: readonly FacetEntry[],
  facet: FacetDefinition,
  filter: FacetFilter,
): FacetCountsResult {
  const base = withoutKey(filter, facet.key);
  const matchingBase = entries.filter((entry) => matchesFilter(entry, base));

  return {
    all: matchingBase.length,
    values: facet.values.map((value) => ({
      value,
      count: matchingBase.filter((entry) =>
        facetValuesOf(entry, facet.key).includes(value),
      ).length,
    })),
  };
}

/** Toggles a facet value: clears it when empty or already selected, otherwise sets it. */
export function toggleFacetValue(
  filter: FacetFilter,
  key: string,
  value: string,
): FacetFilter {
  if (!value || filter.get(key) === value) return withoutKey(filter, key);

  const next = new Map(filter);

  next.set(key, value);

  return next;
}

/** Appends a facet row in insertion order when not already shown. */
export function addFacetRow(visible: readonly string[], key: string): string[] {
  return visible.includes(key) ? [...visible] : [...visible, key];
}

/** Removes a facet row and clears its active constraint. */
export function removeFacetRow(
  visible: readonly string[],
  filter: FacetFilter,
  key: string,
): FacetRowRemoval {
  return {
    visible: visible.filter((item) => item !== key),
    filter: withoutKey(filter, key),
  };
}

/** Parses known facet query parameters from a URL search string. */
export function parseQueryFilter(
  search: string,
  activeFacets: readonly FacetDefinition[],
): FacetFilter {
  const params = new URLSearchParams(search);
  const allowed = new Map(activeFacets.map((f) => [f.key, new Set(f.values)]));
  const filter = new Map<string, string>();

  for (const [key, values] of allowed) {
    const value = params.get(key);

    if (value && values.has(value)) filter.set(key, value);
  }

  return filter;
}

/** Serializes active constraints in canonical facet order; returns '' when unfiltered. */
export function serializeQueryFilter(
  filter: FacetFilter,
  activeFacets: readonly FacetDefinition[],
): string {
  const params = new URLSearchParams();

  for (const { key } of activeFacets) {
    const value = filter.get(key);

    if (value) params.set(key, value);
  }

  const text = params.toString();

  return text ? `?${text}` : '';
}

/** Initial open facet rows: every key in `filter`, else the default facet. */
export function initialVisibleFacets(
  defaultFacet: string,
  filter: FacetFilter,
  activeFacets: readonly FacetDefinition[],
): string[] {
  const activeKeys = activeFacets.flatMap(({ key }) =>
    filter.has(key) ? [key] : [],
  );

  if (activeKeys.length > 0) return activeKeys;

  if (activeFacets.some(({ key }) => key === defaultFacet))
    return [defaultFacet];

  return activeFacets[0] ? [activeFacets[0].key] : [];
}

/** Single-constraint drops for an empty result, with how many entries each drop recovers. */
export function relaxations(
  entries: readonly FacetEntry[],
  filter: FacetFilter,
  activeFacets: readonly FacetDefinition[],
): FacetRelaxation[] {
  return activeFacets.flatMap(({ key }) => {
    const value = filter.get(key);

    if (!value) return [];

    const count = entries.filter((entry) =>
      matchesFilter(entry, withoutKey(filter, key)),
    ).length;

    return [{ key, value, count }];
  });
}

/** Drops only the constraints in `filter` that hide `entry` (used when following a deep anchor). */
export function clearConflictingFilters(
  entry: FacetEntry,
  filter: FacetFilter,
): FacetFilter {
  const next = new Map<string, string>();

  for (const [key, wanted] of filter) {
    if (facetValuesOf(entry, key).includes(wanted)) next.set(key, wanted);
  }

  return next;
}
