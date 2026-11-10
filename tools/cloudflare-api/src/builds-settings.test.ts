import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  getWorkerBuildSettings,
  updateWorkerBuildSettings,
} from './builds-settings.ts';
import { call, type CloudflareApi } from './call.ts';

const ACCOUNT = 'account-1';

const URL_OF_TAG = `https://api.cloudflare.com/client/v4/accounts/${ACCOUNT}/builds/workers/tag-1`;

/** The settings as the API sends them. */
interface WireSettings {
  readonly previews_enabled: boolean;
  readonly previews_base_config?: object;
}

/** An API answering every request with `result`, recording each request. */
const answering = (result: WireSettings) => {
  const requests: Request[] = [];

  const api: CloudflareApi = {
    token: 'secret',
    accountId: ACCOUNT,
    fetch: (input, init) => {
      requests.push(new Request(input, init));

      return Promise.resolve(
        Response.json({ success: true, errors: [], messages: [], result }),
      );
    },
  };

  return { api, requests };
};

describe('getWorkerBuildSettings', () => {
  it('GETs the Worker and reads the Previews base config in camelCase', async () => {
    const { api, requests } = answering({
      previews_enabled: true,
      previews_base_config: {
        build_command: 'build',
        path_includes: ['a/*'],
        environment_variables: { HUSKY: { value: '0', is_secret: false } },
      },
    });

    const settings = await call(
      api,
      'GET settings',
      getWorkerBuildSettings({ accountId: ACCOUNT, externalScriptId: 'tag-1' }),
    );

    assert.deepEqual(
      requests.map(({ method, url }) => `${method} ${url}`),
      [`GET ${URL_OF_TAG}`],
    );
    assert.deepEqual(settings, {
      previewsEnabled: true,
      previewsBaseConfig: {
        buildCommand: 'build',
        pathIncludes: ['a/*'],
        environmentVariables: { HUSKY: { value: '0', isSecret: false } },
      },
    });
  });
});

describe('updateWorkerBuildSettings', () => {
  it('PATCHes only the given Previews base config members, in snake_case', async () => {
    const { api, requests } = answering({ previews_enabled: true });

    await call(
      api,
      'PATCH settings',
      updateWorkerBuildSettings({
        accountId: ACCOUNT,
        externalScriptId: 'tag-1',
        previewsBaseConfig: {
          deployCommand: 'deploy',
          environmentVariables: { HUSKY: { value: '0', isSecret: false } },
        },
      }),
    );

    const [request] = requests;

    assert.equal(request?.method, 'PATCH');
    assert.equal(request?.url, URL_OF_TAG);
    assert.deepEqual(await request?.json(), {
      previews_base_config: {
        deploy_command: 'deploy',
        environment_variables: { HUSKY: { value: '0', is_secret: false } },
      },
    });
  });
});
