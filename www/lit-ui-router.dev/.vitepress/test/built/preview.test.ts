import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, it } from 'node:test';

import { getByRole } from '@testing-library/dom';
import { workspaceRoot } from '@tools/bootstrap/root.ts';

import {
  htmlPath,
  snapshotCanonicals,
  snapshotPackage,
} from '../../snapshot.ts';
import { SITE_ORIGIN } from '../../versions.ts';
import { withPage } from '../with-page.ts';

// Reads the preview's build, so it runs as that package's test, after its build.
const root = join(workspaceRoot, snapshotPackage('main'), 'dist');

const dir = join(root, 'main');

describe('the built preview of the unreleased docs', () => {
  it('gives every prerendered page a canonical link on the released site', async () => {
    const { pages, missing } = await snapshotCanonicals(dir, '/main/');

    assert.deepEqual(missing, []);
    assert.ok(Object.keys(pages).length > 400);

    for (const [page, target] of Object.entries(pages)) {
      assert.ok(page.startsWith('/main/'), page);
      assert.ok(target.startsWith('/') && !target.startsWith('/main/'), page);
    }

    assert.equal(pages['/main/'], '/');
    assert.equal(pages['/main/guides/'], '/guides/');
  });

  it('shows the unreleased banner, linking the same page on the released site', async () => {
    for (const page of [
      'index.html',
      'guides/index.html',
      'guides/unmatched-urls.html',
      'reference/lit-ui-router/index.html',
    ]) {
      await withPage(join(dir, page), (doc) => {
        const banner = getByRole(doc.body, 'note', { name: 'Docs version' });

        assert.match(banner.textContent ?? '', /Unreleased docs from main/);
        assert.equal(
          getByRole(banner, 'link', { name: 'Go to released' }).getAttribute(
            'href',
          ),
          htmlPath(page),
          page,
        );
      });
    }
  });

  it("keeps the main site's indexes out, and its own llms.txt under the prefix", () => {
    for (const file of ['sitemap.xml', 'sitemap-pages.xml', 'robots.txt'])
      assert.ok(!existsSync(join(dir, file)), file);

    for (const file of ['llms.txt', 'llms-full.txt']) {
      const text = readFileSync(join(dir, file), 'utf8');

      assert.match(text, /These are the unreleased docs/, file);
      assert.ok(text.includes(`${SITE_ORIGIN}/main/guides/`), file);
      assert.ok(!text.includes(`${SITE_ORIGIN}/guides/`), file);
      assert.ok(!text.includes('/main/main/'), file);
    }
  });

  it('sends its paths under the worker mounts to the mounts, and scopes its headers to the prefix', () => {
    const redirects = readFileSync(join(root, '_redirects'), 'utf8');
    const headers = readFileSync(join(root, '_headers'), 'utf8');

    assert.ok(redirects.includes('/main/releases/* /releases/:splat 301'));

    const rules = headers.split('\n').filter((line) => /^\S/.test(line));

    assert.ok(rules.length > 0);
    assert.deepEqual(
      rules.filter((rule) => !rule.startsWith('/main/')),
      [],
    );
  });
});
