#!/usr/bin/env bash
#
# Shim. The build steps moved to cloudflare-build.ts, alongside the deploy
# command that was already TypeScript; this file stays only because
# `build_command` is one dashboard value for every branch at once. Renaming it
# would break the preview build of every branch whose checkout predates the
# rename — so the path holds still while the branches catch up.
#
# Once every open branch has merged this, `build_command` can point at
# cloudflare-build.ts directly and this file can go (see www/DEPLOY.md).
set -euo pipefail

exec ./tools/workers-builds/cloudflare-build.ts "$@"
