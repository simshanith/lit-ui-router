#!/usr/bin/env bash
# Shim over cloudflare-build.ts for Previews per-branch triggers that still name it; see www/DEPLOY.md.
set -euo pipefail

# The deploy step's GitHub token; nothing in the build reads it.
unset GITHUB_DEPLOYMENTS_TOKEN

exec ./tools/workers-builds/cloudflare-build.ts "$@"
