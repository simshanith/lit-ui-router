// wrangler dev intermittently crashes mid-suite on CI runners (miniflare
// ProxyWorker "Network connection lost", workers-sdk#4561 class); pm2-runtime
// respawns it so the suite rerun in run-cypress-suites.ts finds a live server.
module.exports = {
  apps: [
    {
      name: 'wrangler-dev',
      script: 'pnpm',
      args: ['--filter', 'docs', 'exec', 'wrangler', 'dev', '--port', '8787'],
      interpreter: 'none',
      autorestart: true,
      // min_uptime above any suite length makes every exit "unstable", so
      // max_restarts is a total cap, not a consecutive-crash window; pm2
      // counts crashes (not respawns), so 3 crashes = 2 respawns.
      min_uptime: '1h',
      max_restarts: 3,
      restart_delay: 1000,
      kill_timeout: 5000,
    },
  ],
};
