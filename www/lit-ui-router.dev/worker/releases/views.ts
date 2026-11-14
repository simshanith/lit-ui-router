// The routed views; each parent draws its own page at its own url and its child's view below it.
import type { UIRouter } from '@uirouter/core';
import { html, nothing } from 'lit';
import { html as staticHtml, unsafeStatic } from 'lit/static-html.js';
import type { TemplateResult } from 'lit';
import type { RoutedLitTemplate, UIRouterLit } from 'lit-ui-router/pure';
import { uiViewSlot } from 'lit-ui-router-ssr/client';
import * as v from 'valibot';
import { LAYOUT } from '@www/release-diffs.lit-ui-router.dev/layout';

import { PACKAGES, ROLES } from '../../catalog/packages.ts';
import { isStable, pickerPair, previousIn } from './ledger.ts';
import type { LedgerPackage, LedgerVersion, PublishedPair } from './ledger.ts';
import {
  type Line,
  lineAnchor,
  linesOf,
  PRERELEASES_PARAM,
  type PrereleaseView,
  PrereleasesParam,
} from './lines.ts';
import type { ReleaseNote, ReleaseNotes } from './notes.ts';
import { RELEASES_MOUNT } from './routes.ts';

export const REPOSITORY = 'https://github.com/simshanith/lit-ui-router';

const uiView = (): TemplateResult => html`<ui-view>${uiViewSlot()}</ui-view>`;

const dateFormat = new Intl.DateTimeFormat('en', {
  dateStyle: 'medium',
  timeZone: 'UTC',
});

const date = (iso: string | null): TemplateResult | string =>
  iso === null
    ? '—'
    : html`<time datetime=${iso}>${dateFormat.format(new Date(iso))}</time>`;

/** A row's GitHub release page; only GitHub's own release pages count. */
export const releaseUrl = (row: LedgerVersion): string | null =>
  row.gh_url?.startsWith(`${REPOSITORY}/releases/`) ? row.gh_url : null;

const tagOf = ({ name, version }: LedgerVersion): string =>
  `${name}@${version}`;

/** DiffsHub's compare between two tagged versions; it mirrors GitHub's compare url. */
export const diffUrl = (
  from: LedgerVersion,
  to: LedgerVersion,
): string | null =>
  from.git_sha === null || to.git_sha === null
    ? null
    : `${REPOSITORY.replace('//github.com/', '//diffshub.com/')}/compare/${encodeURIComponent(tagOf(from))}...${encodeURIComponent(tagOf(to))}`;

/** This site's diff of the files two versions published to npm. */
export const filesDiffPath = (
  from: LedgerVersion,
  to: LedgerVersion,
): string | null =>
  from.npm_integrity === null || to.npm_integrity === null
    ? null
    : `${RELEASES_MOUNT}/${encodeURIComponent(from.name)}/diff/${encodeURIComponent(from.version)}...${encodeURIComponent(to.version)}/`;

// Lucide's chevron-down: a <select> takes no pseudo-element, so the caret is a sibling.
const caret = html`<svg
  aria-hidden="true"
  viewBox="0 0 24 24"
  fill="none"
  stroke="currentColor"
  stroke-width="2"
  stroke-linecap="round"
  stroke-linejoin="round"
>
  <path d="m6 9 6 6 6-6" />
</svg>`;

const diff = (
  versions: readonly LedgerVersion[],
  row: LedgerVersion,
  compare = diffUrl,
): TemplateResult | null => {
  const previous = previousIn(versions, row);
  const url = previous && compare(previous, row);

  return previous && url
    ? html`<a href=${url}
        ><span class="visually-hidden">Diff</span> from ${previous.version}
        <span class="visually-hidden">to ${row.version}</span></a
      >`
    : null;
};

const githubRelease = (row: LedgerVersion): TemplateResult | string => {
  const url = releaseUrl(row);

  return url
    ? html`<a href=${url}
        >GitHub release
        <span class="visually-hidden">for ${row.name}@${row.version}</span></a
      >`
    : 'None recorded';
};

const isLeaf = (router: UIRouter, state: string): boolean =>
  router.globals.current.name === state;

const crumbs = (
  router: UIRouter,
  trail: readonly { label: string; href?: string }[],
): TemplateResult =>
  html`<nav aria-label="Breadcrumb">
    <ol class="crumbs">
      <li><a href=${router.stateService.href('releases')}>Releases</a></li>
      ${trail.map(({ label, href: to }) =>
        to
          ? html`<li><a href=${to}>${label}</a></li>`
          : html`<li><span aria-current="page">${label}</span></li>`,
      )}
    </ol>
  </nav>`;

