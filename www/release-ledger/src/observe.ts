// What npm and GitHub say about one `<pkg>@<version>` right now. The consumer
// reads them through the Observer service, so tests can stand in for both.
import { Context, Effect, Layer, Schema } from 'effect';

import type { GhReleaseFacts, TagFacts } from './release-ledger.core.ts';

export interface NpmVersion {
  integrity: string;
  publishedAt: string;
  /** npm's deprecation message; absent when the version is not deprecated. */
  deprecated?: string;
}

/** Each source's answer, `null` when it reports the fact absent. */
export interface Sources {
  tag: TagFacts | null;
  npm: NpmVersion | null;
  gh: GhReleaseFacts | null;
  /** Every dist-tag the package carries, pointing anywhere. */
  distTags: Readonly<Record<string, string>>;
}

/** A source answered with something other than the fact or a 404; worth a retry. */
export class ObservationError extends Schema.TaggedError<ObservationError>()(
  'ObservationError',
  { source: Schema.String, reason: Schema.String },
) {}

export class Observer extends Context.Service<
  Observer,
  {
    observe(
      name: string,
      version: string,
    ): Effect.Effect<Sources, ObservationError>;
  }
>()('release-ledger/Observer') {}

export interface ObserverEnv {
  OIDC_REPOSITORY: string;
  /** A read-only token; GitHub caps unauthenticated calls per shared IP. */
  GITHUB_TOKEN?: string;
}

const GITHUB_API = 'https://api.github.com';

const NPM_REGISTRY = 'https://registry.npmjs.org';

const GitRef = Schema.Struct({
  object: Schema.Struct({
    sha: Schema.String,
    type: Schema.String,
    url: Schema.String,
  }),
});

const GitTag = Schema.Struct({
  object: Schema.Struct({ sha: Schema.String }),
});

const Release = Schema.Struct({
  id: Schema.Number,
  html_url: Schema.String,
  prerelease: Schema.Boolean,
  body: Schema.NullOr(Schema.String),
  published_at: Schema.NullOr(Schema.String),
});

const NpmManifest = Schema.Struct({
  dist: Schema.Struct({ integrity: Schema.String }),
  deprecated: Schema.optionalKey(Schema.String),
});

const NpmTimes = Schema.Struct({
  time: Schema.Record(Schema.String, Schema.String),
});

const DistTags = Schema.Record(Schema.String, Schema.String);

/** The decoded body, or null on a 404. */
const getJson = <S extends Schema.Top>(
  source: string,
  url: string,
  schema: S,
  headers: Record<string, string>,
): Effect.Effect<S['Type'] | null, ObservationError, S['DecodingServices']> =>
  Effect.gen(function* () {
    const failed = (reason: string) => new ObservationError({ source, reason });

    const response = yield* Effect.tryPromise({
      try: () => fetch(url, { headers }),
      catch: (cause) => failed(String(cause)),
    });

    if (response.status === 404) return null;

    if (!response.ok) return yield* failed(`HTTP ${response.status}`);

    const body = yield* Effect.tryPromise({
      try: () => response.text(),
      catch: () => failed('the body is unreadable'),
    });

    return yield* Schema.decodeUnknownEffect(Schema.fromJsonString(schema))(
      body,
    ).pipe(Effect.mapError((error) => failed(error.message)));
  });

const npmPath = (name: string): string => name.replace('/', '%2f');

const refPath = (tag: string): string =>
  tag.split('/').map(encodeURIComponent).join('/');

const githubHeaders = (env: ObserverEnv) => ({
  Accept: 'application/vnd.github+json',
  'User-Agent': 'lit-ui-router-release-ledger',
  'X-GitHub-Api-Version': '2022-11-28',
  ...(env.GITHUB_TOKEN && { Authorization: `Bearer ${env.GITHUB_TOKEN}` }),
});

const repoUrl = (env: ObserverEnv): string =>
  `${GITHUB_API}/repos/${env.OIDC_REPOSITORY}`;

const MatchingRefs = Schema.Array(
  Schema.Struct({
    ref: Schema.String,
    object: Schema.Struct({ sha: Schema.String }),
  }),
);

/** Every tag in the repository, as `git/matching-refs` lists them. */
export const listTags = (env: ObserverEnv) =>
  Effect.map(
    getJson(
      'github tags',
      `${repoUrl(env)}/git/matching-refs/tags/`,
      MatchingRefs,
      githubHeaders(env),
    ),
    (refs) => refs ?? [],
  );

export const makeObserver = (env: ObserverEnv): Observer['Service'] => {
  const github = githubHeaders(env);
  const npm = { Accept: 'application/json' };
  const repo = repoUrl(env);

  const tag = (name: string, version: string) =>
    Effect.gen(function* () {
      const ref = yield* getJson(
        'github tag',
        `${repo}/git/ref/tags/${refPath(`${name}@${version}`)}`,
        GitRef,
        github,
      );

      if (ref === null) return null;

      if (ref.object.type !== 'tag') return { sha: ref.object.sha };

      // An annotated tag points at a tag object; the ledger records the commit.
      const annotated = yield* getJson(
        'github tag',
        ref.object.url,
        GitTag,
        github,
      );

      return annotated && { sha: annotated.object.sha };
    });

  const ghRelease = (name: string, version: string) =>
    Effect.map(
      getJson(
        'github release',
        `${repo}/releases/tags/${refPath(`${name}@${version}`)}`,
        Release,
        github,
      ),
      (release): GhReleaseFacts | null =>
        release?.published_at == null
          ? null
          : {
              id: release.id,
              url: release.html_url,
              prerelease: release.prerelease,
              body: release.body ?? '',
              publishedAt: release.published_at,
            },
    );

  // The per-version document carries no publish time; only the packument does.
  const npmVersion = (name: string, version: string) =>
    Effect.gen(function* () {
      const manifest = yield* getJson(
        'npm version',
        `${NPM_REGISTRY}/${npmPath(name)}/${version}`,
        NpmManifest,
        npm,
      );

      if (manifest === null) return null;

      const times = yield* getJson(
        'npm packument',
        `${NPM_REGISTRY}/${npmPath(name)}`,
        NpmTimes,
        npm,
      );

      const publishedAt = times?.time[version];

      // the version document and the packument disagree; npm is mid-update
      if (publishedAt === undefined) {
        return yield* new ObservationError({
          source: 'npm packument',
          reason: `no publish time for ${version}`,
        });
      }

      return {
        integrity: manifest.dist.integrity,
        publishedAt,
        ...(manifest.deprecated && { deprecated: manifest.deprecated }),
      } satisfies NpmVersion;
    });

  const distTags = (name: string) =>
    Effect.map(
      getJson(
        'npm dist-tags',
        `${NPM_REGISTRY}/-/package/${npmPath(name)}/dist-tags`,
        DistTags,
        npm,
      ),
      (tags) => tags ?? {},
    );

  return {
    observe: (name, version) =>
      Effect.all(
        {
          tag: tag(name, version),
          npm: npmVersion(name, version),
          gh: ghRelease(name, version),
          distTags: distTags(name),
        },
        { concurrency: 'unbounded' },
      ),
  };
};

export const ObserverLive = (env: ObserverEnv): Layer.Layer<Observer> =>
  Layer.succeed(Observer, makeObserver(env));
