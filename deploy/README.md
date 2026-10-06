# Deploying LabTrails

LabTrails is static files. The home server pulls each new build from GitHub and serves it; nothing
on the internet can connect to the server, and no workflow holds credentials for it. The same setup
serves BabyTrails, the sister app.

```
push to main ──► GitHub Actions: lint, typecheck, unit and browser tests, build
                 └─► release "site-<run>-<sha>" with site.tar.gz and its SHA-256
server timer, every 2 minutes ──► newest release? ──► verify checksum ──► unpack ──► swap "current"
nginx (trails-web) ──► Cloudflare Tunnel (outbound only) ──► https://labtrails.app
```

**Once this is live, a push to `main` is a production deploy.** Work on branches and merge to
`main` deliberately.

## What runs where

| Piece | File here | Installed as |
| --- | --- | --- |
| Deploy script, shared by the apps | `trails-deploy.sh` | `/usr/local/bin/trails-deploy.sh` |
| Timer and service, per app | `systemd/labtrails-deploy.{service,timer}` | `/etc/systemd/system/` |
| Site config | `nginx/labtrails.conf` | the `trails-web` container's `conf.d` |
| Security headers, included in every location | `nginx/labtrails-headers.conf` | the same `conf.d` |
| Catch-all for unknown host names, once per server | `nginx/00-default.conf` | the same `conf.d` |

- **`trails-static`** is a Compose project with one pinned nginx container, `trails-web`, that serves
  every Trails app, each from its own `server` block and its own folder (`/srv/labtrails/current`).
- Each app has its own **system user** (`labtrails-deploy`) that can write only its own folder,
  and its own timer.
- `trails-deploy.sh` is a copy of tbutman.com's deploy script, so a change there can't break the
  apps. It installs the newest release, keeps the last five, and has `rollback` (switch to the
  previous release and pin it) and `unpin`.
- The server-specific setup script (users, folders, the Compose project, the tunnel network) lives
  in the private infrastructure repository, not here.

## Headers and logs

- The **Content-Security-Policy** allows requests only to the app itself and
  `https://api.anthropic.com`. It's sent by nginx and also built into `index.html`
  (`vite.config.ts`); keep the two in step.
- **HSTS**, `Referrer-Policy: no-referrer`, `X-Content-Type-Options: nosniff`,
  `frame-ancestors 'none'` (and `X-Frame-Options: DENY`), `Cross-Origin-Opener-Policy`,
  `Cross-Origin-Resource-Policy`, and a **Permissions-Policy** that turns off the camera,
  microphone, location, payments, USB and other device features.
- **No access log.** The app has no server-side data, and there are no analytics. nginx errors go
  to the container log, capped at 3 × 10 MB.
- The service worker and manifest are served `no-cache`, so updates reach installed apps; hashed
  build files are cached for a year.

## Cloudflare settings for the domain

The tunnel routes `labtrails.app` and `www.labtrails.app` go to `http://trails-web:80` (main dashboard,
**Networking → Tunnels**). Always Use HTTPS is under **SSL/TLS → Edge Certificates**.

Turn **off** anything that injects scripts or rewrites pages: Web Analytics' automatic setup,
Rocket Loader, email address obfuscation, and similar. They would break the CSP and the privacy
promise. "Always Use HTTPS" on (`.app` domains are HTTPS-only in browsers anyway).

## Operations (on the server)

```bash
systemctl list-timers labtrails-deploy.timer
journalctl -u labtrails-deploy.service -n 20 --no-pager
readlink /srv/labtrails/current
sudo systemctl start labtrails-deploy.service          # check for a new release now
sudo -u labtrails-deploy env SITE_REPO=tbutman/labtrails SITE_ROOT=/srv/labtrails trails-deploy.sh rollback
sudo -u labtrails-deploy env SITE_REPO=tbutman/labtrails SITE_ROOT=/srv/labtrails trails-deploy.sh unpin
```

nginx config changes aren't part of a release: copy the changed files into the container's
`conf.d` (and the staged setup folder), then test and reload nginx in the `trails-static` project.

## Tested

On 6 October 2026, before anything on the server changed:

- `trails-deploy.sh` in an Ubuntu 24.04 container against this repository's real releases: first
  install (`site-6-8b9bd21`), a no-op re-run, rollback and pin, a timer run while pinned (no change),
  unpin and redeploy.
- The nginx config in `nginx:1.30.5-alpine` (the pinned image), serving a real build alongside
  BabyTrails' config, as `trails-web` will: `nginx -t` passes; `/` and client-side routes get
  `index.html`; scripts, the manifest (`application/manifest+json`), images and pdf.js's WebAssembly
  (`application/wasm`) get the right types; a missing asset gets 404; every response carries the
  security headers; hashed assets are cached for a year and the service worker is `no-cache`; `www`
  redirects to the bare domain with the path and query kept; unknown host names get no response;
  BabyTrails is still served by its own `server` block.

- `check-nginx.sh` runs in CI on every build (adapted from BabyTrails'): it serves the build through
  the pinned image and this config and checks the content type of every file the app loads, plus the
  security headers, routes and host rules. It was added after the first live deploy, when the PDF
  viewer's `.mjs` worker went out as `application/octet-stream` (nginx's default types don't include
  `.mjs`) and browsers refused to run it. The manual check above had sampled files and missed it.

`trails-deploy.sh` and `nginx/00-default.conf` are copied unchanged from BabyTrails' `deploy/` (commit
`e0eb370`), because the server installs one copy of each for both apps. Change them in BabyTrails and
copy them here.
