---
title: How this site runs
description: lit-ui-router.dev on Cloudflare — static assets, the docs worker that routes the sample apps and release pages, and the release-ledger worker behind them
---

# How this site runs

lit-ui-router.dev is a Cloudflare Worker with static assets. The docs are
plain files; a worker answers only the paths that need a routing decision —
the sample apps, through `ui-router-server`, and the release pages, from a
second worker that keeps the release ledger.
[Server-Side Routing](./guides/server-route-matching#the-worker-verdicts-→-http)
follows a single request through the docs worker.

<svg viewBox="0 0 720 420" width="100%" style="max-width: 720px" role="img" aria-label="Architecture of lit-ui-router.dev. 1, readers, reach Cloudflare. 2, static assets, answer every path that is not worker-first. 3, the docs worker gets the worker-first paths: the sample apps, /releases and /gh; it fetches shells, 404 pages and pass-through requests from static assets, and reads the release ledger over RPC from 4, the ledger worker. The ledger worker enqueues claims to and consumes them from 5, Queues, and writes to 6, D1. 7, GitHub, sends claims to the ledger worker, which observes GitHub and 8, npm." xmlns="http://www.w3.org/2000/svg">
  <title>lit-ui-router.dev: static assets, the docs worker and the release ledger</title>
  <defs>
    <marker id="arr-site" viewBox="0 0 8 8" refX="7" refY="4" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
      <path d="M0 0L8 4L0 8z" fill="var(--vp-c-text-3, #929295)" />
    </marker>
  </defs>
  <g font-family="var(--vp-font-family-base, ui-sans-serif, system-ui, sans-serif)">
    <!-- Cloudflare zone -->
    <rect x="148" y="24" width="404" height="356" rx="12" fill="#f6821f" fill-opacity="0.03" stroke="#f6821f" stroke-width="1.2" stroke-dasharray="4 4" />
    <rect x="160" y="14" width="98" height="20" fill="var(--vp-c-bg, #ffffff)" />
    <svg x="164" y="14" width="24" height="20" viewBox="0 2 24 20"><path fill="#f6821f" d="M16.5088 16.8447c.1475-.5068.0908-.9707-.1553-1.3154-.2246-.3164-.6045-.499-1.0615-.5205l-8.6592-.1123a.1559.1559 0 0 1-.1333-.0713c-.0283-.042-.0351-.0986-.021-.1553.0278-.084.1123-.1484.2036-.1562l8.7359-.1123c1.0351-.0489 2.1601-.8868 2.5537-1.9136l.499-1.3013c.0215-.0561.0293-.1128.0147-.168-.5625-2.5463-2.835-4.4453-5.5499-4.4453-2.5039 0-4.6284 1.6177-5.3876 3.8614-.4927-.3658-1.1187-.5625-1.794-.499-1.2026.119-2.1665 1.083-2.2861 2.2856-.0283.31-.0069.6128.0635.894C1.5683 13.171 0 14.7754 0 16.752c0 .1748.0142.3515.0352.5273.0141.083.0844.1475.1689.1475h15.9814c.0909 0 .1758-.0645.2032-.1553l.12-.4268zm2.7568-5.5634c-.0771 0-.1611 0-.2383.0112-.0566 0-.1054.0415-.127.0976l-.3378 1.1744c-.1475.5068-.0918.9707.1543 1.3164.2256.3164.6055.498 1.0625.5195l1.8437.1133c.0557 0 .1055.0263.1329.0703.0283.043.0351.1074.0214.1562-.0283.084-.1132.1485-.204.1553l-1.921.1123c-1.041.0488-2.1582.8867-2.5527 1.914l-.1406.3585c-.0283.0713.0215.1416.0986.1416h6.5977c.0771 0 .1474-.0489.169-.126.1122-.4082.1757-.837.1757-1.2803 0-2.6025-2.125-4.727-4.7344-4.727" /></svg>
    <text x="192" y="29" font-size="12" font-weight="600" fill="var(--vp-c-text-1, #3c3c43)">Cloudflare</text>
    <!-- arrows -->
    <path d="M120 86H176" fill="none" stroke="var(--vp-c-text-3, #929295)" stroke-width="1.25" marker-end="url(#arr-site)" />
    <path d="M162 86V218H176" fill="none" stroke="var(--vp-c-text-3, #929295)" stroke-width="1.25" marker-end="url(#arr-site)" />
    <circle cx="162" cy="86" r="3" fill="var(--vp-c-text-3, #929295)" />
    <text font-size="11" fill="var(--vp-c-text-2, #67676c)"><tspan x="170" y="140">worker-first:</tspan><tspan x="170" y="154">sample apps,</tspan><tspan x="170" y="168">/releases, /gh</tspan></text>
    <path d="M292 188V120" fill="none" stroke="var(--vp-c-text-3, #929295)" stroke-width="1.25" marker-end="url(#arr-site)" />
    <text font-size="11" fill="var(--vp-c-text-2, #67676c)"><tspan x="300" y="146">shells, 404,</tspan><tspan x="300" y="160">pass-through</tspan></text>
    <path d="M316 218H352" fill="none" stroke="var(--vp-c-text-3, #929295)" stroke-width="1.25" marker-end="url(#arr-site)" />
    <text x="334" y="236" font-size="11" fill="var(--vp-c-text-2, #67676c)" text-anchor="middle">RPC</text>
    <path d="M380 248V296" fill="none" stroke="var(--vp-c-text-3, #929295)" stroke-width="1.25" marker-end="url(#arr-site)" />
    <path d="M412 300V252" fill="none" stroke="var(--vp-c-text-3, #929295)" stroke-width="1.25" marker-end="url(#arr-site)" />
    <text x="374" y="278" font-size="11" fill="var(--vp-c-text-2, #67676c)" text-anchor="end">enqueue</text>
    <text x="418" y="278" font-size="11" fill="var(--vp-c-text-2, #67676c)">consume</text>
    <path d="M500 248V296" fill="none" stroke="var(--vp-c-text-3, #929295)" stroke-width="1.25" marker-end="url(#arr-site)" />
    <text x="506" y="278" font-size="11" fill="var(--vp-c-text-2, #67676c)">write</text>
    <path d="M590 116H500V184" fill="none" stroke="var(--vp-c-text-3, #929295)" stroke-width="1.25" marker-end="url(#arr-site)" />
    <text x="571" y="110" font-size="11" fill="var(--vp-c-text-2, #67676c)" text-anchor="middle">claim</text>
    <path d="M536 218H566V144H586" fill="none" stroke="var(--vp-c-text-3, #929295)" stroke-width="1.25" marker-end="url(#arr-site)" />
    <path d="M566 218V286H586" fill="none" stroke="var(--vp-c-text-3, #929295)" stroke-width="1.25" marker-end="url(#arr-site)" />
    <text x="572" y="204" font-size="11" fill="var(--vp-c-text-2, #67676c)">observe</text>
    <!-- 1 readers -->
    <rect x="4" y="56" width="116" height="60" rx="8" fill="var(--vp-c-bg-soft, #f6f6f7)" stroke="var(--vp-c-divider, #e2e2e3)" />
    <rect x="14" y="66" width="24" height="24" rx="6" fill="var(--vp-c-indigo-1, #3451b2)" fill-opacity="0.14" />
    <svg x="18" y="70" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--vp-c-indigo-1, #3451b2)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10" /><path d="M12 2a14.5 14.5 0 0 0 0 20 14.5 14.5 0 0 0 0-20M2 12h20" /></svg>
    <text x="46" y="83" font-size="13" font-weight="600" fill="var(--vp-c-text-1, #3c3c43)">Readers</text>
    <text x="14" y="106" font-size="11" fill="var(--vp-c-text-2, #67676c)">browsers · badges</text>
    <circle cx="118" cy="58" r="9" fill="var(--vp-c-text-1, #3c3c43)" />
    <text x="118" y="61.5" font-size="10" font-weight="700" fill="var(--vp-c-bg, #ffffff)" text-anchor="middle">1</text>
    <!-- 2 static assets -->
    <rect x="180" y="56" width="136" height="60" rx="8" fill="var(--vp-c-bg-soft, #f6f6f7)" stroke="#f6821f" stroke-opacity="0.5" />
    <rect x="190" y="66" width="24" height="24" rx="6" fill="#f6821f" fill-opacity="0.14" />
    <svg x="194" y="70" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#f6821f" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 7h-3a2 2 0 0 1-2-2V2" /><path d="M9 18a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h7l4 4v10a2 2 0 0 1-2 2Z" /><path d="M3 7.6v12.8A1.6 1.6 0 0 0 4.6 22h9.8" /></svg>
    <text x="222" y="83" font-size="13" font-weight="600" fill="var(--vp-c-text-1, #3c3c43)">Static assets</text>
    <text x="190" y="106" font-size="11" fill="var(--vp-c-text-2, #67676c)">pages · 404.html</text>
    <circle cx="314" cy="58" r="9" fill="var(--vp-c-text-1, #3c3c43)" />
    <text x="314" y="61.5" font-size="10" font-weight="700" fill="var(--vp-c-bg, #ffffff)" text-anchor="middle">2</text>
    <!-- 3 docs worker -->
    <rect x="180" y="188" width="136" height="60" rx="8" fill="var(--vp-c-bg-soft, #f6f6f7)" stroke="#f6821f" stroke-opacity="0.5" />
    <rect x="190" y="198" width="24" height="24" rx="6" fill="#f6821f" fill-opacity="0.14" />
    <svg x="194" y="202" width="16" height="16" viewBox="0 0 24 24"><path fill="#f6821f" d="m8.213.063 8.879 12.136-8.67 11.739h2.476l8.665-11.735-8.89-12.14Zm4.728 0 9.02 11.992-9.018 11.883h2.496L24 12.656v-1.199L15.434.063ZM7.178 2.02.01 11.398l-.01 1.2 7.203 9.644 1.238-1.676-6.396-8.556 6.361-8.313Z" /></svg>
    <text x="222" y="215" font-size="13" font-weight="600" fill="var(--vp-c-text-1, #3c3c43)">Docs worker</text>
    <text x="190" y="238" font-size="11" fill="var(--vp-c-text-2, #67676c)">verdicts · releases</text>
    <circle cx="314" cy="190" r="9" fill="var(--vp-c-text-1, #3c3c43)" />
    <text x="314" y="193.5" font-size="10" font-weight="700" fill="var(--vp-c-bg, #ffffff)" text-anchor="middle">3</text>
    <!-- 4 ledger worker -->
    <rect x="356" y="188" width="180" height="60" rx="8" fill="var(--vp-c-bg-soft, #f6f6f7)" stroke="#f6821f" stroke-opacity="0.5" />
    <rect x="366" y="198" width="24" height="24" rx="6" fill="#f6821f" fill-opacity="0.14" />
    <svg x="370" y="202" width="16" height="16" viewBox="0 0 24 24"><path fill="#f6821f" d="m8.213.063 8.879 12.136-8.67 11.739h2.476l8.665-11.735-8.89-12.14Zm4.728 0 9.02 11.992-9.018 11.883h2.496L24 12.656v-1.199L15.434.063ZM7.178 2.02.01 11.398l-.01 1.2 7.203 9.644 1.238-1.676-6.396-8.556 6.361-8.313Z" /></svg>
    <text x="398" y="215" font-size="13" font-weight="600" fill="var(--vp-c-text-1, #3c3c43)">Ledger worker</text>
    <text x="366" y="238" font-size="11" fill="var(--vp-c-text-2, #67676c)">release-ledger</text>
    <circle cx="534" cy="190" r="9" fill="var(--vp-c-text-1, #3c3c43)" />
    <text x="534" y="193.5" font-size="10" font-weight="700" fill="var(--vp-c-bg, #ffffff)" text-anchor="middle">4</text>
    <!-- 5 queues -->
    <rect x="356" y="300" width="96" height="60" rx="8" fill="var(--vp-c-bg-soft, #f6f6f7)" stroke="#f6821f" stroke-opacity="0.5" />
    <rect x="366" y="310" width="24" height="24" rx="6" fill="#f6821f" fill-opacity="0.14" />
    <svg x="370" y="314" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#f6821f" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="7" width="5" height="10" rx="1" /><rect x="9.5" y="7" width="5" height="10" rx="1" /><path d="M17 12h5m-2.5-2.5L22 12l-2.5 2.5" /></svg>
    <text x="398" y="327" font-size="13" font-weight="600" fill="var(--vp-c-text-1, #3c3c43)">Queues</text>
    <text x="366" y="350" font-size="11" fill="var(--vp-c-text-2, #67676c)">claims</text>
    <circle cx="450" cy="302" r="9" fill="var(--vp-c-text-1, #3c3c43)" />
    <text x="450" y="305.5" font-size="10" font-weight="700" fill="var(--vp-c-bg, #ffffff)" text-anchor="middle">5</text>
    <!-- 6 D1 -->
    <rect x="464" y="300" width="72" height="60" rx="8" fill="var(--vp-c-bg-soft, #f6f6f7)" stroke="#f6821f" stroke-opacity="0.5" />
    <rect x="474" y="310" width="24" height="24" rx="6" fill="#f6821f" fill-opacity="0.14" />
    <svg x="478" y="314" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#f6821f" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><ellipse cx="12" cy="5" rx="9" ry="3" /><path d="M3 5v14a9 3 0 0 0 18 0V5M3 12a9 3 0 0 0 18 0" /></svg>
    <text x="506" y="327" font-size="13" font-weight="600" fill="var(--vp-c-text-1, #3c3c43)">D1</text>
    <text x="474" y="350" font-size="11" fill="var(--vp-c-text-2, #67676c)">ledger</text>
    <circle cx="534" cy="302" r="9" fill="var(--vp-c-text-1, #3c3c43)" />
    <text x="534" y="305.5" font-size="10" font-weight="700" fill="var(--vp-c-bg, #ffffff)" text-anchor="middle">6</text>
    <!-- 7 GitHub -->
    <rect x="590" y="100" width="118" height="60" rx="8" fill="var(--vp-c-bg-soft, #f6f6f7)" stroke="var(--vp-c-divider, #e2e2e3)" />
    <rect x="600" y="110" width="24" height="24" rx="6" fill="var(--vp-c-text-1, #3c3c43)" fill-opacity="0.1" />
    <svg x="604" y="114" width="16" height="16" viewBox="0 0 24 24"><path fill="var(--vp-c-text-1, #3c3c43)" d="M12 .297c-6.63 0-12 5.373-12 12 0 5.303 3.438 9.8 8.205 11.385.6.113.82-.258.82-.577 0-.285-.01-1.04-.015-2.04-3.338.724-4.042-1.61-4.042-1.61C4.422 18.07 3.633 17.7 3.633 17.7c-1.087-.744.084-.729.084-.729 1.205.084 1.838 1.236 1.838 1.236 1.07 1.835 2.809 1.305 3.495.998.108-.776.417-1.305.76-1.605-2.665-.3-5.466-1.332-5.466-5.93 0-1.31.465-2.38 1.235-3.22-.135-.303-.54-1.523.105-3.176 0 0 1.005-.322 3.3 1.23.96-.267 1.98-.399 3-.405 1.02.006 2.04.138 3 .405 2.28-1.552 3.285-1.23 3.285-1.23.645 1.653.24 2.873.12 3.176.765.84 1.23 1.91 1.23 3.22 0 4.61-2.805 5.625-5.475 5.92.42.36.81 1.096.81 2.22 0 1.606-.015 2.896-.015 3.286 0 .315.21.69.825.57C20.565 22.092 24 17.592 24 12.297c0-6.627-5.373-12-12-12" /></svg>
    <text x="632" y="127" font-size="13" font-weight="600" fill="var(--vp-c-text-1, #3c3c43)">GitHub</text>
    <text x="600" y="150" font-size="11" fill="var(--vp-c-text-2, #67676c)">Actions · releases</text>
    <circle cx="706" cy="102" r="9" fill="var(--vp-c-text-1, #3c3c43)" />
    <text x="706" y="105.5" font-size="10" font-weight="700" fill="var(--vp-c-bg, #ffffff)" text-anchor="middle">7</text>
    <!-- 8 npm -->
    <rect x="590" y="256" width="118" height="60" rx="8" fill="var(--vp-c-bg-soft, #f6f6f7)" stroke="var(--vp-c-divider, #e2e2e3)" />
    <rect x="600" y="266" width="24" height="24" rx="6" fill="#cb3837" fill-opacity="0.14" />
    <svg x="604" y="270" width="16" height="16" viewBox="0 0 24 24"><path fill="#cb3837" d="M1.763 0C.786 0 0 .786 0 1.763v20.474C0 23.214.786 24 1.763 24h20.474c.977 0 1.763-.786 1.763-1.763V1.763C24 .786 23.214 0 22.237 0zM5.13 5.323l13.837.019-.009 13.836h-3.464l.01-10.382h-3.456L12.04 19.17H5.113z" /></svg>
    <text x="632" y="283" font-size="13" font-weight="600" fill="var(--vp-c-text-1, #3c3c43)">npm</text>
    <text x="600" y="306" font-size="11" fill="var(--vp-c-text-2, #67676c)">registry</text>
    <circle cx="706" cy="258" r="9" fill="var(--vp-c-text-1, #3c3c43)" />
    <text x="706" y="261.5" font-size="10" font-weight="700" fill="var(--vp-c-bg, #ffffff)" text-anchor="middle">8</text>
    <text x="4" y="410" font-size="12" font-weight="700" letter-spacing="0.08em" fill="var(--vp-c-text-1, #3c3c43)">LIT-UI-ROUTER.DEV</text>
  </g>
</svg>

1. **Readers** load `lit-ui-router.dev`: the docs, the sample apps, the
   `/releases` pages and the `/gh` redirects the README badges link to.
2. **Static assets** answer every path outside `run_worker_first` in the
   site's
   [`wrangler.jsonc`](https://github.com/simshanith/lit-ui-router/blob/main/www/lit-ui-router.dev/wrangler.jsonc),
   with `404.html` for misses; the worker never sees those requests. The
   sample-app mounts, the 404 exhibits, `/releases` and `/gh` go to the docs
   worker instead.
3. **The docs worker**
   ([`worker/index.ts`](https://github.com/simshanith/lit-ui-router/blob/main/www/lit-ui-router.dev/worker/index.ts))
   answers the sample-app mounts with
   [`ui-router-server` verdicts](./guides/server-route-matching#the-verdict):
   a redirect, a 404, or the app's shell, fetched back from static assets
   like its 404 pages and any path it doesn't route. It also renders the
   release pages and `/gh` redirects from ledger rows it reads over RPC,
   through the `LEDGER` service binding. It has no database of its own.
4. **The ledger worker**
   ([`release-ledger`](https://github.com/simshanith/lit-ui-router/blob/main/www/release-ledger.lit-ui-router.dev/README.md))
   takes release claims at `POST /claims`, consumes them from the queue, and
   is the only thing that writes to D1. A daily Cron Trigger enqueues a claim
   for every release tag.
5. **Queues** hold claims until the consumer takes them, one at a time, with a
   dead-letter queue for claims that run out of retries.
6. **D1** stores the release ledger.
7. **GitHub** sends a claim after each npm publish, from the `publish-npm.yml`
   workflow with an Actions OIDC token. The consumer reads its tags and
   releases.
8. **npm** versions and dist-tags, read by the consumer.

The ledger worker's bindings, queue settings and schedule are in its
[`wrangler.jsonc`](https://github.com/simshanith/lit-ui-router/blob/main/www/release-ledger.lit-ui-router.dev/wrangler.jsonc).
