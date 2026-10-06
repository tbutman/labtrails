#!/usr/bin/env bash
# Installs the newest GitHub release of the site, if it is not already live.
# Runs on the home server from a systemd timer, as an unprivileged per-app user (for example
# `babytrails-deploy`). Copied from tbutman-site's deploy-site.sh so the apps don't depend on it;
# SITE_REPO and SITE_ROOT are required here instead of defaulting to the website.
#
#   $SITE_ROOT/releases/<tag>/   unpacked releases (the newest few are kept)
#   $SITE_ROOT/current           symlink to the live release
#   $SITE_ROOT/pinned            present after a rollback; blocks automatic deploys
#
# Usage:
#   trails-deploy.sh             install the newest release (what the timer runs)
#   trails-deploy.sh rollback    switch to the previous release and pin it
#   trails-deploy.sh unpin       resume automatic deploys
set -euo pipefail

REPO="${SITE_REPO:?set SITE_REPO, e.g. tbutman/babytrails}"
ROOT="${SITE_ROOT:?set SITE_ROOT, e.g. /srv/babytrails}"
KEEP="${SITE_KEEP:-5}"
RELEASES="$ROOT/releases"
CURRENT="$ROOT/current"
PINNED="$ROOT/pinned"

log() { echo "trails-deploy ($REPO): $*"; }

live_tag() { if [[ -L "$CURRENT" ]]; then basename "$(readlink "$CURRENT")"; fi; }

activate() {
  # Create the new symlink beside the old one, then rename over it: a single atomic step.
  ln -sfn "releases/$1" "$ROOT/.current.tmp"
  mv -T "$ROOT/.current.tmp" "$CURRENT"
  log "live release is now $1"
}

case "${1:-}" in
  rollback)
    live="$(live_tag)"
    previous="$(ls -1t "$RELEASES" | grep -vx -- "$live" | head -n1 || true)"
    [[ -n "$previous" ]] || { log "no earlier release to roll back to"; exit 1; }
    activate "$previous"
    echo "$previous" > "$PINNED"
    log "pinned to $previous; run 'trails-deploy.sh unpin' to resume automatic deploys"
    exit 0
    ;;
  unpin)
    rm -f "$PINNED"
    log "automatic deploys resumed"
    exit 0
    ;;
  "") ;;
  *) echo "usage: $0 [rollback|unpin]" >&2; exit 2 ;;
esac

if [[ -f "$PINNED" ]]; then
  exit 0
fi

mkdir -p "$RELEASES"
work="$(mktemp -d)"
trap 'rm -rf "$work"' EXIT

# The newest release's tag, from where github.com's "latest release" page redirects. That's the
# website, not the REST API: unauthenticated API calls are limited to 60 an hour per address, which
# several apps' timers on one server exceed (and a 304 still counts without a token).
rm -f "$ROOT/.latest-etag" # left by earlier versions, which used the API
location="$(curl -sS --max-time 20 -o /dev/null -w '%{redirect_url}' "https://github.com/$REPO/releases/latest")" \
  || { log "couldn't reach GitHub"; exit 1; }
tag="${location##*/releases/tag/}"
[[ "$location" == "https://github.com/$REPO/releases/tag/"* && "$tag" =~ ^site-[0-9]+-[0-9a-f]{7}$ ]] \
  || { log "unexpected answer from GitHub: ${location:-no redirect}"; exit 1; }

if [[ "$(live_tag)" != "$tag" ]]; then
  base="https://github.com/$REPO/releases/download/$tag"
  curl -fsSL --max-time 120 -o "$work/site.tar.gz" "$base/site.tar.gz"
  curl -fsSL --max-time 20 -o "$work/site.tar.gz.sha256" "$base/site.tar.gz.sha256"
  (cd "$work" && sha256sum --check --quiet site.tar.gz.sha256)

  target="$RELEASES/$tag"
  rm -rf "$target.partial"
  mkdir -p "$target.partial"
  tar -xzf "$work/site.tar.gz" -C "$target.partial" --no-same-owner
  [[ -f "$target.partial/index.html" ]] || { log "release $tag has no index.html"; exit 1; }
  chmod -R a+rX "$target.partial"
  rm -rf "$target"
  mv "$target.partial" "$target"
  activate "$tag"

  # Prune old releases, never touching the live one.
  ls -1t "$RELEASES" | { grep -vx -- "$tag" || true; } | tail -n +"$KEEP" | while read -r old; do
    rm -rf "${RELEASES:?}/$old"
  done
fi
