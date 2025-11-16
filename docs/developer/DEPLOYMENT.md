# Deploying InFlight Documentation to Cloudflare Pages

This guide walks you through deploying the InFlight documentation to Cloudflare Pages.

## Quick Start (5 Minutes)

### Prerequisites
- GitHub account with access to this repository
- Cloudflare account (free tier works perfectly)

### Deployment Steps

1. **Go to Cloudflare Pages**
   - Visit: https://pages.cloudflare.com
   - Sign in or create a free account

2. **Create New Project**
   - Click **"Create a project"**
   - Click **"Connect to Git"**
   - Authorize Cloudflare to access GitHub
   - Select repository: `HisenZhang/inflight`

3. **Configure Build Settings**
   ```
   Project name: inflight-docs
   Production branch: main
   Framework preset: VitePress
   Build command: npm run docs:build
   Build output directory: docs/.vitepress/dist
   Root directory: (leave empty)
   Node version: 18 or higher
   ```

4. **Deploy**
   - Click **"Save and Deploy"**
   - Wait ~30 seconds for deployment
   - Done! ✅

Your documentation will be live at: `https://inflight-docs.pages.dev`

## What's Included

This repository is configured for Cloudflare Pages deployment with:

### Documentation Framework: VitePress
- ✅ Fast build with Vite
- ✅ Server-side generation (SSG) for better SEO
- ✅ Built-in search functionality
- ✅ Responsive design
- ✅ Syntax highlighting
- ✅ Table of contents in each page
- ✅ Modern, polished UI

### Documentation Structure
```
docs/
├── index.html              # Docsify configuration
├── README.md               # Documentation home
├── _sidebar.md             # Navigation menu
├── _headers                # Cloudflare caching rules
├── _redirects              # URL routing
│
├── user-guide/            # User documentation
│   ├── quick-start.md
│   ├── tab-*.md          # Feature guides
│   ├── faq.md
│   └── troubleshooting.md
│
└── developer/             # Developer documentation
    ├── ARCHITECTURE.md
    ├── SETUP.md
    ├── TESTING.md
    ├── CLOUDFLARE_DEPLOYMENT.md
    └── reference/        # Additional references
```

### Cloudflare Configuration Files

**`docs/_headers`**
- Caches static assets for 1 year
- No caching for HTML (instant updates)
- Security headers (XSS, clickjacking protection)

**`docs/_redirects`**
- SPA routing for Docsify
- Proper 404 handling

**`docs/.nojekyll`**
- Prevents Jekyll processing (not needed for Cloudflare, but harmless)

## Features

### Automatic Deployments
- **Production**: Auto-deploys on push to `main` branch
- **Preview**: Every PR gets a unique preview URL
- **Rollback**: One-click rollback to previous versions

### Performance
- **Global CDN**: 200+ data centers worldwide
- **HTTP/3**: Latest protocol support
- **Compression**: Automatic Brotli/Gzip
- **Edge Computing**: Served from edge locations
- **Unlimited**: No bandwidth or request limits

### Security
- **Free SSL**: Automatic HTTPS certificates
- **DDoS Protection**: Built-in protection
- **Security Headers**: XSS, clickjacking prevention
- **Access Control**: Optional (for private docs)

## Custom Domain Setup

To use `docs.yourdomain.com`:

1. **In Cloudflare Pages**
   - Go to your project settings
   - Click **"Custom domains"**
   - Click **"Set up a custom domain"**
   - Enter: `docs.yourdomain.com`

2. **DNS Configuration**
   - If domain is on Cloudflare: Automatic setup ✅
   - If domain elsewhere: Add CNAME record:
     ```
     Name: docs
     Value: inflight-docs.pages.dev
     TTL: Auto
     ```

3. **SSL Certificate**
   - Issued automatically (1-2 minutes)
   - Full encryption enabled

## Local Testing

Test documentation locally before deploying:

### Option 1: Docsify CLI (Recommended)
```bash
# Install Docsify CLI
npm install -g docsify-cli

# Serve docs
cd docs
docsify serve

# Open http://localhost:3000
```

### Option 2: Wrangler (Cloudflare's CLI)
```bash
# Install Wrangler
npm install -g wrangler

# Navigate to docs
cd docs

# Start local server
npx wrangler pages dev . --port 3000

# Open http://localhost:3000
```

### Option 3: Simple HTTP Server
```bash
# Python 3
cd docs
python -m http.server 3000

# Node.js
cd docs
npx http-server -p 3000

# Open http://localhost:3000
```

## CI/CD with GitHub Actions

This repository includes a GitHub Actions workflow (`.github/workflows/docs-check.yml`) that:

- ✅ Validates documentation structure
- ✅ Checks for required files
- ✅ Verifies markdown links
- ✅ Tests Docsify configuration
- ✅ Runs on every push and PR

