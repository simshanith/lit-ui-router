// A deterministic stand-in for a registry lookup, so measurements never wait on a network.

export interface Domain {
  name: string;
  available: boolean;
  /** US dollars a year. */
  price: number;
}

export interface SearchResults {
  query: string;
  domains: Domain[];
}

const TLDS = ['com', 'dev', 'app', 'io', 'ai', 'org', 'net', 'co', 'xyz', 'sh'];

const PRICES = [9, 12, 15, 20, 35, 49, 70, 90];

// FNV-1a over UTF-16 code units.
const hash = (text: string): number => {
  let h = 0x811c9dc5;

  for (let i = 0; i < text.length; i += 1) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }

  return h;
};

const domainOf = (name: string): Domain => {
  const h = hash(name);

  return {
    name,
    available: h % 3 !== 0,
    price: PRICES[(h >>> 8) % PRICES.length],
  };
};

/** The label a query names: lowercased, scheme and path dropped, LDH characters only. */
export const labelOf = (query: string): string =>
  query
    .trim()
    .toLowerCase()
    .replace(/^[a-z]+:\/\//, '')
    .split(/[/.]/)[0]
    .replace(/[^a-z0-9-]/g, '')
    .replace(/^-+|-+$/g, '')
    .slice(0, 63);

const tldOf = (query: string): string | undefined => {
  const typed = query.trim().toLowerCase().split('/')[0].split('.')[1];

  return typed && TLDS.includes(typed) ? typed : undefined;
};

/** Every TLD for the query's label, the typed one first. */
export const searchDomains = (query: string): SearchResults => {
  const label = labelOf(query);

  if (!label) return { query, domains: [] };
  const typed = tldOf(query);
  const tlds = typed ? [typed, ...TLDS.filter((tld) => tld !== typed)] : TLDS;

  return { query, domains: tlds.map((tld) => domainOf(`${label}.${tld}`)) };
};
