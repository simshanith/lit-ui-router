#!/usr/bin/env bash
#
# Shim over cloudflare-build.ts, which holds the build steps.
#
# `build_command` is one dashboard value for every branch at once, so this path
# has to hold still: renaming it breaks the preview build of every branch whose
# checkout does not carry the new name. Once every open branch has this file,
# `build_command` can point at cloudflare-build.ts directly and this file can go
# (see www/DEPLOY.md).
set -euo pipefail

exec ./tools/workers-builds/cloudflare-build.ts "$@"
