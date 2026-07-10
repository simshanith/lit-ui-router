// Uploads bundle stats to Codecov from the built dist/ (turbo codecov:bundle,
// uncached) so the upload runs even when the vite build is a cache replay.
// Usage: node upload-bundle-stats.ts <bundle-name> [build-dir=dist]
// <bundle-name> must match the former @codecov/vite-plugin's <name>-<format>
// naming (e.g. sample-app-lit-vanilla-esm) or the codecov size series restarts.
import path from 'node:path';
import { pathToFileURL } from 'node:url';

import { createAndUploadReport } from '@codecov/bundle-analyzer';
import type { Manifest } from 'vite';

// The slice of the analyzer's Output we summarise. It types `beforeReportUpload`
// but is re-exported by neither the analyzer nor its bundler-plugin-core.
type UploadedAsset = { name: string; size: number };

const [bundleName, buildDir = 'dist'] = process.argv.slice(2);

if (!bundleName) {
  console.error('usage: upload-bundle-stats.ts <bundle-name> [build-dir]');
  process.exit(1);
}

if (!process.env.CODECOV_TOKEN) {
  console.log(
    `[codecov] CODECOV_TOKEN unset; skipping ${bundleName} bundle stats upload.`,
  );
  process.exit(0);
}

// Provenance filter: report only what rollup emitted (vite build.manifest),
// not publicDir copies or vite-plugin-static-copy files. The emitted html
// itself is not a manifest entry, so allow it explicitly; .vite/manifest.json
// is absent from its own emit list and falls out automatically.
// `buildDir` is relative to the cwd, but a bare relative import specifier
// resolves against this module — hence the file URL.
const manifestPath = path.resolve(buildDir, '.vite', 'manifest.json');
let manifest: Manifest;
try {
  // vite wrote this file in the same build, so vite's own type describes it.
  const module = (await import(pathToFileURL(manifestPath).href, {
    with: { type: 'json' },
  })) as { default: Manifest };
  manifest = module.default;
} catch (error) {
  // A missing or unparseable manifest means build.manifest regressed in the
  // vite config; silently uploading an empty report would be worse than failing.
  console.error(`[codecov] ${bundleName}: cannot read ${manifestPath}:`, error);
  process.exit(1);
}
const emitted = new Set(['index.html']);
for (const entry of Object.values(manifest)) {
  emitted.add(entry.file);
  for (const file of entry.css ?? []) emitted.add(file);
  for (const file of entry.assets ?? []) emitted.add(file);
}

let uploaded: UploadedAsset[] = [];

try {
  await createAndUploadReport(
    [buildDir],
    {
      bundleName,
      uploadToken: process.env.CODECOV_TOKEN,
      gitService: 'github',
      telemetry: false,
      enableBundleAnalysis: true,
    },
    {
      // Membership in the manifest-derived set, not name patterns.
      // (The analyzer's own ignorePatterns matches the absolute paths it
      // feeds micromatch unreliably; likely an upstream bug.)
      // Capturing the assets here is what the summary below reports, so the
      // uploaded payload and the summary cannot drift.
      beforeReportUpload: (report) => {
        report.assets = report.assets?.filter((asset) =>
          emitted.has(asset.name),
        );
        uploaded = report.assets ?? [];
        return Promise.resolve(report);
      },
    },
  );
  const total = uploaded.reduce((sum, asset) => sum + asset.size, 0);
  console.log(
    `[codecov] Uploaded ${bundleName} bundle stats: ${uploaded.length} assets, ${total} bytes.`,
  );
} catch (error) {
  // Availability of codecov must not gate CI (parity with the former
  // in-build plugin, which swallowed upload errors).
  console.error(`[codecov] ${bundleName} bundle stats upload failed:`, error);
}
