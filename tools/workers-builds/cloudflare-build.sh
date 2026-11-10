#!/usr/bin/env bash
# Shim over cloudflare-build.ts for Previews per-branch triggers that still name it; see www/DEPLOY.md.
set -euo pipefail

exec ./tools/workers-builds/cloudflare-build.ts "$@"