/** A role's packages on the index, in catalog order. */
interface PackageGroup {
  id: string;
  label: string;
  packages: LedgerPackage[];
}

/** The ledger's packages under the catalog's roles; a package the catalog lacks lands in a final Other group. */
const byRole = (packages: readonly LedgerPackage[]): PackageGroup[] => {
  const recorded = new Map(packages.map((row) => [row.name, row]));
  const cataloged = new Set<string>(PACKAGES.map(({ name }) => name));

  return [
    ...ROLES.map(({ id, label }) => ({
      id,
      label,
      packages: PACKAGES.flatMap(({ name, role }) => {
        const row = role === id ? recorded.get(name) : undefined;

        return row ? [row] : [];
      }),
    })),
    {
      id: 'other',
      label: 'Other',
      packages: packages.filter(({ name }) => !cataloged.has(name)),
    },
  ].filter((group) => group.packages.length > 0);
};

const packageRow = (
  router: UIRouter,
  { name: pkg, latest: row }: LedgerPackage,
): TemplateResult =>
  html`<tr>
    <th scope="row">
      <a href=${router.stateService.href('releases.package', { pkg })}
        >${pkg}</a
      >
    </th>
    <td>
      ${
        row
          ? html`<a
              href=${router.stateService.href('releases.package.version', {
                pkg,
                version: row.version,
              })}
              ><span class="visually-hidden">${pkg}@</span>${row.version}</a
            >`
          : 'None recorded'
      }
    </td>
    <td>${date(row?.npm_published_at ?? null)}</td>
  </tr>`;

const indexPage = (
  router: UIRouter,
  packages: readonly LedgerPackage[],
): TemplateResult => html`
  <h1>Releases</h1>
  <p>
    The latest stable release of each package, as the release ledger records it,
    grouped by role. Each package lists every version it has released.
  </p>
  ${byRole(packages).map(
    ({ id, label, packages: group }) => html`
      <h2 id=${id}>${label}</h2>
      <div class="table">
        <table class="by-role" aria-labelledby=${id}>
          <thead>
            <tr>
              <th scope="col">Package</th>
              <th scope="col">Latest</th>
              <th scope="col">Published</th>
            </tr>
          </thead>
          <tbody>
            ${group.map((row) => packageRow(router, row))}
          </tbody>
        </table>
      </div>
    `,
  )}
`;

/** `releases`: every package with its latest stable release. */
export const ReleasesView: RoutedLitTemplate<{
  packages: readonly LedgerPackage[];
}> = ({ router, resolves }) =>
  isLeaf(router, 'releases') ? indexPage(router, resolves.packages) : uiView();

const versionOptions = (
  versions: readonly LedgerVersion[],
  selected: LedgerVersion | undefined,
): TemplateResult[] =>
  versions.map(
    ({ version }) =>
      html`<option value=${version} ?selected=${version === selected?.version}>
        ${version}
      </option>`,
  );

/** The form `releases.package.diff` answers, starting on `pickerPair`. */
const compareForm = (
  router: UIRouter,
  pkg: string,
  versions: readonly LedgerVersion[],
): TemplateResult | typeof nothing => {
  const { from, to } = pickerPair(versions);

  return versions.length < 2
    ? nothing
    : html`<form
        class="compare"
        method="get"
        action=${router.stateService.href(
          'releases.package.diff',
          { pkg },
          { inherit: false },
        )}
        aria-label="Compare two versions"
        target="_blank"
        rel="noopener"
      >
        <label
          >From
          <span class="select"
            ><select name="from">
              ${versionOptions(versions, from)}</select
            >${caret}</span
          ></label
        >
        <label
          >To
          <span class="select"
            ><select name="to">
              ${versionOptions(versions, to)}</select
            >${caret}</span
          ></label
        >
        <fieldset>
          <legend>Diff</legend>
          <label
            ><input type="radio" name="via" value="diffshub" checked /> Git
            source on DiffsHub</label
          >
          <label
            ><input type="radio" name="via" value="files" /> Published
            files</label
          >
        </fieldset>
        <button type="submit">
          Compare <span class="visually-hidden">(opens in a new tab)</span>
        </button>
      </form>`;
};