## Branch Preview URLs

Every branch and PR automatically gets a preview URL:

**Example:**
- Branch: `feature/new-user-guide`
- Preview URL: `https://abc123.inflight-docs.pages.dev`

**How to access:**
1. Create PR on GitHub
2. Cloudflare bot comments with preview URL
3. Click link to view live preview
4. Perfect for reviewing doc changes!

## Deployment Verification

After deployment, verify:

1. **Home Page**: `https://your-url.pages.dev/`
2. **User Guide**: `https://your-url.pages.dev/#/user-guide/quick-start`
3. **Developer Guide**: `https://your-url.pages.dev/#/developer/ARCHITECTURE`
4. **Search**: Test search functionality
5. **Navigation**: Click through sidebar links
6. **Mobile**: Test on mobile device

## Troubleshooting

### Build Fails
**Issue:** Deployment fails or gets stuck

**Solution:**
- Verify `docs/` directory exists
- Check build output directory is `docs`
- Ensure no build command is set
- Wait 5 minutes (first deploy can be slow)

### 404 Errors
**Issue:** Pages show 404 on direct access

**Solution:**
- Verify `_redirects` file exists in `docs/`
- Check file has SPA fallback rules
- Redeploy project

### Changes Don't Appear
**Issue:** Updated docs don't show after deployment

**Solution:**
- Clear browser cache (Ctrl+Shift+R)
- Wait 1-2 minutes for CDN propagation
- Try incognito/private window
- Check correct branch was deployed

### Links Broken
**Issue:** Internal links return 404

**Solution:**
- Check all sidebar links in `_sidebar.md`
- Verify file paths are relative to `docs/`
- Ensure file extensions are `.md`
- Test locally first with `docsify serve`

## Monitoring & Analytics

### Build Logs
- Cloudflare Pages dashboard → Your project → Deployments
- Click on deployment to view build logs
- Check for errors or warnings

### Analytics
- Cloudflare Pages dashboard → Your project → Analytics
- View page views, visitors, bandwidth
- Optional: Enable Cloudflare Web Analytics for detailed insights

### Performance
- Use Lighthouse (Chrome DevTools) to test performance
- Should score 90+ on all metrics
- Monitor Core Web Vitals

## Rollback Procedure

Need to rollback to a previous version?

1. Cloudflare Pages dashboard → Your project
2. Click **"View build history"**
3. Find previous successful deployment
4. Click **"Rollback to this deployment"**
5. Confirm rollback
6. Previous version is now live!

## Environment Variables

Docsify doesn't require build-time environment variables. All configuration is in `docs/index.html`.

If you need runtime config:
- Cloudflare Pages → Settings → Environment variables
- Add key-value pairs
- Redeploy project

## Security

### Headers Configuration
The `_headers` file sets:
- `X-Frame-Options: SAMEORIGIN` (clickjacking protection)
- `X-Content-Type-Options: nosniff` (MIME sniffing protection)
- `Referrer-Policy: strict-origin-when-cross-origin`
- `Permissions-Policy` (privacy controls)

### Access Control (Optional)
Restrict documentation access:
1. Cloudflare Pages → Settings → Access
2. Enable Cloudflare Access
3. Configure allowed emails/domains
4. Save configuration

**Note:** Free tier has limits; check pricing.

## Cost

Cloudflare Pages **Free Tier** includes:
- ✅ 500 builds per month
- ✅ Unlimited bandwidth
- ✅ Unlimited requests
- ✅ Unlimited sites
- ✅ Free SSL certificates
- ✅ DDoS protection
- ✅ Global CDN

**For most documentation sites, the free tier is sufficient!**

## Support & Resources

- **Full deployment guide**: See [docs/developer/CLOUDFLARE_DEPLOYMENT.md](docs/developer/CLOUDFLARE_DEPLOYMENT.md)
- **Cloudflare Docs**: https://developers.cloudflare.com/pages/
- **Docsify Docs**: https://docsify.js.org/
- **Community Support**: https://community.cloudflare.com/
- **GitHub Issues**: Report problems in this repository

## Next Steps

1. ✅ Deploy to Cloudflare Pages (you're ready!)
2. 📝 Update documentation content
3. 🎨 Customize theme (edit `docs/index.html`)
4. 🌍 Add custom domain (optional)
5. 📊 Enable analytics (optional)

## Contributing

See [docs/CONTRIBUTING.md](docs/CONTRIBUTING.md) for guidelines on:
- Documentation structure
- Writing style
- Pull request process
- Testing changes locally

---

**Ready to deploy?** 🚀

Visit https://pages.cloudflare.com and follow the Quick Start guide above!

Your documentation will be live in under 60 seconds.
