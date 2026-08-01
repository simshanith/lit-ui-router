// The one release-it config for every publishable package. Each package keeps a
// one-line .release-it.js re-export so release-it's cwd-based config lookup (and
// `pnpm exec release-it` run inside a package) still resolves.
//
// JS, not JSON, because conventional-changelog-writer 9 takes template partials
// as functions rather than handlebars strings.
//
// Everything defaults to false: the workflows turn individual steps on via CLI
// flags, which is what keeps the pipeline's argv in @tools/release the single
// place a release behaviour changes.
export default {
  git: {
    commit: false,
    tag: false,
    tagName: '${npm.name}@${version}',
    push: false,
    requireUpstream: false,
  },
  github: {
    release: false,
    releaseName: 'Release ${npm.name}@${version}',
    autoGenerate: false,
  },
  npm: {
    publish: false,
  },
  plugins: {
    '@release-it/conventional-changelog': {
      preset: {
        name: 'conventionalcommits',
        // Explicit types, not the preset defaults: a package-scoped range of
        // only hidden types renders empty and release-it silently falls back to
        // a flat repo-wide git log (#423).
        types: [
          { type: 'feat', section: 'Features' },
          { type: 'fix', section: 'Bug Fixes' },
          { type: 'perf', section: 'Performance Improvements' },
          { type: 'revert', section: 'Reverts' },
          { type: 'build', section: 'Build System' },
        ],
      },
      // Relative to cwd, so each package's notes stay scoped to its own dir.
      gitRawCommitsOpts: {
        path: '.',
      },
      ignoreRecommendedBump: true,
      writerOpts: {
        // release-it already names the GitHub release, so the preset's
        // `## <version> (<date>)` line would only duplicate it.
        headerPartial: () => '',
      },
    },
  },
};
