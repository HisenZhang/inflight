# Deployment Guide - IN-FLIGHT

## Overview

IN-FLIGHT is a static PWA with **no build step required**. The entire application runs directly from HTML/CSS/JS files without bundling or transpilation.

**Deployment Method:** Wrangler CLI via Cloudflare Pages
**Main App:** `inflight` project → Production site
**Documentation:** `inflight-docs` project → Docs site (separate)

---

## Quick Start

### Deploy Main App

```bash
# From repository root
npm run deploy
```

This deploys the entire application to Cloudflare Pages using Wrangler CLI.

### Deploy Documentation

```bash
# Build and deploy docs
npm run deploy:docs
```

This builds VitePress docs and deploys them to a separate Cloudflare Pages project.

---

## Initial Setup (One-Time)

### 1. Install Wrangler and Login

```bash
# Login to Cloudflare
npx wrangler login
```

This will open a browser for authentication.

### 2. Create Cloudflare Pages Projects

You need **two separate projects**:

#### Main App Project: `inflight`

```bash
# First deployment creates the project
npm run deploy

# Follow the prompts:
# - Project name: inflight
# - Production branch: main
```

#### Docs Project: `inflight-docs`

```bash
# First deployment creates the project
npm run deploy:docs

# Follow the prompts:
# - Project name: inflight-docs
# - Production branch: main
```

### 3. Configure Custom Domains (Optional)

In Cloudflare Dashboard → Pages → Your Project → Custom domains:

- **Main App:** `in-flight.org`, `www.in-flight.org`
- **Docs:** `docs.in-flight.org`

---

## Configuration Files

### `wrangler.toml` (Main App)

```toml
name = "inflight"
compatibility_date = "2025-11-01"

[assets]
directory = "."
```

- **Purpose:** Deploys entire repository root as static site
- **What gets deployed:** All files except those in `.cfignore`

### `wrangler-docs.toml` (Documentation)

```toml
name = "inflight-docs"
compatibility_date = "2025-11-01"

[assets]
directory = "docs/.vitepress/dist"
```

- **Purpose:** Deploys built VitePress docs
- **Build step:** Runs `npm run docs:build` first

### `.cfignore` (Exclusion Rules)

Prevents unnecessary files from being deployed:

```
node_modules/
tests/
docs/
*.md
wrangler.toml
data/local/
.git/
.github/
```

Only essential runtime files are deployed to production.

---

## Deployment Workflow

### Standard Deployment Process

#### 1. Update Version Numbers

```bash
vim version.js
```

