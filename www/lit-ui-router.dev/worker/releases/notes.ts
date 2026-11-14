// The release notes the docs build renders from each package's CHANGELOG.md, read from static assets on the request path.
import { PACKAGES } from '../../catalog/packages.ts';
import { RELEASES_MOUNT } from './routes.ts';

/** One version's changelog section: its heading date and its body, already rendered to HTML. */
export interface ReleaseNote {
  date: string;
  html: string;
}

/** A package's sections by version; a version with no section has no key. */
export type ReleaseNotes = Readonly<Partial<Record<string, ReleaseNote>>>;

/** Reads one package's notes. */
export type NotesReader = (name: string) => Promise<ReleaseNotes>;

/** Where the build writes a package's notes: inside the worker's mount, so a request gets the 404 page and only the ASSETS binding reads the file. */
export const notesAsset = (name: string): string =>
  `${RELEASES_MOUNT}/_notes/${name}.json`;

const CATALOGED = new Set<string>(PACKAGES.map(({ name }) => name));

/** Notes through the ASSETS binding; a package outside the catalog has none, and a cataloged one without its file is a broken build. */
export const assetNotes =
  (
    assets: { fetch(request: Request): Promise<Response> },
    origin: string,
  ): NotesReader =>
  async (name) => {
    if (!CATALOGED.has(name)) return {};

    const response = await assets.fetch(
      new Request(new URL(notesAsset(name), origin)),
    );

    if (!response.ok)
      throw new Error(`${notesAsset(name)}: ${response.status}`);

    // SAFETY: the docs build writes this file from releaseNotes() in .vitepress/changelog.ts.
    return (await response.json()) as ReleaseNotes;
  };
