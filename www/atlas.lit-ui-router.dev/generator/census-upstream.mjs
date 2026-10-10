// Upstream consignments probe: what the repo owner sent to OTHER repositories since the ref's first
// commit (GitHub search), what came back home (this repo's PRs, issues, comments and commits citing
// it), and bug reports filed with the Firefox and WebKit bugzillas.  Writes data/census-upstream.json.
import { execFileSync } from 'node:child_process';
import { ROOT, refFromArgv } from './basis.mjs';
import { writeData } from './census-query.mjs';

const REF = refFromArgv();
const git = (...args) => execFileSync('git', args, { cwd: ROOT, maxBuffer: 1 << 28 }).toString();
const gh = (...args) => execFileSync('gh', args, { cwd: ROOT, maxBuffer: 1 << 28 }).toString();
const ghJson = (...args) => JSON.parse(gh(...args));
const fail = (msg) => { throw new Error(`census-upstream: ${msg}`); };

const sha = git('rev-parse', '--short', REF).trim();
const commitDate = git('show', '-s', '--format=%cI', REF).trim();
const since = git('log', '--reverse', '--format=%cI', REF).split('\n')[0];
const UNTIL = Date.parse(commitDate);
const SINCE = Date.parse(since);
const inWindow = (iso) => Date.parse(iso) >= SINCE && Date.parse(iso) <= UNTIL;

const HOME = ghJson('repo', 'view', '--json', 'nameWithOwner,owner');
const LOGIN = HOME.owner.login;
const [HOME_OWNER, HOME_NAME] = HOME.nameWithOwner.split('/');

// ---- the surveyor's bugzilla identity: the top human author's non-noreply address ----
const BOT = /\[bot\]|^(Copilot|dependabot|github-actions)\b/i;
const authors = git('shortlog', '-sne', REF).split('\n').filter(Boolean).map((l) => {
  const m = l.match(/^\s*(\d+)\t(.+) <([^>]+)>$/) ?? fail(`unparsed shortlog line ${l}`);
  return { n: Number(m[1]), name: m[2], email: m[3] };
}).filter((a) => !BOT.test(a.name));
const TOP = authors[0] ?? fail('no human author on the ref');
const REPORTER = authors.find((a) => a.name === TOP.name && !a.email.endsWith('@users.noreply.github.com'))?.email
  ?? fail(`${TOP.name} commits under no mailbox a bugzilla account could hold`);

// ---- outgoing: two author searches, every page in one call each ----
const SEARCH_FIELDS = 'number,title,url,state,createdAt,closedAt,repository';
const search = (kind) => {
  const rows = ghJson('search', kind, '--author', LOGIN, '--limit', '1000', '--json', SEARCH_FIELDS, '--', `-user:${LOGIN}`);
  if (!Array.isArray(rows)) fail(`gh search ${kind} returned no array`);
  return rows.map((r) => {
    const repo = r.repository?.nameWithOwner ?? fail(`search ${kind} row without a repository: ${r.url}`);
    if (!r.number || !r.createdAt || !r.state) fail(`search ${kind} row missing fields: ${r.url}`);
    return { ...r, repo, kind: kind === 'prs' ? 'pr' : 'issue', state: r.state.toLowerCase() };
  });
};
const OUT = [...search('prs'), ...search('issues')].filter((r) => r.repo.split('/')[0] !== LOGIN);