Update:
- `MAJOR`, `MINOR`, `PATCH` (e.g., `2.2.0` → `2.3.0`)
- `CACHE_VERSION` (increment by 1, e.g., `56` → `57`)
- `BUILD_DATE` (today's date, e.g., `2025-11-20`)
- `RELEASE_NAME` (brief description)

Sync with:
```bash
vim package.json    # "version": "2.3.0"
vim manifest.json   # "version": "2.3.0"
```

#### 2. Run Tests

```bash
npm test
```

All tests must pass.

#### 3. Commit Changes

```bash
git add version.js package.json manifest.json
git commit -m "chore: bump version to v2.3.0"
git tag v2.3.0
git push origin main --tags
```

#### 4. Deploy

**Main App:**
```bash
npm run deploy
```

**Documentation (if docs changed):**
```bash
npm run deploy:docs
```

#### 5. Verify Deployment

1. Open production URL
2. Check browser console:
   ```
   [App] IN-FLIGHT v2.3.0 (Cache: v57, Build: 2025-11-20)
   ```
3. Test WELCOME tab → APP VERSION section
4. Test service worker update (close/reopen)
5. Test offline mode

---

## GitHub Actions Integration (Recommended)

For automatic deployments on every push to `main`, add a GitHub Actions workflow:

### `.github/workflows/deploy.yml`

```yaml
name: Deploy to Cloudflare Pages

on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

jobs:
  deploy-app:
    name: Deploy Main App
    runs-on: ubuntu-latest
    permissions:
      contents: read
      deployments: write
    steps:
      - uses: actions/checkout@v4

      - uses: actions/setup-node@v4
        with:
          node-version: '20'

      - name: Install dependencies
        run: npm ci

      - name: Run tests
        run: npm test

      - name: Deploy to Cloudflare Pages
        uses: cloudflare/wrangler-action@v3
        with:
          apiToken: ${{ secrets.CLOUDFLARE_API_TOKEN }}
          accountId: ${{ secrets.CLOUDFLARE_ACCOUNT_ID }}
          command: pages deploy . --project-name=inflight

  deploy-docs:
    name: Deploy Documentation
    runs-on: ubuntu-latest
    permissions:
      contents: read
      deployments: write
    steps:
      - uses: actions/checkout@v4

      - uses: actions/setup-node@v4
        with:
          node-version: '20'

      - name: Install dependencies
        run: npm ci

      - name: Build docs
        run: npm run docs:build

      - name: Deploy to Cloudflare Pages
        uses: cloudflare/wrangler-action@v3
        with:
          apiToken: ${{ secrets.CLOUDFLARE_API_TOKEN }}
          accountId: ${{ secrets.CLOUDFLARE_ACCOUNT_ID }}
          command: pages deploy docs/.vitepress/dist --project-name=inflight-docs
```

### Required Secrets

Add these to GitHub Settings → Secrets and variables → Actions:

- `CLOUDFLARE_API_TOKEN`: Get from Cloudflare Dashboard → My Profile → API Tokens → Create Token
  - Template: "Edit Cloudflare Workers"
  - Permissions: `Account.Cloudflare Pages:Edit`

- `CLOUDFLARE_ACCOUNT_ID`: Get from Cloudflare Dashboard → Workers & Pages → Overview (right sidebar)

---

## Manual Deployment Commands

### Deploy Specific Branch

```bash
# Deploy feature branch to preview
npx wrangler pages deploy . --project-name=inflight --branch=feature/new-feature
```

### Deploy with Custom Commit Message

```bash
# Wrangler automatically uses git commit info
git commit -m "feat: add new navigation mode"
npm run deploy
```

### Force Redeploy

```bash
# If deployment seems stuck
npx wrangler pages deploy . --project-name=inflight --force
```

---

## Rollback Procedure

### Via Cloudflare Dashboard

1. Go to: Cloudflare Dashboard → Pages → `inflight` → Deployments
2. Find previous working deployment
3. Click "⋯" → "Rollback to this deployment"

### Via Git + Redeploy

```bash
# Revert to previous version
git revert HEAD
git push origin main

# Then redeploy
npm run deploy
```

### Via Git Tag

```bash
# Checkout previous version
git checkout v2.2.0

# Deploy that version
npm run deploy

# Return to main
git checkout main
```

---

## Environment-Specific Deployments

### Production

```bash
npm run deploy
```

- URL: `https://in-flight.org` (or `https://inflight.pages.dev`)
- Branch: `main`
- Automatic: Via GitHub Actions (if configured)

### Preview/Staging

```bash
# Deploy specific branch
git checkout feature/new-feature
npx wrangler pages deploy . --project-name=inflight --branch=staging
```

- URL: `https://staging.inflight.pages.dev`
- Useful for testing before merging to `main`

### Local Testing

```bash
npm start
# Or just: open index.html
```

- URL: `file:///path/to/index.html`
- No deployment needed
- Service worker may have limitations

---

## Monitoring

### Check Deployment Status

```bash
# List recent deployments
npx wrangler pages deployments list --project-name=inflight
```

### View Deployment Logs

```bash
# Tail logs (if available)
npx wrangler pages deployments tail --project-name=inflight
```

### Cloudflare Dashboard

1. Go to: Pages → `inflight` → Deployments
2. View:
   - Deployment history
   - Build logs
   - Production/preview URLs
   - Analytics (page views, bandwidth, etc.)

---

## Troubleshooting

### Issue: "Missing entry-point to Worker script"

**Cause:** Wrangler can't find the assets directory.

**Fix:**
```bash
# Verify wrangler.toml has correct config
cat wrangler.toml

# Should show:
# [assets]
# directory = "."
```

### Issue: "Authentication required"

**Cause:** Not logged in to Cloudflare.

**Fix:**
```bash
npx wrangler login
```

### Issue: "Project not found"

**Cause:** Project doesn't exist yet.

**Fix:**
```bash
# First deployment creates the project
npm run deploy
# Follow prompts to create new project
```

### Issue: "Service worker not updating"

**Cause:** `CACHE_VERSION` not incremented.

**Fix:**
1. Edit [version.js](version.js:4)
2. Increment `CACHE_VERSION` (e.g., `56` → `57`)
3. Redeploy: `npm run deploy`
4. Hard refresh browser (Cmd+Shift+R)

### Issue: "Deployment successful but site not updating"

**Cause:** Browser caching or CDN propagation delay.

**Fix:**
1. Wait 1-2 minutes for CDN propagation
2. Hard refresh browser (Cmd+Shift+R)
3. Check browser console for new version number
4. Clear browser cache if needed

### Issue: "Data files not loading"

**Cause:** Data files are gitignored and loaded from external URLs at runtime.

**Fix:**
- IN-FLIGHT loads aviation data from `https://nasr.hisenz.com/` at runtime
- Check browser console for network errors
- Verify URLs in [data/data-manager.js](data/data-manager.js) are accessible

---

## Performance & Optimization

### What Cloudflare Provides Automatically

✅ Global CDN distribution (200+ cities)
✅ HTTP/2 and HTTP/3
✅ Brotli compression
✅ Auto-minify HTML/CSS/JS
✅ SSL/TLS certificates
✅ DDoS protection

### What IN-FLIGHT Already Has

✅ Zero build step (instant deploys)
✅ Service worker caching (offline support)
✅ IndexedDB for large datasets
✅ Lazy-loading of data sources
✅ No runtime dependencies (0 npm packages)

### Measuring Performance

```javascript
// Browser console
window.AppVersion.getVersionInfo()

// Check cache status
caches.keys().then(console.log)

// Check IndexedDB size
indexedDB.databases().then(console.log)
```

---

## Security

### HTTPS

✅ Automatic SSL via Cloudflare
✅ HSTS enabled
✅ TLS 1.3 supported

### Content Security Policy (Optional)

Create `_headers` file in repository root:

```
/*
  Content-Security-Policy: default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; connect-src 'self' https://nasr.hisenz.com https://aviationweather.gov; img-src 'self' data:; font-src 'self'; frame-src 'none'
  X-Frame-Options: DENY
  X-Content-Type-Options: nosniff
  Referrer-Policy: strict-origin-when-cross-origin
```

Then redeploy.

### Data Privacy

✅ No tracking scripts
✅ No third-party analytics
✅ All user data stored locally (IndexedDB/LocalStorage)
✅ Offline-first design
✅ No server-side processing

---

## Deployment Checklist

Use this checklist before every deployment:

```
Pre-Deployment:
☐ Updated version.js (MAJOR.MINOR.PATCH, CACHE_VERSION, BUILD_DATE)
☐ Synced package.json version
☐ Synced manifest.json version
☐ All tests passing (npm test)
☐ Tested locally (npm start)
☐ Service worker updates correctly
☐ Offline mode works
☐ Committed changes with version tag

Deployment:
☐ Pushed to main branch
☐ Ran: npm run deploy
☐ Deployment succeeded (check logs)
☐ Verified production URL loads
☐ Version number correct in WELCOME tab
☐ Browser console shows new version
☐ No errors in console

Post-Deployment:
☐ Tested core features (route planning, map, GPS)
☐ Verified service worker update prompt
☐ Tested on mobile device
☐ Notified users if breaking changes
```

---

## Resources

- **Cloudflare Pages Docs:** https://developers.cloudflare.com/pages/
- **Wrangler CLI Docs:** https://developers.cloudflare.com/workers/wrangler/
- **Wrangler Pages Commands:** https://developers.cloudflare.com/workers/wrangler/commands/#pages
- **IN-FLIGHT Docs:** https://docs.in-flight.org (or local `docs/`)

---

## Quick Reference

```bash
# Deploy main app
npm run deploy

# Deploy docs
npm run deploy:docs

# Login to Cloudflare
npx wrangler login

# List deployments
npx wrangler pages deployments list --project-name=inflight

# Deploy specific branch
npx wrangler pages deploy . --project-name=inflight --branch=feature-name

# View project info
npx wrangler pages project list
```

---

*Last Updated: 2025-11-20*
*IN-FLIGHT v2.2.0*
