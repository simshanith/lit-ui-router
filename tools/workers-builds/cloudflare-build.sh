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
# shim, and corepack could not materialize a pnpm-12 pin through rc.5. So the
# shim is replaced rather than bypassed. rc.6 restored the bin entry points
# corepack looks for, which may make this unnecessary — untested, and this path
# is verified, so it stays until something forces the question.
set -euo pipefail

# npm's global bin is the same node bin dir the corepack shims sit in, and npm
# refuses to overwrite a file it does not own (EEXIST), so clear them first
# rather than reaching for --force. Ask npm where it will write: asdf puts its
# own shims on PATH, so `command -v node` resolves to ~/.asdf/shims, not the
# installs/nodejs/<version>/bin the shims and the global install both land in.
npm_bin="$(npm prefix -g)/bin"
rm -f "$npm_bin/pnpm" "$npm_bin/pnpx"

# --allow-scripts is what makes this a pnpm 12 rather than the wrapper's
# placeholder bin: the real binary is unpacked by a preinstall hook, which npm
# 12 blocks by default. npm 11 ignores the unknown flag and runs the hook
# anyway, so one command covers both.
npm install --global --allow-scripts=pnpm pnpm@12.0.0

pnpm install --frozen-lockfile

# turbo is a workspace devDependency, not on PATH.
npx turbo docs#build