// ---- bugzilla: reports filed under the surveyor's address ----
const BUGZILLAS = [
  { id: 'bugzilla.mozilla.org', name: 'Firefox', engine: 'firefox' },
  { id: 'bugs.webkit.org', name: 'WebKit', engine: 'webkit' },
];
const BUG_FIELDS = 'id,summary,status,resolution,creation_time,last_change_time,product,component';
const bugState = (b) => {
  if (!['RESOLVED', 'VERIFIED', 'CLOSED'].includes(b.status)) return 'open';
  return b.resolution === 'FIXED' ? 'fixed' : 'closed';
};
const bugsOf = async (host) => {
  const q = new URLSearchParams({ email1: REPORTER, emailtype1: 'equals', emailreporter1: '1', include_fields: BUG_FIELDS });
  const res = await fetch(`https://${host}/rest/bug?${q}`);
  if (!res.ok) fail(`${host} answered ${res.status}`);
  const body = await res.json();
  if (!Array.isArray(body.bugs)) fail(`${host} returned no bugs array`);
  return body.bugs.map((b) => ({
    id: `${host}#${b.id}`, yard: host, kind: 'bug', number: b.id, title: b.summary,
    url: `https://${host}/show_bug.cgi?id=${b.id}`, state: bugState(b),
    createdAt: b.creation_time, closedAt: bugState(b) === 'open' ? null : b.last_change_time,
  }));
};
const BUGS = (await Promise.all(BUGZILLAS.map((z) => bugsOf(z.id)))).flat();

// ---- the consignments in the window, and the prior record before it ----
const githubConsignment = (r) => ({
  id: `${r.repo}#${r.number}`, yard: r.repo, kind: r.kind, number: r.number, title: r.title, url: r.url,
  state: r.state, createdAt: r.createdAt, closedAt: r.closedAt && r.closedAt.startsWith('0001') ? null : r.closedAt || null,
});
const consigned = [
  ...OUT.filter((r) => inWindow(r.createdAt)).map(githubConsignment),
  ...BUGS.filter((b) => inWindow(b.createdAt)),
].sort((a, b) => Date.parse(a.createdAt) - Date.parse(b.createdAt) || a.id.localeCompare(b.id));

const before = OUT.filter((r) => Date.parse(r.createdAt) < SINCE).sort((a, b) => a.createdAt.localeCompare(b.createdAt));
const prior = {
  prs: before.filter((r) => r.kind === 'pr').length,
  merged: before.filter((r) => r.kind === 'pr' && r.state === 'merged').length,
  issues: before.filter((r) => r.kind === 'issue').length,
  repos: new Set(before.map((r) => r.repo)).size,
  first: before[0]?.createdAt.slice(0, 10) ?? null,
  last: before.at(-1)?.createdAt.slice(0, 10) ?? null,
};

// ---- the home side: every PR and issue of this repo, with its conversation and reviews, by GraphQL ----
const TEXT = 'totalCount nodes { body createdAt }';
const ITEM = `number title body state createdAt comments(first: 100) { ${TEXT} }`;
const REVIEWS = `reviews(first: 50) { ${TEXT} } reviewThreads(first: 50) { totalCount nodes { comments(first: 50) { ${TEXT} } } }`;
const CONN = { pullRequests: { size: 50, fields: `${ITEM} ${REVIEWS}` }, issues: { size: 100, fields: ITEM } };
const QUERY = (conn) => `query($owner: String!, $name: String!, $cursor: String) {
  repository(owner: $owner, name: $name) { ${conn}(first: ${CONN[conn].size}, after: $cursor) {
    pageInfo { hasNextPage endCursor } nodes { ${CONN[conn].fields} } } } }`;
const rest = (path) => ghJson('api', '--paginate', '--slurp', `repos/${HOME_OWNER}/${HOME_NAME}/${path}`)
  .flat().map((c) => ({ body: c.body ?? '', createdAt: c.created_at ?? c.submitted_at }));