/**
 * A version's notes as the build rendered them from its CHANGELOG.md section.
 * The HTML is the repository's own release notes, rendered from Markdown at
 * build time and read from this deployment's static assets, so no request
 * input reaches it. As static markup, lit caches its template per isolate, so
 * a section is parsed once rather than on every request.
 */
const notesBody = (note: ReleaseNote, notesHtml = note.html): TemplateResult =>
  staticHtml`<div class="notes">${unsafeStatic(notesHtml)}</div>`;

/** Notes one heading level deeper, under a version heading that sits under its line's; the build escapes every `<` outside a tag. */
const deeper = (notesHtml: string): string =>
  notesHtml.replace(
    /<(\/?)h([1-5])(?=[\s>])/g,
    (_tag, close: string, level: string) => `<${close}h${Number(level) + 1}`,
  );

const anchorOf = (version: string): string => `v${version}`;

// Not inherited, so a version page's url never carries the package page's view.
const versionHref = (router: UIRouter, row: LedgerVersion): string =>
  router.stateService.href(
    'releases.package.version',
    { pkg: row.name, version: row.version },
    { inherit: false },
  );

/** A release page link and the DiffsHub diff from the previous version, unless the body already ends with its own. */
const releaseLinks = (
  router: UIRouter,
  versions: readonly LedgerVersion[],
  row: LedgerVersion,
  note: ReleaseNote,
): TemplateResult | typeof nothing => {
  const href = versionHref(router, row);

  if (note.html.includes(`href="${href}"`)) return nothing;

  const previous = previousIn(versions, row);
  const source = previous && diffUrl(previous, row);

  return html` ·
    <a href=${href} aria-label=${`Release page for ${row.version}`}
      >Release page</a
    >${
      previous && source
        ? html` ·
            <a
              href=${source}
              aria-label=${`Diff from ${previous.version} to ${row.version}`}
              >Diff from ${previous.version}</a
            >`
        : nothing
    }`;
};

/** A version with notes: its heading, date, links and notes. */
const releaseEntry = (
  router: UIRouter,
  versions: readonly LedgerVersion[],
  row: LedgerVersion,
  note: ReleaseNote,
): TemplateResult =>
  html`<article class="release" aria-labelledby=${anchorOf(row.version)}>
    <h3 id=${anchorOf(row.version)}>${row.version}</h3>
    <p class="release-meta">
      ${date(row.npm_published_at ?? note.date)}${releaseLinks(
        router,
        versions,
        row,
        note,
      )}
    </p>
    ${notesBody(note, deeper(note.html))}
  </article>`;

/** A version without notes, a prerelease or canary among them: one line linking its release page. */
const versionLine = (router: UIRouter, row: LedgerVersion): TemplateResult =>
  html`<li id=${anchorOf(row.version)}>
    <a href=${versionHref(router, row)}
      ><span class="visually-hidden">${row.name}@</span>${row.version}</a
    >${
      isStable(row.version)
        ? nothing
        : html` <span class="tag">prerelease</span>`
    }
    ${date(row.npm_published_at)}${
      releaseUrl(row) ? html` ${githubRelease(row)}` : nothing
    }
  </li>`;

type Entry =
  | { kind: 'notes'; row: LedgerVersion; note: ReleaseNote }
  | { kind: 'lines'; rows: LedgerVersion[] };

/** The versions in order, each run of versions without notes grouped as one list. */
const entriesOf = (
  versions: readonly LedgerVersion[],
  notes: ReleaseNotes,
): Entry[] =>
  versions.reduce<Entry[]>((entries, row) => {
    const note = notes[row.version];
    const last = entries.at(-1);

    if (note) entries.push({ kind: 'notes', row, note });
    else if (last?.kind === 'lines') last.rows.push(row);
    else entries.push({ kind: 'lines', rows: [row] });

    return entries;
  }, []);

/** The lines on the page, as in-page links. */
const outline = (
  lines: readonly Line<LedgerVersion>[],
): TemplateResult | typeof nothing =>
  lines.length < 2
    ? nothing
    : html`<nav class="outline" aria-label="Versions">
        <ol>
          ${lines.map(
            ({ name }) =>
              html`<li><a href=${`#${lineAnchor(name)}`}>${name}</a></li>`,
          )}
        </ol>
      </nav>`;

const plural = (count: number, noun: string): string =>
  `${count} ${noun}${count === 1 ? '' : 's'}`;

