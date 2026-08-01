// release-it config lives in JS, not JSON, because conventional-changelog-writer 9
// takes template partials as functions rather than handlebars strings. The empty
// header is the whole reason: release-it already names the GitHub release, so the
// preset's `## <version> (<date>)` line would just duplicate it.
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
        types: [
          { type: 'feat', section: 'Features' },
          { type: 'fix', section: 'Bug Fixes' },
          { type: 'perf', section: 'Performance Improvements' },
          { type: 'revert', section: 'Reverts' },
          { type: 'build', section: 'Build System' },
        ],
      },
      gitRawCommitsOpts: {
        path: '.',
      },
      ignoreRecommendedBump: true,
      writerOpts: {
        headerPartial: () => '',
      },
    },
  },
};
