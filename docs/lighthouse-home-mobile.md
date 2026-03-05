# Lighthouse Home Mobile Gate

## Goal

Reach median `100/100/100/100` on the home page mobile profile using 3 local runs, with `robots-txt` excluded from the SEO gate.

## Run locally

1. Build and start preview:
   ```bash
   npm run build
   npm run preview -- --host 127.0.0.1 --port 4173
   ```
2. In another terminal, run:
   ```bash
   npm run lighthouse:home:mobile
   ```
3. Read artifacts:
   - `.lighthouse/home-mobile-run-1.json`
   - `.lighthouse/home-mobile-run-2.json`
   - `.lighthouse/home-mobile-run-3.json`
   - `.lighthouse/home-mobile-summary.json`

### Windows note

- Some environments print `EPERM` from ChromeLauncher while deleting temp folders.
- The runner now keeps the execution valid when the JSON report file was produced.

## SEO robots.txt note

- The gate skips `robots-txt` on purpose (`skipAudits: ["robots-txt"]`).
- Public PSI/Lighthouse can still show SEO below 100 while Cloudflare injects `Content-Signal`.

## Cloudflare operational steps

1. Disable **Cloudflare Web Analytics** on the target zone to remove:
   - `https://static.cloudflareinsights.com/beacon.min.js`
   - `/cdn-cgi/rum`
2. Keep `Content-Signal` active if required by policy.
3. Purge cache after deploy, especially for home HTML and hero variants.

## Hero AVIF rollout step

After deploying quality preset changes:

```bash
npm run uploads:backfill-variants-avif-only
```

- Requires `DATABASE_URL`.
- Purge CDN cache for `/uploads/_variants/*hero*.avif`.

## Fallback shell

```bash
HOME_HERO_SHELL_ENABLED=true
```

The static hero shell is enabled by default in the server for `/` to protect LCP.

- Set `HOME_HERO_SHELL_ENABLED=false` to disable it.
- The shell renders outside `#root` and is removed on `nekomata:hero-ready` or timeout.
