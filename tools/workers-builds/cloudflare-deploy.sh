#!/usr/bin/env bash
#
# The Cloudflare Workers Builds deploy command, kept in the repo for the same
# reason the build command is: the dashboard holds one value for every branch
# at once, so a branch that moves wrangler.jsonc changes this script's
# internals rather than the dashboard. The trigger config pins the path plus
# the environment, not the wrangler invocation, so branch divergence never
# reads as drift.
#
# Runs from the repo root, after cloudflare-build.sh (see DEPLOY.md).
set -euo pipefail

# `main` and `branch` name the two triggers, not git refs: production deploys,
# every other branch uploads a preview version.
case "${1-}" in
main)
  # No --config: wrangler discovers the root wrangler.jsonc from the repo root.
  exec npx wrangler deploy
  ;;
branch)
  exec npx wrangler versions upload
  ;;
*)
  echo "usage: $0 <main|branch>" >&2
  exit 2
  ;;
esac