const full = (conn) => conn.totalCount <= conn.nodes.length;
const commentsOf = (n) => (full(n.comments) ? n.comments.nodes : rest(`issues/${n.number}/comments`));
const reviewTextOf = (n) => {
  if (!n.reviews) return [];
  const threads = n.reviewThreads;
  const whole = full(n.reviews) && full(threads) && threads.nodes.every((t) => full(t.comments));
  if (!whole) return [...rest(`pulls/${n.number}/reviews`), ...rest(`pulls/${n.number}/comments`)];
  return [...n.reviews.nodes, ...threads.nodes.flatMap((t) => t.comments.nodes)];
};
const pageOf = (conn, cursor) => {
  const args = ['api', 'graphql', '-f', `query=${QUERY(conn)}`, '-F', `owner=${HOME_OWNER}`, '-F', `name=${HOME_NAME}`];
  if (cursor) args.push('-f', `cursor=${cursor}`);
  const page = ghJson(...args).data?.repository?.[conn] ?? fail(`graphql ${conn} page without data`);
  if (!Array.isArray(page.nodes)) fail(`graphql ${conn} page without nodes`);
  return page;
};
const homeItems = (conn, kind) => {
  const out = [];
  for (let cursor = null, more = true; more;) {
    const page = pageOf(conn, cursor);
    for (const n of page.nodes) {
      const comments = [...commentsOf(n), ...reviewTextOf(n)];
      out.push({ kind, number: n.number, title: n.title, body: n.body ?? '', state: n.state.toLowerCase(), createdAt: n.createdAt, comments });
    }
    ({ hasNextPage: more, endCursor: cursor } = page.pageInfo);
  }
  return out;
};
const HOME_ITEMS = [...homeItems('pullRequests', 'pr'), ...homeItems('issues', 'issue')]
  .filter((i) => Date.parse(i.createdAt) <= UNTIL);

// ---- commits on the ref, full messages, one read ----
const COMMITS = git('log', REF, '--format=%H%x1f%cI%x1f%s%x1f%B%x1e').split('\x1e').map((r) => r.trim()).filter(Boolean)
  .map((r) => {
    const [full, date, subject, body] = r.split('\x1f');
    return { sha: full.slice(0, 7), date, subject, body };
  });

// ---- citation patterns: a URL, `owner/repo#N`, or `#N` right after a repo the text names ----
const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const citesGithub = (c) => {
  const [owner, name] = c.yard.split('/').map(esc);
  const full = new RegExp(`(?<![\\w.-])${owner}/${name}`, 'i');
  const url = new RegExp(`github\\.com/${owner}/${name}/(?:issues|pull)/${c.number}(?!\\d)`, 'i');
  const slug = new RegExp(`(?<![\\w.-])${owner}/${name}(?:\\s+|:\\s*)?#${c.number}(?!\\d)`, 'i');
  const bare = new RegExp(`(?<![\\w./-])${name}#${c.number}(?!\\d)`, 'i');
  return (text) => url.test(text) || slug.test(text) || (full.test(text) && bare.test(text));
};
const citesBug = (c) => {
  const short = c.yard === 'bugs.webkit.org' ? `webkit\\.org/b/${c.number}` : `bugzil\\.la/${c.number}`;
  const re = new RegExp(`(?:${esc(c.yard)}/show_bug\\.cgi\\?id=${c.number}|${short})(?!\\d)`, 'i');
  return (text) => re.test(text);
};

// a body citation dates from the item; a comment or review citation dates from that text
const itemCite = (item, cites) => {
  if (cites(`${item.title}\n${item.body}`)) return item.createdAt;
  return item.comments.filter((cm) => Date.parse(cm.createdAt) <= UNTIL && cites(cm.body)).map((cm) => cm.createdAt).sort()[0] ?? null;
};
const returnsOf = (c) => {
  const cites = c.kind === 'bug' ? citesBug(c) : citesGithub(c);
  const home = HOME_ITEMS.map((i) => ({ i, date: itemCite(i, cites) })).filter((x) => x.date)
    .map(({ i, date }) => ({ kind: i.kind, ref: `#${i.number}`, title: i.title, date, state: i.state }));
  const commits = COMMITS.filter((m) => cites(m.body))
    .map((m) => ({ kind: 'commit', ref: m.sha, title: m.subject, date: m.date, state: 'merged' }));
  const seen = new Set();
  return [...home, ...commits].filter((r) => !seen.has(`${r.kind}:${r.ref}`) && seen.add(`${r.kind}:${r.ref}`))
    .sort((a, b) => Date.parse(a.date) - Date.parse(b.date) || a.ref.localeCompare(b.ref));
};
const consignments = consigned.map((c) => ({ ...c, returns: returnsOf(c) }));