/** How many prereleases the view hides or shows, and the one link that flips it. */
const prereleaseToggle = (
  router: UIRouter,
  pkg: string,
  view: PrereleaseView,
  count: number,
): TemplateResult | typeof nothing => {
  if (count === 0) return nothing;

  const shown = view === 'show';

  const href = router.stateService.href('releases.package', {
    pkg,
    [PRERELEASES_PARAM]: shown ? 'hide' : 'show',
  });

  return html`<p class="prereleases">
    ${
      shown
        ? html`Showing ${plural(count, 'prerelease')}.
            <a href=${href}>Hide prereleases</a>`
        : html`${plural(count, 'prerelease')} hidden.
            <a href=${href}>Show prereleases</a>`
    }
  </p>`;
};

/** One minor line: its heading, then its versions as notes or one-line rows. */
const lineSection = (
  router: UIRouter,
  versions: readonly LedgerVersion[],
  notes: ReleaseNotes,
  { name, rows }: Line<LedgerVersion>,
): TemplateResult =>
  html`<section class="line" aria-labelledby=${lineAnchor(name)}>
    <h2 id=${lineAnchor(name)}>${name}</h2>
    ${entriesOf(rows, notes).map((entry) =>
      entry.kind === 'notes'
        ? releaseEntry(router, versions, entry.row, entry.note)
        : html`<ul class="version-lines">
            ${entry.rows.map((row) => versionLine(router, row))}
          </ul>`,
    )}
  </section>`;

