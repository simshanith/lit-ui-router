// The routed views; each parent draws its own page at its own url and its child's view below it.
import type { UIRouter } from '@uirouter/core';
import { html, nothing } from 'lit';
import type { TemplateResult } from 'lit';
import type { RoutedLitTemplate, UIRouterLit } from 'lit-ui-router/pure';
import { uiViewSlot } from 'lit-ui-router-ssr/client';

import { isStable, previousIn } from './ledger.ts';
import type { LedgerPackage, LedgerVersion } from './ledger.ts';
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

const diff = (
  versions: readonly LedgerVersion[],
  row: LedgerVersion,
): TemplateResult | null => {
  const previous = previousIn(versions, row);
  const url = previous && diffUrl(previous, row);

  return previous && url
    ? html`<a href=${url}
        ><span class="visually-hidden">Diff </span>from ${previous.version}<span
          class="visually-hidden"
        >
          to ${row.version}</span
        ></a
      >`
    : null;
};

const githubRelease = (row: LedgerVersion): TemplateResult | string => {
  const url = releaseUrl(row);

  return url
    ? html`<a href=${url}
        >GitHub release<span class="visually-hidden">
          for ${row.name}@${row.version}</span
        ></a
      >`
    : 'None recorded';
};

const href = (
  router: UIRouter,
  state: string,
  params: Record<string, string> = {},
): string => `${router.stateService.href(state, params)}/`;

const isLeaf = (router: UIRouter, state: string): boolean =>
  router.globals.current.name === state;

const crumbs = (
  router: UIRouter,
  trail: readonly { label: string; href?: string }[],
): TemplateResult =>
  html`<nav aria-label="Breadcrumb">
    <ol class="crumbs">
      <li><a href=${href(router, 'releases')}>Releases</a></li>
      ${trail.map(({ label, href: to }) =>
        to
          ? html`<li><a href=${to}>${label}</a></li>`
          : html`<li><span aria-current="page">${label}</span></li>`,
      )}
    </ol>
  </nav>`;

const indexPage = (
  router: UIRouter,
  packages: readonly LedgerPackage[],
): TemplateResult => html`
  <h1>Releases</h1>
  <p>
    The latest stable release of each package, as the release ledger records it.
    Each package lists every version it has released.
  </p>
  <div class="table">
    <table>
      <thead>
        <tr>
          <th scope="col">Package</th>
          <th scope="col">Latest</th>
          <th scope="col">Published</th>
        </tr>
      </thead>
      <tbody>
        ${packages.map(
          ({ name: pkg, latest: row }) =>
            html`<tr>
              <th scope="row">
                <a href=${href(router, 'releases.package', { pkg })}>${pkg}</a>
              </th>
              <td>
                ${
                  row
                    ? html`<a
                        href=${href(router, 'releases.package.version', {
                          pkg,
                          version: row.version,
                        })}
                        ><span class="visually-hidden">${pkg}@</span
                        >${row.version}</a
                      >`
                    : 'None recorded'
                }
              </td>
              <td>${date(row?.npm_published_at ?? null)}</td>
            </tr>`,
        )}
      </tbody>
    </table>
  </div>
`;

/** `releases`: every package with its latest stable release. */
export const ReleasesView: RoutedLitTemplate<{
  packages: readonly LedgerPackage[];
}> = ({ router, resolves }) =>
  isLeaf(router, 'releases') ? indexPage(router, resolves.packages) : uiView();

const packagePage = (
  router: UIRouter,
  pkg: string,
  versions: readonly LedgerVersion[],
): TemplateResult => html`
  ${crumbs(router, [{ label: pkg }])}
  <h1>${pkg}</h1>
  <p>
    Every version of <code>${pkg}</code> the release ledger records, newest
    first. Its npm page is
    <a href=${`https://www.npmjs.com/package/${pkg}`}>${pkg} on npm</a>.
  </p>
  <div class="table">
    <table>
      <thead>
        <tr>
          <th scope="col">Version</th>
          <th scope="col">Status</th>
          <th scope="col">Published</th>
          <th scope="col">Notes</th>
          <th scope="col">Diff</th>
        </tr>
      </thead>
      <tbody>
        ${versions.map(
          (row) =>
            html`<tr>
              <th scope="row">
                <a
                  href=${href(router, 'releases.package.version', {
                    pkg,
                    version: row.version,
                  })}
                  >${row.version}</a
                >${
                  isStable(row.version)
                    ? nothing
                    : html` <span class="tag">prerelease</span>`
                }
              </th>
              <td>${row.status}</td>
              <td>${date(row.npm_published_at)}</td>
              <td>${githubRelease(row)}</td>
              <td>${diff(versions, row) ?? '—'}</td>
            </tr>`,
        )}
      </tbody>
    </table>
  </div>
`;

/** `releases.package`: one package's versions, newest first. */
export const PackageView: RoutedLitTemplate<{
  versions: LedgerVersion[];
}> = ({ router, resolves, transition }) =>
  isLeaf(router, 'releases.package')
    ? packagePage(router, String(transition?.params().pkg), resolves.versions)
    : uiView();

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
  const link = diff(versions, row);

  return link
    ? html`<dt>Diff</dt>
        <dd>${link} on DiffsHub</dd>`
    : nothing;
};

/** `releases.package.version`: one version's facts, linking out to its GitHub release and its diff. */
export const VersionView: RoutedLitTemplate<{
  release: LedgerVersion;
  versions: LedgerVersion[];
}> = ({ router, resolves: { release: row, versions } }) => html`
  ${crumbs(router, [
    {
      label: row.name,
      href: href(router, 'releases.package', { pkg: row.name }),
    },
    { label: row.version },
  ])}
  <h1>${row.name}@${row.version}</h1>
  <dl class="facts">
    <dt>Status</dt>
    <dd>${row.status}</dd>
    ${npmFacts(row)} ${tagFacts(row)}
    <dt>Release notes</dt>
    <dd>
      ${githubRelease(row)}${
        row.gh_published_at === null
          ? nothing
          : html`, ${date(row.gh_published_at)}`
      }
    </dd>
    ${diffFacts(versions, row)}
  </dl>
`;

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
