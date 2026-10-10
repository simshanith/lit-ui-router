// Upstream consignments probe: every external GitHub issue/PR and every Firefox/WebKit bugzilla bug
// the repo cites — in its PRs, issues, comments, reviews and the commit messages on the ref, bot text
// excluded — resolved upstream, marked sent when a city contributor filed it, with the home items and
// commits that cite each one.  Writes www/atlas.lit-ui-router.dev/data/census-upstream.json.
import { execFileSync } from 'node:child_process';
import { ROOT, refFromArgv } from './basis.mjs';
import { writeData } from './census-query.mjs';

const REF = refFromArgv();
const run = (cmd, args) => execFileSync(cmd, args, { cwd: ROOT, maxBuffer: 1 << 28, stdio: ['ignore', 'pipe', 'pipe'] }).toString();
const git = (...args) => run('git', args);
const ghJson = (...args) => JSON.parse(run('gh', args));
const fail = (msg) => { throw new Error(`census-upstream: ${msg}`); };

const sha = git('rev-parse', '--short', REF).trim();
const commitDate = git('show', '-s', '--format=%cI', REF).trim();
const since = git('log', '--reverse', '--format=%cI', REF).split('\n')[0];
const UNTIL = Date.parse(commitDate);
const SINCE = Date.parse(since);
const upTo = (iso) => Date.parse(iso) <= UNTIL;

const HOME = ghJson('repo', 'view', '--json', 'nameWithOwner,owner');
const [HOME_OWNER, HOME_NAME] = HOME.nameWithOwner.split('/');

// a bot is a GraphQL Bot actor, a `[bot]` login or Copilot
const isBotLogin = (login, type) => type === 'Bot' || /\[bot\]$/i.test(login ?? '') || /^copilot/i.test(login ?? '');
const isBotEmail = (s) => /\[bot\]|copilot/i.test(s);

// ---- the home side: every PR and issue, with conversation, reviews and review threads ----
const ACTOR = 'author { login __typename }';
const TEXT = `totalCount nodes { body createdAt ${ACTOR} }`;
// the home label that marks an item as tracking work in another project
const LABEL = 'external';
const ITEM = `number title body state createdAt ${ACTOR} labels(first: 20) { nodes { name } } comments(first: 100) { ${TEXT} }`;
const REVIEWS = `reviews(first: 50) { ${TEXT} } reviewThreads(first: 50) { totalCount nodes { comments(first: 50) { ${TEXT} } } }`;
const CONN = { pullRequests: { size: 50, fields: `${ITEM} ${REVIEWS}` }, issues: { size: 100, fields: ITEM } };
const QUERY = (conn) => `query($owner: String!, $name: String!, $cursor: String) {
  repository(owner: $owner, name: $name) { ${conn}(first: ${CONN[conn].size}, after: $cursor) {
    pageInfo { hasNextPage endCursor } nodes { ${CONN[conn].fields} } } } }`;
const gqlText = (t) => ({ body: t.body ?? '', createdAt: t.createdAt, bot: isBotLogin(t.author?.login, t.author?.__typename) });
const rest = (path) => ghJson('api', '--paginate', '--slurp', `repos/${HOME_OWNER}/${HOME_NAME}/${path}`)
  .flat().map((c) => ({ body: c.body ?? '', createdAt: c.created_at ?? c.submitted_at, bot: isBotLogin(c.user?.login, c.user?.type) }));
const full = (conn) => conn.totalCount <= conn.nodes.length;
const commentsOf = (n) => (full(n.comments) ? n.comments.nodes.map(gqlText) : rest(`issues/${n.number}/comments`));
const reviewTextOf = (n) => {
  if (!n.reviews) return [];
  const threads = n.reviewThreads;
  const whole = full(n.reviews) && full(threads) && threads.nodes.every((t) => full(t.comments));
  if (!whole) return [...rest(`pulls/${n.number}/reviews`), ...rest(`pulls/${n.number}/comments`)];
  return [...n.reviews.nodes, ...threads.nodes.flatMap((t) => t.comments.nodes)].map(gqlText);
};
const pageOf = (conn, cursor) => {
  const args = ['api', 'graphql', '-f', `query=${QUERY(conn)}`, '-F', `owner=${HOME_OWNER}`, '-F', `name=${HOME_NAME}`];
  if (cursor) args.push('-f', `cursor=${cursor}`);
  const page = ghJson(...args).data?.repository?.[conn] ?? fail(`graphql ${conn} page without data`);
  if (!Array.isArray(page.nodes)) fail(`graphql ${conn} page without nodes`);
  return page;
};
const homeItem = (n, kind) => ({
  kind, number: n.number, title: n.title, state: n.state.toLowerCase(), createdAt: n.createdAt,
  external: n.labels.nodes.some((l) => l.name === LABEL),
  login: n.author?.login ?? null, bot: isBotLogin(n.author?.login, n.author?.__typename),
  texts: [{ body: `${n.title}\n${n.body ?? ''}`, createdAt: n.createdAt, bot: isBotLogin(n.author?.login, n.author?.__typename) },
    ...commentsOf(n), ...reviewTextOf(n)],
});
const homeItems = (conn, kind) => {
  const out = [];
  for (let cursor = null, more = true; more;) {
    const page = pageOf(conn, cursor);
    out.push(...page.nodes.map((n) => homeItem(n, kind)));
    ({ hasNextPage: more, endCursor: cursor } = page.pageInfo);
  }
  return out;
};
const HOME_ITEMS = [...homeItems('pullRequests', 'pr'), ...homeItems('issues', 'issue')].filter((i) => upTo(i.createdAt));

