# Lighthouse Dashboard Desktop Gate

## Goal

Reach median `100` in Lighthouse `performance` for `/dashboard` on desktop using 3 local runs, with strict metric thresholds for `FCP`, `LCP`, `TBT`, and `CLS`.

## Run locally

1. Start the app with an authenticated session available in the browser.
2. Export a dashboard session cookie:
   ```bash
   export LIGHTHOUSE_DASHBOARD_COOKIE="connect.sid=..."
   ```
   On Windows PowerShell:
   ```powershell
   $env:LIGHTHOUSE_DASHBOARD_COOKIE="connect.sid=..."
   ```
3. Run:
   ```bash
   npm run lighthouse:dashboard:desktop
   ```
4. Read artifacts:
   - `.lighthouse/dashboard-desktop-run-1.json`
   - `.lighthouse/dashboard-desktop-run-2.json`
   - `.lighthouse/dashboard-desktop-run-3.json`
   - `.lighthouse/dashboard-desktop-summary.json`

## Optional flags

- Override the target URL:
  ```bash
  node scripts/lighthouse-dashboard-desktop.mjs --url=http://127.0.0.1:4173/dashboard
  ```
- Pass the cookie inline instead of env:
  ```bash
  node scripts/lighthouse-dashboard-desktop.mjs --cookie="connect.sid=..." --runs=3 --strict
  ```

## Strict gate

The strict mode blocks when the median result is outside any of these limits:

- `performance = 1.00`
- `FCP <= 1800 ms`
- `LCP <= 2500 ms`
- `TBT <= 50 ms`
- `CLS <= 0.02`
