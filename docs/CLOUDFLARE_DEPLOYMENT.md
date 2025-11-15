# Cloudflare Pages Deployment Guide

Complete guide to deploying InFlight documentation on Cloudflare Pages.

## Quick Setup (5 Minutes)

### Step 1: Sign In to Cloudflare

1. Go to https://pages.cloudflare.com
2. Sign in with your Cloudflare account (or create one - it's free)
3. Click **"Create a project"**

### Step 2: Connect GitHub Repository

1. Click **"Connect to Git"**
2. Authorize Cloudflare Pages to access your GitHub account
3. Select the repository: **`HisenZhang/inflight`**
4. Click **"Begin setup"**

### Step 3: Configure Build Settings

**Project name:**
```
inflight-docs
```
(or any name you prefer - this will be in your URL)

**Production branch:**
```
main
```

**Build settings:**

| Setting | Value |
|---------|-------|
| **Framework preset** | None |
| **Build command** | (leave empty) |
| **Build output directory** | `docs` |
| **Root directory** | (leave empty) |

**Environment variables:**
- None needed

### Step 4: Deploy

1. Click **"Save and Deploy"**
2. Wait 30-60 seconds for deployment
3. Done! ✅

## Your Live URL

After deployment, your documentation will be available at:

```
https://inflight-docs.pages.dev
```

(Replace `inflight-docs` with whatever project name you chose)

## Custom Domain Setup (Optional)

### Add Custom Domain

If you want `docs.yourdomain.com`:

1. In Cloudflare Pages dashboard, go to your project
2. Click **"Custom domains"** tab
3. Click **"Set up a custom domain"**
4. Enter: `docs.yourdomain.com`

### Configure DNS

If your domain is already on Cloudflare:
1. Cloudflare will automatically add the DNS record
2. SSL certificate will be issued automatically
3. Done! Wait 1-2 minutes for propagation

If your domain is elsewhere:
1. Add CNAME record in your DNS provider:
   - **Name**: `docs`
   - **Value**: `inflight-docs.pages.dev`
   - **TTL**: Auto or 300
2. Back in Cloudflare, verify the domain
3. SSL certificate issued automatically

## Automatic Deployments

Cloudflare Pages automatically deploys when you push to GitHub:

**Production deployments:**
- Trigger: Push to `main` branch
- URL: `https://inflight-docs.pages.dev`

**Preview deployments:**
- Trigger: Push to any other branch (like PRs)
- URL: `https://[commit-hash].inflight-docs.pages.dev`

Each PR gets a unique preview URL for testing!

## Configuration Files

Your repository includes Cloudflare-specific config:

### `docs/_headers`
Controls caching and security headers:
- Static assets cached for 1 year
- HTML not cached (for instant updates)
- Security headers (X-Frame-Options, etc.)

### `docs/_redirects`
Handles URL routing:
- SPA fallback for Docsify
- Proper routing for /user-guide/ paths

### `.nojekyll`
Prevents GitHub Pages from processing (not needed for Cloudflare, but harmless)

## Performance Features

Cloudflare Pages includes:

✅ **Global CDN** - 200+ data centers worldwide
✅ **HTTP/3** - Latest protocol for faster loading
✅ **Brotli Compression** - Smaller file sizes
✅ **Smart Routing** - Optimized delivery paths
✅ **DDoS Protection** - Built-in security
✅ **Free SSL** - Automatic HTTPS
✅ **Unlimited Bandwidth** - No traffic limits
✅ **Unlimited Requests** - No rate limits

## Analytics

View your documentation traffic:

1. Go to Cloudflare Pages dashboard
2. Select your project
3. Click **"Analytics"** tab
4. See page views, visitors, bandwidth, etc.

**Web Analytics (Optional):**
- Enable Cloudflare Web Analytics for detailed insights
- Privacy-friendly (no cookies)
- Real-time data

## Build Logs & Debugging

### View Build Logs

1. Cloudflare Pages dashboard → Your project
2. Click on a deployment
3. View logs in "Build log" section

### Common Issues

**Build fails:**
- Check build output directory is `docs`
- Ensure build command is empty (no build needed)
- Verify repository has /docs folder

**404 errors:**
- Check `_redirects` file exists in /docs
- Verify SPA fallback is configured
- Wait 1-2 minutes for deployment to complete

**Slow loading:**
- Check browser console for errors
- Verify CDN links in index.html are accessible
- Clear browser cache

## Local Testing

Test locally before deploying:

```bash
# Install wrangler CLI
npm install -g wrangler

# Navigate to docs
cd docs

# Start local server
npx wrangler pages dev . --port 3000

# Open http://localhost:3000
```

Or use Docsify:

```bash
# Install docsify-cli
npm install -g docsify-cli

# Serve docs
cd docs
docsify serve

# Open http://localhost:3000
```

## Branch Previews

Every branch and PR gets a preview URL:

**Example:**
- Branch: `feature/new-docs`
- PR #42: Adding new documentation
- Preview URL: `https://abc123ef.inflight-docs.pages.dev`

**Access preview URLs:**
1. Go to PR on GitHub
2. Cloudflare bot posts preview URL in comments
3. Click link to view preview

**Use cases:**
- Review documentation changes before merging
- Share updates with team
- Test new features

## Rollbacks

Need to rollback to a previous version?

1. Cloudflare Pages dashboard → Your project
2. Click **"View build history"**
3. Find the deployment you want to restore
4. Click **"Rollback to this deployment"**
5. Confirm

Previous version is now live!

## Environment Setup

For different environments:

**Production:**
- Branch: `main`
- URL: `https://inflight-docs.pages.dev`
- Auto-deploys on merge

**Staging (Optional):**
- Branch: `staging`
- URL: `https://staging.inflight-docs.pages.dev`
- Manual or automatic deploys

Configure in Cloudflare Pages → Settings → Builds & deployments

## Access Control (Optional)

Restrict access to documentation:

1. Cloudflare Pages → Your project → Settings
2. Click **"Access"**
3. Enable Cloudflare Access
4. Configure allowed emails/domains
5. Save

**Use cases:**
- Private beta documentation
- Internal documentation
- Staging environment protection

**Note:** Free tier has limits; check pricing for Access.

## Comparison: Cloudflare vs. Alternatives

| Feature | Cloudflare Pages | Netlify | Vercel | GitHub Pages |
|---------|------------------|---------|--------|--------------|
| **Free Tier** | Unlimited | 100GB/mo | 100GB/mo | Unlimited |
| **Build Minutes** | 500/mo | 300/mo | 6000/mo | N/A |
| **Custom Domain** | ✅ Free | ✅ Free | ✅ Free | ✅ Free |
| **SSL** | ✅ Auto | ✅ Auto | ✅ Auto | ✅ Auto |
| **CDN** | 200+ locations | 100+ | 100+ | GitHub CDN |
| **DDoS Protection** | ✅ Included | Add-on | Add-on | Basic |
| **Analytics** | ✅ Built-in | Add-on | Add-on | Via GA |
| **Branch Previews** | ✅ Unlimited | ✅ Limited | ✅ Limited | ❌ |

## Support

- **Documentation**: https://developers.cloudflare.com/pages/
- **Community**: https://community.cloudflare.com/
- **Status**: https://www.cloudflarestatus.com/
- **Discord**: Cloudflare Developers Discord

## Troubleshooting

### Deployment Stuck

**Problem:** Build stuck on "Initializing"

**Solution:**
1. Wait 5 minutes (can be slow on first deploy)
2. Cancel and retry deployment
3. Check Cloudflare status page
4. Contact support if persists

### Custom Domain Not Working

**Problem:** Custom domain shows error

**Solution:**
1. Verify DNS records are correct
2. Wait up to 24 hours for DNS propagation
3. Check domain is active (not expired)
4. Ensure no conflicting CNAME/A records

### Files Not Updating

**Problem:** Changes don't appear after deployment

**Solution:**
1. Clear browser cache (Ctrl+Shift+R)
2. Check deployment completed successfully
3. Verify correct branch was deployed
4. Try incognito/private window

### 404 on Refresh

**Problem:** Page loads but refresh gives 404

**Solution:**
1. Ensure `_redirects` file exists in /docs
2. Verify SPA fallback rule is present
3. Check build output directory is correct
4. Redeploy project

---

## Next Steps

1. ✅ Deploy to Cloudflare Pages
2. 🔧 (Optional) Set up custom domain
3. 📊 (Optional) Enable analytics
4. 🚀 Start using your live documentation!

**Your documentation will be live at:**
```
https://inflight-docs.pages.dev
```

Enjoy blazing-fast, globally distributed documentation! 🚀
