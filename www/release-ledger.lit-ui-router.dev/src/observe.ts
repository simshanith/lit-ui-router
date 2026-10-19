// What npm and GitHub say about one `<pkg>@<version>` right now. The consumer
// reads them through the Observer service, so tests can stand in for both.
import { Clock, Context, Effect, Layer, Schedule, Schema } from 'effect';
import { HttpClient, HttpClientError, HttpClientResponse } from 'effect/http';
import type { GhReleaseFacts, TagFacts } from '@tools/release-ledger';

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
  /** Every dist-tag the package carries, pointing anywhere; `null` when npm answers 404, which proves nothing. */
  distTags: Readonly<Record<string, string>> | null;
}

/** A source answered with something other than the fact or a 404; worth a retry. */
export class ObservationError extends Schema.TaggedError<ObservationError>()(
  'ObservationError',
  {
    source: Schema.String,
    reason: Schema.String,
    /** Seconds a rate limit asked to wait, past what a fetch waits in-request. */
    retryAfter: Schema.optionalKey(Schema.Number),
  },
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

/** The longest wait a fetch takes in-request; a longer one becomes the queue's delay. */
const MAX_IN_REQUEST_WAIT_SECONDS = 10;

/** Three attempts per fetch; `retryTransient` lets a shorter Retry-After stretch a wait. */
const FETCH_RETRY = {
  schedule: Schedule.exponential('500 millis').pipe(Schedule.jittered),
  times: 2,
};

/** Seconds a response asks to wait: Retry-After, else GitHub's primary-limit reset. */
export function requestedWait(
  { headers }: Pick<HttpClientResponse.HttpClientResponse, 'headers'>,
  now: number,
) {
  const retryAfter = headers['retry-after']?.trim();

  if (retryAfter !== undefined) {
    const at = /^\d+(\.\d+)?$/.test(retryAfter)
      ? now + Number(retryAfter) * 1000
      : Date.parse(retryAfter);

    return Number.isNaN(at) ? undefined : Math.max(0, (at - now) / 1000);
  }

  const reset = Number(headers['x-ratelimit-reset']);

  return headers['x-ratelimit-remaining'] === '0' && Number.isFinite(reset)
    ? Math.max(0, reset - now / 1000)
    : undefined;
}

/** GitHub's primary and secondary limits answer 403, which `retryTransient` alone treats as final. */
export const isGitHubRateLimit = (
  error: HttpClientError.HttpClientError | ObservationError,
): boolean => {
  const response = HttpClientError.isHttpClientError(error)
    ? error.response
    : undefined;

  return (
    response?.status === 403 &&
    (response.headers['retry-after'] !== undefined ||
      response.headers['x-ratelimit-remaining'] === '0')
  );
};

/** A 2xx or 404 passes; a wait past the in-request cap goes to the queue; other statuses fail for `retryTransient`. */
const handOffLongWaits =
  (source: string) => (response: HttpClientResponse.HttpClientResponse) =>
    Effect.gen(function* () {
      if (response.status < 300 || response.status === 404) return response;

      const wait = requestedWait(response, yield* Clock.currentTimeMillis);

      if (wait !== undefined && wait > MAX_IN_REQUEST_WAIT_SECONDS) {
        return yield* new ObservationError({
          source,
          reason: `HTTP ${response.status}`,
          retryAfter: wait,
        });
      }

      return yield* HttpClientResponse.filterStatusOk(response);
    });

/** The decoded body, or null on a 404. */
const getJson = <S extends Schema.Top>(
  client: HttpClient.HttpClient,
  source: string,
  url: string,
  schema: S,
  headers: Record<string, string>,
): Effect.Effect<S['Type'] | null, ObservationError, S['DecodingServices']> =>
  client.pipe(
    HttpClient.transformResponse(Effect.flatMap(handOffLongWaits(source))),
    HttpClient.retryTransient({
      retryOn: 'errors-only',
      while: isGitHubRateLimit,
      ...FETCH_RETRY,
    }),
    (retrying) => retrying.get(url, { headers }),
    Effect.flatMap((response) =>
      response.status === 404
        ? Effect.succeed(null)
        : HttpClientResponse.schemaBodyJson(schema)(response),
    ),
    Effect.mapError((error) =>
      error instanceof ObservationError
        ? error
        : new ObservationError({
            source,
            reason:
              HttpClientError.isHttpClientError(error) && error.response
                ? `HTTP ${error.response.status}`
                : error.message,
          }),
    ),
  );

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
  Effect.flatMap(HttpClient.HttpClient, (client) =>
    Effect.map(
      getJson(
        client,
        'github tags',
        `${repoUrl(env)}/git/matching-refs/tags/`,
        MatchingRefs,
        githubHeaders(env),
      ),
      (refs) => refs ?? [],
    ),
  );

export const makeObserver = (
  env: ObserverEnv,
  client: HttpClient.HttpClient,
): Observer['Service'] => {
  const github = githubHeaders(env);
  const npm = { Accept: 'application/json' };
  const repo = repoUrl(env);

  const tag = (name: string, version: string) =>
    Effect.gen(function* () {
      const ref = yield* getJson(
        client,
        'github tag',
        `${repo}/git/ref/tags/${refPath(`${name}@${version}`)}`,
        GitRef,
        github,
      );

      if (ref === null) return null;

      if (ref.object.type !== 'tag') return { sha: ref.object.sha };

      // An annotated tag points at a tag object; the ledger records the commit.
      const annotated = yield* getJson(
        client,
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
        client,
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
        client,
        'npm version',
        `${NPM_REGISTRY}/${npmPath(name)}/${version}`,
        NpmManifest,
        npm,
      );

      if (manifest === null) return null;

      const times = yield* getJson(
        client,
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
    getJson(
      client,
      'npm dist-tags',
      `${NPM_REGISTRY}/-/package/${npmPath(name)}/dist-tags`,
      DistTags,
      npm,
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

export const ObserverLive = (
  env: ObserverEnv,
): Layer.Layer<Observer, never, HttpClient.HttpClient> =>
  Layer.effect(
    Observer,
    Effect.map(HttpClient.HttpClient, (client) => makeObserver(env, client)),
  );
