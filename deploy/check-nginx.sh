#!/usr/bin/env bash
# Serves a build through the pinned nginx image with this repository's config and checks what
# browsers would get: the right content type for every file the app loads, the security headers,
# client-side routes, and the www and unknown-host rules. Run by CI after the build, and by hand:
#
#   bash deploy/check-nginx.sh dist
set -euo pipefail

DIST="$(cd "${1:-dist}" && pwd)"
HERE="$(cd "$(dirname "$0")" && pwd)"
IMAGE="nginx:1.30.5-alpine"   # keep in step with the server's setup script
NAME="labtrails-nginx-check-$$"
PORT="${PORT:-18089}"
HOST="labtrails.app"
fail=0

conf="$(mktemp -d)"
cp "$HERE"/nginx/*.conf "$conf/"
docker run -d --name "$NAME" -p "127.0.0.1:$PORT:80" --read-only --tmpfs /var/cache/nginx --tmpfs /var/run --tmpfs /tmp \
  -v "$DIST:/srv/labtrails/current:ro" -v "$conf:/etc/nginx/conf.d:ro" "$IMAGE" >/dev/null
trap 'docker rm -f "$NAME" >/dev/null 2>&1; rm -rf "$conf"' EXIT
for _ in $(seq 1 20); do curl -s -o /dev/null "http://127.0.0.1:$PORT/" -H "Host: $HOST" && break; sleep 0.5; done

expect_type() { # path, expected content type prefix
  local got
  got="$(curl -s -o /dev/null -w '%{http_code} %{content_type}' -H "Host: $HOST" "http://127.0.0.1:$PORT$1")"
  if [[ "$got" != "200 $2"* ]]; then echo "FAIL $1: got '$got', expected '200 $2'"; fail=1; fi
}

# Every file in the build that a browser executes, styles, decodes or installs.
while IFS= read -r file; do
  path="/${file#"$DIST"/}"
  case "$file" in
    *.html) expect_type "$path" text/html ;;
    *.mjs) expect_type "$path" text/javascript ;;
    *.js) expect_type "$path" application/javascript ;;
    *.css) expect_type "$path" text/css ;;
    *.svg) expect_type "$path" image/svg+xml ;;
    *.png) expect_type "$path" image/png ;;
    *.woff2) expect_type "$path" font/woff2 ;;
    *.wasm) expect_type "$path" application/wasm ;;
    *.webmanifest) expect_type "$path" application/manifest+json ;;
    *.json) expect_type "$path" application/json ;;
    *.pdf) expect_type "$path" application/pdf ;;
  esac
done < <(find "$DIST" -type f ! -path '*/vendor/pdfjs/cmaps/*' ! -path '*/vendor/pdfjs/standard_fonts/*' ! -path '*/vendor/pdfjs/iccs/*')

for h in content-security-policy strict-transport-security referrer-policy permissions-policy x-content-type-options; do
  for path in / /p/x /manifest.webmanifest; do
    curl -sI -H "Host: $HOST" "http://127.0.0.1:$PORT$path" | grep -qi "^$h:" || { echo "FAIL $path: no $h header"; fail=1; }
  done
done
expect_type /p/some/route text/html
[[ "$(curl -s -o /dev/null -w '%{http_code} %{redirect_url}' -H "Host: www.$HOST" "http://127.0.0.1:$PORT/x?y=1")" == "301 https://$HOST/x?y=1" ]] \
  || { echo "FAIL www redirect"; fail=1; }
curl -s -o /dev/null -H "Host: evil.example" "http://127.0.0.1:$PORT/" && { echo "FAIL unknown host was answered"; fail=1; }

# Missing files must not be cacheable, or Cloudflare keeps the 404 after the file arrives.
for path in /assets/missing-abc123.js /assets/missing-abc123.mjs /vendor/missing.js; do
  headers="$(curl -sI -H "Host: $HOST" "http://127.0.0.1:$PORT$path")"
  grep -q "^HTTP/1.1 404" <<<"$headers" || { echo "FAIL $path: expected 404"; fail=1; }
  grep -qi "^cache-control: no-store" <<<"$headers" || { echo "FAIL $path: a 404 without Cache-Control: no-store"; fail=1; }
  grep -qi "^cache-control:.*max-age" <<<"$headers" && { echo "FAIL $path: a 404 with a max-age"; fail=1; }
  grep -qi "^content-security-policy:" <<<"$headers" || { echo "FAIL $path: a 404 without the security headers"; fail=1; }
done
# Real files keep their long cache lifetime.
asset="$(cd "$DIST" && ls assets/*.js | head -1)"
curl -sI -H "Host: $HOST" "http://127.0.0.1:$PORT/$asset" | grep -qi "^cache-control: public, max-age=31536000, immutable" \
  || { echo "FAIL /$asset: lost its long cache lifetime"; fail=1; }

if [[ $fail -eq 0 ]]; then echo "nginx check passed"; else echo "nginx check FAILED"; exit 1; fi
