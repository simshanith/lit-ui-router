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
#
# This branch's copy diverges from main's, which is what the indirection is
# for. npx covers only the commands named here; turbo spawns every package
# script through the `pnpm` on PATH, which in the build image is corepack's
# shim, and corepack cannot materialize a pnpm-12 pin. So the shim has to be
# replaced rather than bypassed.
set -euo pipefail

# npm's global bin is the same node bin dir the corepack shims sit in, and npm
# refuses to overwrite a file it does not own (EEXIST), so clear them first
# rather than reaching for --force.
node_bin="$(dirname "$(command -v node)")"
rm -f "$node_bin/pnpm" "$node_bin/pnpx"

# --allow-scripts is what makes this a pnpm 12 rather than the wrapper's
# placeholder bin: the real binary is unpacked by a preinstall hook, which npm
# 12 blocks by default. npm 11 ignores the unknown flag and runs the hook
# anyway, so one command covers both.
npm install --global --allow-scripts=pnpm pnpm@12.0.0-rc.5

pnpm install --frozen-lockfile

# turbo is a workspace devDependency, not on PATH.
npx turbo docs#build