const packagePage = (
  router: UIRouter,
  pkg: string,
  versions: readonly LedgerVersion[],
  notes: ReleaseNotes,
  view: PrereleaseView,
): TemplateResult => {
  const stable = versions.filter((row) => isStable(row.version));
  const lines = linesOf(view === 'show' ? versions : stable);

  return html`
    ${crumbs(router, [{ label: pkg }])}
    <h1>${pkg}</h1>
    <p>
      Every version of <code>${pkg}</code> the release ledger records, newest
      first and grouped by minor, with the release notes of each stable release.
      Prereleases, canaries among them, stay folded away until shown. Its npm
      page is
      <a href=${`https://www.npmjs.com/package/${pkg}`}>${pkg} on npm</a>.
    </p>
    ${compareForm(router, pkg, versions)}
    ${prereleaseToggle(router, pkg, view, versions.length - stable.length)}
    ${outline(lines)}
    ${lines.map((line) => lineSection(router, versions, notes, line))}
  `;
};

/** `releases.package`: one package's versions, newest first, by minor line; prereleases show when the url asks. */
export const PackageView: RoutedLitTemplate<{
  versions: LedgerVersion[];
  notes: ReleaseNotes;
}> = ({ router, resolves, transition }) => {
  if (!isLeaf(router, 'releases.package')) return uiView();

  const params = transition?.params() ?? {};

  return packagePage(
    router,
    String(params.pkg),
    resolves.versions,
    resolves.notes,
    v.parse(PrereleasesParam, params[PRERELEASES_PARAM]),
  );
};

const npmFacts = (row: LedgerVersion): TemplateResult => {
  if (row.npm_integrity === null)
    return html`<dt>npm</dt>
      <dd>Not published</dd>`;

  return html`<dt>Published to npm</dt>
    <dd>${date(row.npm_published_at)}</dd>
    ${
      row.npm_deprecated === null
        ? html`<dt>Integrity</dt>
            <dd><code class="hash">${row.npm_integrity}</code></dd>`
        : html`<dt>Deprecated</dt>
            <dd>${row.npm_deprecated}</dd>`
    }`;
};

const tagFacts = (row: LedgerVersion): TemplateResult => {
  const tag = tagOf(row);

  return row.git_sha === null
    ? html`<dt>Git tag</dt>
        <dd>None recorded</dd>`
    : html`<dt>Git tag</dt>
        <dd>
          <a href=${`${REPOSITORY}/tree/${encodeURIComponent(tag)}`}
            ><code>${tag}</code></a
          >
          at <code class="hash">${row.git_sha.slice(0, 12)}</code>
        </dd>`;
};

const diffFacts = (
  versions: readonly LedgerVersion[],
  row: LedgerVersion,
): TemplateResult | typeof nothing => {
  const source = diff(versions, row);
  const files = diff(versions, row, filesDiffPath);

  return html`${
    source
      ? html`<dt>Diff</dt>
          <dd>${source} on DiffsHub</dd>`
      : nothing
  }${
    files
      ? html`<dt>Published files</dt>
          <dd>${files}</dd>`
      : nothing
  }`;
};

const ghFacts = (row: LedgerVersion, term: string): TemplateResult =>
  html`<dt>${term}</dt>
    <dd>
      ${githubRelease(row)}${
        row.gh_published_at === null
          ? nothing
          : html`, ${date(row.gh_published_at)}`
      }
    </dd>`;

/** `releases.package.version`: one version's notes when its changelog has a section, then its facts, linking out to its GitHub release and its diff. */
export const VersionView: RoutedLitTemplate<{
  release: LedgerVersion;
  versions: LedgerVersion[];
  notes: ReleaseNotes;
}> = ({ router, resolves: { release: row, versions, notes } }) => {
  const note = notes[row.version];

  return html`
    ${crumbs(router, [
      {
        label: row.name,
        href: router.stateService.href('releases.package', { pkg: row.name }),
      },
      { label: row.version },
    ])}
    <h1>${row.name}@${row.version}</h1>
    ${
      note
        ? html`<h2 id="notes">Release notes</h2>
            ${notesBody(note)}
            <h2 id="details">Details</h2>`
        : nothing
    }
    <dl class="facts">
      <dt>Status</dt>
      <dd>${row.status}</dd>
      ${npmFacts(row)} ${tagFacts(row)}
      ${ghFacts(row, note ? 'GitHub release' : 'Release notes')}
      ${diffFacts(versions, row)}
    </dl>
  `;
};

/** `releases.package.compare`: the files two versions published to npm, diffed once on the server and rendered by `release-diff.ts`. */
/** The patch link without JavaScript; a binding can't sit inside raw-text <noscript>, so the layout is baked into the template. */
const noscriptDownload = staticHtml`<noscript
  ><p>
    The diff renders with JavaScript.
    <a href="${unsafeStatic(LAYOUT)}/patch" download>Download the patch</a>
    instead.
  </p></noscript
>`;

export const CompareView: RoutedLitTemplate<{
  pair: PublishedPair;
}> = ({ router, resolves: { pair } }) => {
  const { name: pkg } = pair.to;
  const range = `${pair.from.version}...${pair.to.version}`;
  const source = diffUrl(pair.from, pair.to);

  return html`
    ${crumbs(router, [
      {
        label: pkg,
        href: router.stateService.href('releases.package', { pkg }),
      },
      { label: range },
    ])}
    <h1>${pkg} ${range}</h1>
    <p>
      The files npm published for each version, compared as
      <code
        >npm diff --diff=${pkg}@${pair.from.version}
        --diff=${pkg}@${pair.to.version}</code
      >
      prints
      them.${
        source
          ? html` The git source compare is
              <a href=${source}>on DiffsHub</a>.`
          : nothing
      }
    </p>
    <section
      class="npm-diff"
      data-npm-diff
      data-package=${pkg}
      data-from=${pair.from.version}
      data-to=${pair.to.version}
      aria-label="Changed files"
    >
      <p class="diff-status" role="status">Loading the diff…</p>
      ${noscriptDownload}
      <fieldset class="diff-filter" hidden>
        <legend>Show</legend>
      </fieldset>
      <button type="button" class="diff-fold-all" hidden>
        Collapse all files
      </button>
      <p class="diff-note" role="status"></p>
      <div class="diff-layout">
        <nav class="diff-nav" aria-label="Files" hidden>
          <button
            type="button"
            class="diff-nav-toggle"
            aria-expanded="false"
            aria-controls="diff-tree"
          >
            Files
          </button>
          <div class="diff-tree" id="diff-tree"></div>
        </nav>
        <ol class="diff-files"></ol>
      </div>
    </section>
  `;
};

/** `notFound`: the mount's otherwise state, and any package or version the ledger lacks. */
export const NotFoundView: RoutedLitTemplate = () => html`
  <h1>Not found</h1>
  <p>
    No release lives at this address.
    <a href=${`${RELEASES_MOUNT}/`}>See every package</a>.
  </p>
`;

/** The page while the ledger cannot be read. */
export const unavailableView = (): TemplateResult => html`
  <h1>Releases are unavailable</h1>
  <p>
    The release ledger could not be read. Every release is also on
    <a href=${`${REPOSITORY}/releases`}>GitHub</a>.
  </p>
`;

/** The routed root: one `<ui-router>` around one `<ui-view>`. */
export const rootView = (router: UIRouterLit): TemplateResult =>
  html`<ui-router .uiRouter=${router}>${uiView()}</ui-router>`;
