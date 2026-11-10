// GET/PATCH /accounts/{account_id}/builds/workers/{external_script_id}, which
// @distilled.cloud/cloudflare does not generate, declared in its generated shape.

import {
  CloudflareError,
  CloudflareRateLimited,
} from '@distilled.cloud/cloudflare/Errors';
import {
  type CloudflareOpContext,
  type CloudflareOpError,
  CloudflareProtocol,
} from '@distilled.cloud/cloudflare/Protocol';
import * as Retry from '@distilled.cloud/cloudflare/Retry';
import * as T from '@distilled.cloud/cloudflare/Traits';
import * as API from '@distilled.cloud/core/api';
import { Schema as S } from 'effect';

const TELEMETRY = {
  system: 'cloudflare-api',
  responseHeaders: [
    {
      header: 'x-request-id',
      name: 'http.response.header.x-request-id',
      transform: 'list',
    },
    {
      header: 'request-id',
      name: 'http.response.header.request-id',
      transform: 'list',
    },
    {
      header: 'cf-ray',
      name: 'http.response.header.cf-ray',
      transform: 'list',
    },
  ],
  prefix: 'Cloudflare',
  service: 'WorkersBuilds',
  labels: 'cloudflare',
  propagate: 'w3c',
} as const;

const StringList = S.Array(S.String);

const EnvironmentVariable = S.Struct({
  isSecret: S.optional(S.NullOr(S.Boolean).pipe(T.Body('is_secret'))),
  value: S.optional(S.NullOr(S.String)),
});

const EnvironmentVariables = S.Record(S.String, EnvironmentVariable);

/** The settings Workers Previews builds run with, in place of a preview trigger. */
const PreviewsBaseConfig = S.Struct({
  buildCommand: S.optional(S.NullOr(S.String).pipe(T.Body('build_command'))),
  deployCommand: S.optional(S.NullOr(S.String).pipe(T.Body('deploy_command'))),
  rootDirectory: S.optional(S.NullOr(S.String).pipe(T.Body('root_directory'))),
  pathIncludes: S.optional(S.NullOr(StringList).pipe(T.Body('path_includes'))),
  pathExcludes: S.optional(S.NullOr(StringList).pipe(T.Body('path_excludes'))),
  environmentVariables: S.optional(
    S.NullOr(EnvironmentVariables).pipe(T.Body('environment_variables')),
  ),
});

export type PreviewsBaseConfig = typeof PreviewsBaseConfig.Type;

const PreviewsBaseConfigPatch = S.Struct({
  buildCommand: S.optional(S.String.pipe(T.Body('build_command'))),
  deployCommand: S.optional(S.String.pipe(T.Body('deploy_command'))),
  rootDirectory: S.optional(S.String.pipe(T.Body('root_directory'))),
  pathIncludes: S.optional(StringList.pipe(T.Body('path_includes'))),
  pathExcludes: S.optional(StringList.pipe(T.Body('path_excludes'))),
  environmentVariables: S.optional(
    S.Record(
      S.String,
      S.Struct({
        isSecret: S.Boolean.pipe(T.Body('is_secret')),
        value: S.String,
      }),
    ).pipe(T.Body('environment_variables')),
  ),
});

export type PreviewsBaseConfigPatch = typeof PreviewsBaseConfigPatch.Type;

const WorkerBuildSettings = S.Struct({
  previewsEnabled: S.optional(
    S.NullOr(S.Boolean).pipe(T.Body('previews_enabled')),
  ),
  previewsBaseConfig: S.optional(
    S.NullOr(PreviewsBaseConfig).pipe(T.Body('previews_base_config')),
  ),
});

export const GetWorkerBuildSettingsRequest = S.Struct({
  accountId: S.String.pipe(T.Label('account_id')),
  externalScriptId: S.String.pipe(T.Label('external_script_id')),
})
  .pipe(
    T.Http({
      method: 'GET',
      uri: '/accounts/{account_id}/builds/workers/{external_script_id}',
      code: 200,
    }),
  )
  .annotate({ identifier: 'GetWorkerBuildSettingsRequest' });

export type GetWorkerBuildSettingsRequest =
  typeof GetWorkerBuildSettingsRequest.Type;

export const GetWorkerBuildSettingsResponse = WorkerBuildSettings.annotate({
  identifier: 'GetWorkerBuildSettingsResponse',
});

export type GetWorkerBuildSettingsResponse =
  typeof GetWorkerBuildSettingsResponse.Type;

export const UpdateWorkerBuildSettingsRequest = S.Struct({
  accountId: S.String.pipe(T.Label('account_id')),
  externalScriptId: S.String.pipe(T.Label('external_script_id')),
  previewsBaseConfig: S.optional(
    PreviewsBaseConfigPatch.pipe(T.Body('previews_base_config')),
  ),
})
  .pipe(
    T.Http({
      method: 'PATCH',
      uri: '/accounts/{account_id}/builds/workers/{external_script_id}',
      code: 200,
    }),
  )
  .annotate({ identifier: 'UpdateWorkerBuildSettingsRequest' });

export type UpdateWorkerBuildSettingsRequest =
  typeof UpdateWorkerBuildSettingsRequest.Type;

export const UpdateWorkerBuildSettingsResponse = WorkerBuildSettings.annotate({
  identifier: 'UpdateWorkerBuildSettingsResponse',
});

export type UpdateWorkerBuildSettingsResponse =
  typeof UpdateWorkerBuildSettingsResponse.Type;

/** A Worker's build settings, Workers Previews included. */
export const getWorkerBuildSettings: API.OperationMethod<
  GetWorkerBuildSettingsRequest,
  GetWorkerBuildSettingsResponse,
  CloudflareOpError,
  CloudflareOpContext
> = API.make(() => ({
  input: GetWorkerBuildSettingsRequest,
  output: GetWorkerBuildSettingsResponse,
  errors: [CloudflareRateLimited, CloudflareError],
  protocol: CloudflareProtocol,
  retry: Retry.Retry,
  telemetry: TELEMETRY,
  span: 'GetWorkerBuildSettings',
}));

/** Update a Worker's build settings; members left out keep their value. */
export const updateWorkerBuildSettings: API.OperationMethod<
  UpdateWorkerBuildSettingsRequest,
  UpdateWorkerBuildSettingsResponse,
  CloudflareOpError,
  CloudflareOpContext
> = API.make(() => ({
  input: UpdateWorkerBuildSettingsRequest,
  output: UpdateWorkerBuildSettingsResponse,
  errors: [CloudflareRateLimited, CloudflareError],
  protocol: CloudflareProtocol,
  retry: Retry.Retry,
  telemetry: TELEMETRY,
  span: 'UpdateWorkerBuildSettings',
}));
