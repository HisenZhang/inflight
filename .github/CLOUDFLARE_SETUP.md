# Cloudflare Pages Setup Guide

This guide will help you set up automated deployments to Cloudflare Pages via GitHub Actions.

## Prerequisites

- Cloudflare account (free tier is fine)
- GitHub repository with admin access
- Wrangler CLI (installed automatically via `npx`)

---

## Step 1: Get Cloudflare Credentials

### 1.1 Get Account ID

1. Log in to [Cloudflare Dashboard](https://dash.cloudflare.com/)
2. Go to: **Workers & Pages** → **Overview**
3. Look for **Account ID** on the right sidebar
4. Copy the value (looks like: `a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6`)

### 1.2 Create API Token

1. Go to: **My Profile** → **API Tokens** → [Create Token](https://dash.cloudflare.com/profile/api-tokens)
2. Click **Create Custom Token**
3. Configure token:
   - **Token name:** `GitHub Actions - IN-FLIGHT`
   - **Permissions:**
     - Account → Cloudflare Pages → Edit
   - **Account Resources:**
     - Include → Your Account
   - **Zone Resources:** Not needed
   - **Client IP Address Filtering:** (optional, leave blank for all IPs)
   - **TTL:** (optional, leave blank for no expiration)
4. Click **Continue to summary**
5. Click **Create Token**
6. **IMPORTANT:** Copy the token immediately (you won't see it again!)
   - Format: `xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx`

---

## Step 2: Add Secrets to GitHub

### 2.1 Navigate to Repository Settings

1. Go to your GitHub repository: `https://github.com/HisenZhang/inflight`
2. Click **Settings** (top menu)
3. In left sidebar: **Secrets and variables** → **Actions**

### 2.2 Add CLOUDFLARE_API_TOKEN

1. Click **New repository secret**
2. Name: `CLOUDFLARE_API_TOKEN`
3. Secret: (paste the API token from Step 1.2)
4. Click **Add secret**

### 2.3 Add CLOUDFLARE_ACCOUNT_ID

1. Click **New repository secret**
2. Name: `CLOUDFLARE_ACCOUNT_ID`
3. Secret: (paste the Account ID from Step 1.1)
4. Click **Add secret**

---

## Step 3: Verify Setup

### 3.1 Check Secrets

You should now see two secrets:
- ✅ `CLOUDFLARE_API_TOKEN`
- ✅ `CLOUDFLARE_ACCOUNT_ID`

### 3.2 Trigger Deployment

Push a commit to `main` branch:

```bash
git add .
git commit -m "chore: setup Cloudflare Pages deployment"
git push origin main
```

### 3.3 Monitor Deployment

1. Go to **Actions** tab in GitHub
2. You should see workflow: **Deploy to Cloudflare Pages**
3. Click on the workflow run to see logs
4. Wait for both jobs to complete:
   - ✅ Deploy Main App
   - ✅ Deploy Documentation

---

## Step 4: Configure Projects in Cloudflare

After the first deployment, configure your projects in Cloudflare Dashboard.

### 4.1 Main App Project (`inflight`)

1. Go to: **Workers & Pages** → **inflight**
2. **Settings** → **Builds & deployments**
   - Build command: (leave empty)
   - Build output directory: `/`
   - Root directory: (default)

3. **Custom domains** (optional)
   - Add domain: `in-flight.org`
   - Add domain: `www.in-flight.org`

### 4.2 Docs Project (`inflight-docs`)

1. Go to: **Workers & Pages** → **inflight-docs**
2. **Settings** → **Builds & deployments**
   - Build command: (leave empty, GitHub Actions handles build)
   - Build output directory: `/`
   - Root directory: (default)

3. **Custom domains** (optional)
   - Add domain: `docs.in-flight.org`

---

## Step 5: Test Deployment

### 5.1 Check Deployment URLs

After successful deployment, you'll get URLs:

**Main App:**
- Production: `https://inflight.pages.dev`
- Custom domain: `https://in-flight.org` (if configured)

**Documentation:**
- Production: `https://inflight-docs.pages.dev`
- Custom domain: `https://docs.in-flight.org` (if configured)

### 5.2 Verify App Version

1. Open production URL
2. Press F12 (DevTools) → Console
3. Look for:
   ```
   [App] IN-FLIGHT v2.2.0 (Cache: v56, Build: 2025-11-20)
   ```
4. Or go to WELCOME tab → APP VERSION section

### 5.3 Test Features

- ✅ Route planning works
- ✅ Map displays correctly
- ✅ Offline mode works (DevTools → Network → Offline)
- ✅ Service worker registered

---

## Troubleshooting

### Issue: "Error: Authentication error"

**Cause:** Invalid API token or account ID.

**Fix:**
1. Regenerate API token in Cloudflare
2. Update `CLOUDFLARE_API_TOKEN` secret in GitHub
3. Re-run workflow

### Issue: "Error: Project not found"

**Cause:** Project doesn't exist in Cloudflare yet.

**Fix:**
1. Run manual deployment first:
   ```bash
   npx wrangler login
   npm run deploy
   npm run deploy:docs
   ```
2. Then GitHub Actions will work automatically

### Issue: "Error: Insufficient permissions"

**Cause:** API token doesn't have correct permissions.

**Fix:**
1. Go to Cloudflare → My Profile → API Tokens
2. Edit the token
3. Ensure: Account → Cloudflare Pages → Edit
4. Save and update GitHub secret

### Issue: Deployment succeeds but site shows old version

**Cause:** Browser cache or CDN propagation delay.

**Fix:**
1. Wait 1-2 minutes
2. Hard refresh: Cmd+Shift+R (Mac) or Ctrl+Shift+R (Windows/Linux)
3. Check DevTools console for version number

---

## Manual Deployment (Alternative)

If you prefer manual deployments without GitHub Actions:

### Login to Cloudflare

```bash
npx wrangler login
```

### Deploy Main App

```bash
npm run deploy
```

### Deploy Docs

```bash
npm run deploy:docs
```

---

## Workflow Files

The automated deployment is configured in:

- [`.github/workflows/deploy.yml`](workflows/deploy.yml) - Main deployment workflow
- [`wrangler.toml`](../../wrangler.toml) - Main app config
- [`wrangler-docs.toml`](../../wrangler-docs.toml) - Docs config
- [`.cfignore`](../../.cfignore) - Files to exclude from deployment

---

## Security Notes

### API Token Best Practices

- ✅ Use token with minimal required permissions
- ✅ Store token only in GitHub Secrets (never commit to git)
- ✅ Rotate token periodically (every 6-12 months)
- ✅ Revoke unused tokens immediately
- ❌ Never share token publicly
- ❌ Never commit `.env` files with tokens

### Monitoring

Monitor API token usage:
1. Go to: Cloudflare → My Profile → API Tokens
2. Check **Last used** timestamp
3. Review **IP Address** if you enabled filtering

---

## Additional Resources

- [Cloudflare Pages Docs](https://developers.cloudflare.com/pages/)
- [Wrangler CLI Docs](https://developers.cloudflare.com/workers/wrangler/)
- [GitHub Actions Docs](https://docs.github.com/en/actions)
- [Cloudflare Wrangler Action](https://github.com/cloudflare/wrangler-action)

---

*Last Updated: 2025-11-20*
