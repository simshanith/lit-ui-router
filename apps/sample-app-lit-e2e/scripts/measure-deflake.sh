#!/usr/bin/env bash
# How often the wrangler-dev e2e crash (workers-sdk#4561 class) fires in CI:
# scans build-test runs — every attempt, since organic crashes get rerun —
# and reports crashes per e2e execution. Cache-hit replays re-print old logs
# verbatim, so only "cache miss/bypass" executions count as exposures.
# Usage: measure-deflake.sh [days=7]
set -euo pipefail

days="${1:-7}"
repo="simshanith/lit-ui-router"
since=$(date -u -v "-${days}d" +%Y-%m-%dT%H:%M:%SZ 2>/dev/null ||
  date -u -d "-${days} days" +%Y-%m-%dT%H:%M:%SZ)

log=$(mktemp)
trap 'rm -f "$log"' EXIT

executed=0
fired=0
while IFS= read -r id; do
  attempts=$(gh api "repos/${repo}/actions/runs/${id}" --jq '.run_attempt')
  for ((a = 1; a <= attempts; a++)); do
    gh run view --repo "$repo" "$id" --attempt "$a" --log > "$log" 2>/dev/null || continue
    grep -Eq "sample-app-lit-e2e:test: cache (miss|bypass)" "$log" || continue
    executed=$((executed + 1))
    hits=""
    # pre-deflake signature: the crash strands remaining specs on ECONNREFUSED
    if grep -q "ECONNREFUSED 127.0.0.1:8787" "$log"; then hits="crash"; fi
    # post-deflake signatures: pm2 respawned wrangler / failed suites rerun
    if [ "$(grep -c "App \[wrangler-dev:0\] online" "$log")" -gt 1 ]; then hits="${hits:+${hits}+}respawn"; fi
    if grep -q "\[e2e\] retrying" "$log"; then hits="${hits:+${hits}+}retry"; fi
    if [ -n "$hits" ]; then fired=$((fired + 1)); fi
    printf '%s attempt %s: %s\n' "$id" "$a" "${hits:-clean}"
  done
done < <(gh run list --repo "$repo" --workflow build-test.yml \
  --limit 300 --created ">=${since}" --json databaseId --jq '.[].databaseId')

echo "---"
if [ "$executed" -eq 0 ]; then
  echo "no e2e executions found since ${since}"
else
  printf 'since %s: e2e executed %d times, crash fired %d times (%s%%)\n' \
    "$since" "$executed" "$fired" "$(awk -v f="$fired" -v e="$executed" 'BEGIN { printf "%.0f", 100 * f / e }')"
fi
