#!/usr/bin/env bash
#
# The Cloudflare Workers Builds build command, kept in the repo so it can
# differ per branch: the dashboard holds one value for every branch at once,
# and a package-manager change needs a different bootstrap on its branch than
# main has. The trigger config pins the path, not the steps, so branch
# divergence never reads as drift.
#
# Runs from the repo root under SKIP_DEPENDENCY_INSTALL=1 — Cloudflare's own
# install step is off, so installing is this script's job (see DEPLOY.md).
set -euo pipefail

# Bootstrap floor, not the version that runs: >=11.20.0 to read a pnpm-12
# lockfile, then `packageManager` self-swaps. Via npx because the corepack
# `pnpm` on PATH cannot materialize a pnpm-12 pin.
npx pnpm@11.21.0 install --frozen-lockfile

# npx again: turbo is a workspace devDependency, not on PATH before the install.
npx turbo docs#build