// ---- yards: stars, the published package (root manifest or the repo's own name, pointing home) ----
// npm emits an ARRAY for multi-field --json views inside the workspace; take the sole element
const npmView = (name) => {
  try {
    const raw = JSON.parse(execFileSync('npm', ['view', name, 'name', 'repository.url', '--json'], { stdio: ['ignore', 'pipe', 'ignore'] }).toString());
    return Array.isArray(raw) ? raw[0] : raw;
  } catch { return null; }
};
const pointsAt = (repo, view) => new RegExp(`github\\.com[/:]${esc(repo)}(?:\\.git)?$`, 'i').test(view?.['repository.url'] ?? '');
const rootName = (repo) => {
  try {
    const file = execFileSync('gh', ['api', `repos/${repo}/contents/package.json`], { stdio: ['ignore', 'pipe', 'ignore'] }).toString();
    return JSON.parse(Buffer.from(JSON.parse(file).content, 'base64').toString()).name ?? null;
  }
  catch { return null; }
};
const packageOf = (repo) => {
  const names = [rootName(repo), repo.split('/')[1]].filter(Boolean);
  return names.find((n) => pointsAt(repo, npmView(n))) ?? null;
};
const weekly = async (pkg) => {
  if (!pkg) return null;
  const res = await fetch(`https://api.npmjs.org/downloads/point/last-week/${pkg}`);
  if (!res.ok) fail(`npm downloads for ${pkg} answered ${res.status}`);
  const body = await res.json();
  return Number.isInteger(body.downloads) ? body.downloads : fail(`npm downloads for ${pkg} carry no count`);
};
const githubYard = async (repo) => {
  const stars = ghJson('api', `repos/${repo}`).stargazers_count;
  if (!Number.isInteger(stars)) fail(`repos/${repo} carries no stargazers_count`);
  const pkg = packageOf(repo);
  return { id: repo, host: 'github', name: repo.split('/')[1], stars, package: pkg, weeklyDownloads: await weekly(pkg), engine: null };
};
const ghYards = await Promise.all([...new Set(consignments.filter((c) => c.kind !== 'bug').map((c) => c.yard))].map(githubYard));
const yards = [
  ...ghYards.sort((a, b) => b.stars - a.stars || a.name.localeCompare(b.name)),
  ...BUGZILLAS.map((z) => ({ id: z.id, host: 'bugzilla', name: z.name, stars: null, package: null, weeklyDownloads: null, engine: z.engine }))
    .sort((a, b) => a.name.localeCompare(b.name)),
];

console.log(`window ${since} .. ${commitDate} (ref ${REF} @ ${sha}); home ${HOME.nameWithOwner}: ${HOME_ITEMS.length} PRs+issues, ${COMMITS.length} commits`);
for (const y of yards) console.log(y.id.padEnd(30), String(y.stars ?? '-').padStart(7), String(y.package ?? '-').padEnd(16), y.weeklyDownloads ?? '-');
for (const c of consignments) console.log(c.id.padEnd(34), c.kind.padEnd(6), c.state.padEnd(7), c.createdAt.slice(0, 10), c.returns.map((r) => `${r.kind}:${r.ref}`).join(' ') || '-');
console.log('prior', JSON.stringify(prior), 'reporter', REPORTER, 'bugs', BUGS.length);

writeData('census-upstream.json', {
  ref: REF,
  sha,
  commitDate,
  generatedAtTime: new Date().toISOString(),
  wasGeneratedBy: 'www/atlas.lit-ui-router.dev/generator/census-upstream.mjs',
  used: `gh search prs+issues --author ${LOGIN} -user:${LOGIN} (github.com) + gh api graphql ${HOME.nameWithOwner} pullRequests, issues, comments, reviews + git log ${REF} @ ${sha} + bugzilla REST (${BUGZILLAS.map((z) => z.id).join(', ')}) + npm view, api.npmjs.org downloads`,
  wasAssociatedWith: ['gh (GitHub search, REST + GraphQL)', 'git log', 'Bugzilla REST', 'npm'],
  surveyor: { login: LOGIN, reporter: REPORTER },
  window: { since, until: commitDate },
  yards,
  consignments,
  prior,
}, ['yards', 'consignments']);