// the city's contributors: humans who have merged a PR into the home repo
const COMMITTERS = new Set(HOME_ITEMS.filter((i) => i.kind === 'pr' && i.state === 'merged' && !i.bot && i.login).map((i) => i.login.toLowerCase()));

// ---- commits on the ref, full messages, one read; bot-authored commits skipped ----
const COMMITS = git('log', REF, '--format=%H%x1f%cI%x1f%an <%ae>%x1f%s%x1f%B%x1e').split('\x1e').map((r) => r.trim()).filter(Boolean)
  .map((r) => {
    const [full, date, author, subject, body] = r.split('\x1f');
    return { sha: full.slice(0, 7), date, author, subject, body };
  })
  .filter((c) => !isBotEmail(c.author));
const EMAILS = new Set(git('shortlog', '-sne', REF).split('\n').filter(Boolean)
  .map((l) => l.match(/<([^>]+)>$/)?.[1] ?? fail(`unparsed shortlog line ${l}`))
  .filter((e) => !isBotEmail(e)).map((e) => e.toLowerCase()));

// ---- citation extraction: GitHub URLs, owner/repo#N, repo#N beside a named owner/repo, bugzilla links ----
const GH_URL = /github\.com\/([\w.-]+)\/([\w.-]+)\/(?:issues|pull)\/(\d+)(?!\d)/gi;
const GH_SLUG = /(?<![\w./@-])([A-Za-z0-9][\w.-]*)\/([\w.-]+)#(\d+)(?!\d)/g;
const BUG_RES = [
  [/bugzilla\.mozilla\.org\/show_bug\.cgi\?id=(\d+)/gi, 'bugzilla.mozilla.org'],
  [/bugzil\.la\/(\d+)/gi, 'bugzilla.mozilla.org'],
  [/bugs\.webkit\.org\/show_bug\.cgi\?id=(\d+)/gi, 'bugs.webkit.org'],
  [/webkit\.org\/b\/(\d+)/gi, 'bugs.webkit.org'],
];
const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const external = (owner) => owner.toLowerCase() !== HOME_OWNER.toLowerCase();
const ghKey = (owner, repo, n) => `${owner}/${repo.replace(/\.git$/, '')}#${Number(n)}`;
const bareCites = (text, slugs) => slugs.flatMap(([owner, repo]) =>
  [...text.matchAll(new RegExp(`(?<![\\w./-])${esc(repo)}#(\\d+)(?!\\d)`, 'gi'))].map((m) => ghKey(owner, repo, m[1])));
const citesIn = (text) => {
  const urls = [...text.matchAll(GH_URL)].map((m) => [m[1], m[2], m[3]]);
  const slugs = [...text.matchAll(GH_SLUG)].map((m) => [m[1], m[2], m[3]]);
  const named = [...urls, ...slugs].filter(([o]) => external(o));
  const gh = [...named.map(([o, r, n]) => ghKey(o, r, n)), ...bareCites(text, named)];
  const bugs = BUG_RES.flatMap(([re, host]) => [...text.matchAll(re)].map((m) => `${host}#${Number(m[1])}`));
  return new Set([...gh, ...bugs]);
};

// raw cited key -> returns, each dated by the earliest human text that cites it
const CITED = new Map();
const addReturn = (key, ret) => {
  const list = CITED.get(key) ?? [];
  const prev = list.find((r) => r.kind === ret.kind && r.ref === ret.ref);
  if (!prev) list.push(ret);
  else if (Date.parse(ret.date) < Date.parse(prev.date)) prev.date = ret.date;
  CITED.set(key, list);
};
for (const i of HOME_ITEMS) {
  for (const t of i.texts.filter((x) => !x.bot && upTo(x.createdAt))) {
    for (const key of citesIn(t.body)) addReturn(key, { kind: i.kind, ref: `#${i.number}`, title: i.title, date: t.createdAt, state: i.state, external: i.external });
  }
}
for (const c of COMMITS) {
  for (const key of citesIn(c.body)) addReturn(key, { kind: 'commit', ref: c.sha, title: c.subject, date: c.date, state: 'merged' });
}

// ---- resolve each cited item upstream; a 404/410 is filed as missing, anything else throws ----
const BUG_FIELDS = 'id,summary,status,resolution,creation_time,last_change_time,creator';
const bugState = (b) => {
  if (!['RESOLVED', 'VERIFIED', 'CLOSED'].includes(b.status)) return 'open';
  return b.resolution === 'FIXED' ? 'fixed' : 'closed';
};
const missing = (yard, kind, number, url) => ({ id: `${yard}#${number}`, yard, kind, number, title: null, url, state: 'missing', createdAt: null, closedAt: null, author: { login: null }, sent: false });
const resolveBug = async (host, number) => {
  const url = `https://${host}/show_bug.cgi?id=${number}`;
  const res = await fetch(`https://${host}/rest/bug/${number}?include_fields=${BUG_FIELDS}`);
  if (res.status === 404 || res.status === 401) return missing(host, 'bug', number, url);
  if (!res.ok) fail(`${host} bug ${number} answered ${res.status}`);
  const b = (await res.json()).bugs?.[0];
  if (!b) return missing(host, 'bug', number, url);
  const state = bugState(b);
  return {
    id: `${host}#${number}`, yard: host, kind: 'bug', number, title: b.summary, url, state,
    createdAt: b.creation_time, closedAt: state === 'open' ? null : b.last_change_time,
    author: { login: b.creator ?? null }, sent: EMAILS.has(String(b.creator ?? '').toLowerCase()),
  };
};
const ghGet = (path) => {
  try { return ghJson('api', path); }
  catch (e) {
    if (/HTTP 404|HTTP 410/.test(String(e.stderr ?? e.message))) return null;
    throw e;
  }
};
const resolveGh = (raw) => {
  const [, owner, repo, number] = raw.match(/^([^/]+)\/(.+)#(\d+)$/);
  const n = Number(number);
  const issue = ghGet(`repos/${owner}/${repo}/issues/${n}`);
  if (!issue) return missing(`${owner}/${repo}`, 'issue', n, `https://github.com/${owner}/${repo}/issues/${n}`);
  const yard = issue.html_url.match(/github\.com\/([^/]+\/[^/]+)\//)?.[1] ?? fail(`unparsed html_url ${issue.html_url}`);
  const pr = issue.pull_request ? ghGet(`repos/${yard}/pulls/${n}`) : null;
  const login = issue.user?.login ?? null;
  return {
    id: `${yard}#${n}`, yard, kind: issue.pull_request ? 'pr' : 'issue', number: n, title: issue.title, url: issue.html_url,
    state: pr?.merged_at ? 'merged' : issue.state, createdAt: issue.created_at, closedAt: issue.closed_at ?? null,
    author: { login }, sent: COMMITTERS.has(String(login).toLowerCase()),
  };
};
const resolve = (raw) => {
  const bug = raw.match(/^(bugzilla\.mozilla\.org|bugs\.webkit\.org)#(\d+)$/);
  return bug ? resolveBug(bug[1], Number(bug[2])) : resolveGh(raw);
};

// canonical ids merge renamed or transferred citations; their returns union
const sortReturns = (list) => list.sort((a, b) => Date.parse(a.date) - Date.parse(b.date) || a.ref.localeCompare(b.ref));
const merged = new Map();
for (const [raw, rets] of [...CITED].sort(([a], [b]) => a.localeCompare(b))) {
  const c = await resolve(raw);
  const prev = merged.get(c.id.toLowerCase());
  if (!prev) { merged.set(c.id.toLowerCase(), { ...c, raw: [raw], returns: [...rets] }); continue; }
  prev.raw.push(raw);
  for (const r of rets) if (!prev.returns.some((p) => p.kind === r.kind && p.ref === r.ref)) prev.returns.push(r);
}
const consignments = [...merged.values()]
  .map(({ raw: _raw, returns, ...c }) => ({ ...c, inWindow: c.createdAt !== null && Date.parse(c.createdAt) >= SINCE, tracked: returns.some((r) => r.external), returns: sortReturns(returns) }))
  .sort((a, b) => (Date.parse(a.createdAt ?? '') || Infinity) - (Date.parse(b.createdAt ?? '') || Infinity) || a.id.localeCompare(b.id));

// ---- yards: stars, the published package (root manifest or the repo's own name, pointing home) ----
// npm emits an ARRAY for multi-field --json views inside the workspace; take the sole element
const npmView = (name) => {
  try {
    const raw = JSON.parse(run('npm', ['view', name, 'name', 'repository.url', '--json']));
    return Array.isArray(raw) ? raw[0] : raw;
  } catch { return null; }
};
const pointsAt = (repo, view) => new RegExp(`github\\.com[/:]${esc(repo)}(?:\\.git)?$`, 'i').test(view?.['repository.url'] ?? '');
const rootName = (repo) => {
  const file = ghGet(`repos/${repo}/contents/package.json`);
  try { return file ? JSON.parse(Buffer.from(file.content, 'base64').toString()).name ?? null : null; }
  catch { return null; }
};
const packageOf = (repo) => [rootName(repo), repo.split('/')[1]].filter(Boolean).find((n) => pointsAt(repo, npmView(n))) ?? null;
const weekly = async (pkg) => {
  if (!pkg) return null;
  const res = await fetch(`https://api.npmjs.org/downloads/point/last-week/${pkg}`);
  if (!res.ok) fail(`npm downloads for ${pkg} answered ${res.status}`);
  const body = await res.json();
  return Number.isInteger(body.downloads) ? body.downloads : fail(`npm downloads for ${pkg} carry no count`);
};
const githubYard = async (repo) => {
  const info = ghGet(`repos/${repo}`);
  const stars = info ? info.stargazers_count : null;
  if (info && !Number.isInteger(stars)) fail(`repos/${repo} carries no stargazers_count`);
  const pkg = info ? packageOf(repo) : null;
  return { id: repo, host: 'github', name: repo.split('/')[1], stars, package: pkg, weeklyDownloads: await weekly(pkg), engine: null };
};
const BUGZILLAS = [
  { id: 'bugzilla.mozilla.org', host: 'bugzilla', name: 'Firefox', stars: null, package: null, weeklyDownloads: null, engine: 'firefox' },
  { id: 'bugs.webkit.org', host: 'bugzilla', name: 'WebKit', stars: null, package: null, weeklyDownloads: null, engine: 'webkit' },
];
const ghYards = [];
for (const repo of [...new Set(consignments.filter((c) => c.kind !== 'bug').map((c) => c.yard))]) ghYards.push(await githubYard(repo));
const yards = [...ghYards.sort((a, b) => (b.stars ?? -1) - (a.stars ?? -1) || a.name.localeCompare(b.name)), ...BUGZILLAS];

console.log(`window ${since} .. ${commitDate} (ref ${REF} @ ${sha}); home ${HOME.nameWithOwner}: ${HOME_ITEMS.length} PRs+issues, ${COMMITS.length} human commits, ${COMMITTERS.size} contributors`);
for (const y of yards) console.log(y.id.padEnd(40), String(y.stars ?? '-').padStart(7), String(y.package ?? '-').padEnd(20), y.weeklyDownloads ?? '-', consignments.filter((c) => c.yard === y.id).length);
for (const c of consignments) {
  console.log(c.id.padEnd(48), c.kind.padEnd(5), c.state.padEnd(7), (c.createdAt ?? '-').slice(0, 10), c.sent ? 'SENT   ' : 'watched', c.inWindow ? 'in ' : 'OFF', (c.author.login ?? '-').padEnd(20), c.returns.map((r) => `${r.kind}:${r.ref}`).join(' '));
}
console.log('yards', yards.length, 'consignments', consignments.length, 'sent', consignments.filter((c) => c.sent).length,
  'inWindow', consignments.filter((c) => c.inWindow).length, 'missing', consignments.filter((c) => c.state === 'missing').map((c) => c.id).join(' ') || 0);

const citing = new Map(consignments.flatMap((c) => c.returns.filter((r) => r.kind !== 'commit').map((r) => [`${r.kind} ${r.ref}`, r])));
console.log('home items citing a consignment (label candidates):', citing.size, 'labelled', [...citing.values()].filter((r) => r.external).length);
for (const [k, r] of [...citing].sort(([, a], [, b]) => Number(a.ref.slice(1)) - Number(b.ref.slice(1)))) console.log(' ', k.padEnd(12), r.title);

writeData('census-upstream.json', {
  ref: REF,
  sha,
  commitDate,
  generatedAtTime: new Date().toISOString(),
  wasGeneratedBy: 'www/atlas.lit-ui-router.dev/generator/census-upstream.mjs',
  used: `gh api graphql ${HOME.nameWithOwner} pullRequests, issues, comments, reviews + git log ${REF} @ ${sha} (bot text excluded; home label "${LABEL}") + gh api repos/{owner}/{repo}/issues|pulls (github.com) + bugzilla REST (${BUGZILLAS.map((z) => z.id).join(', ')}) + npm view, api.npmjs.org downloads`,
  wasAssociatedWith: ['gh (GitHub REST + GraphQL)', 'git log', 'Bugzilla REST', 'npm'],
  window: { since, until: commitDate },
  yards,
  consignments,
}, ['yards', 'consignments']);
