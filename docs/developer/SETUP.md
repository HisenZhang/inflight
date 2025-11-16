# Documentation Setup Guide

This guide explains how to publish the InFlight user documentation.

## Option 1: Cloudflare Pages (Recommended - Best Performance)

**⭐ RECOMMENDED**: Cloudflare Pages offers the best performance and features for free.

### Quick Setup (5 Minutes)

See **[Complete Cloudflare Deployment Guide](CLOUDFLARE_DEPLOYMENT.md)** for detailed instructions.

**Quick steps:**

1. Go to https://pages.cloudflare.com
2. Sign in and click "Create a project"
3. Connect to GitHub → Select `HisenZhang/inflight`
4. Configure:
   - **Build command**: (leave empty)
   - **Build output directory**: `docs`
5. Deploy!

**Your docs will be at:**
```
https://inflight-docs.pages.dev
```

**Why Cloudflare Pages:**
- ✅ **Unlimited bandwidth** - No traffic limits
- ✅ **200+ CDN locations** - Blazing fast globally
- ✅ **Branch previews** - Every PR gets a preview URL
- ✅ **DDoS protection** - Built-in security
- ✅ **Analytics** - Built-in traffic insights
- ✅ **Auto-deploys** - Updates on every push
- ✅ **Free SSL** - Automatic HTTPS
- ✅ **Custom domains** - Add your own domain for free
- ✅ **No build needed** - Static Docsify site

## Option 2: GitHub Pages (Not Available - Custom Domain Conflict)

> ⚠️ **Note**: GitHub Pages won't work if you have a custom CNAME set up for your personal blog. The CNAME affects all repository pages, causing `/inflight/` to redirect to your custom domain where it doesn't exist.
>
> **Use Cloudflare Pages, Netlify, or Vercel instead.**

## Option 3: GitBook.com (Premium Features)

GitBook.com offers a professional documentation platform with advanced features.

### Setup Steps

1. **Create Account**
   - Go to https://www.gitbook.com/
   - Sign up (free tier available)

2. **Create New Space**
   - Click "New Space"
   - Choose "Import from GitHub"

3. **Connect Repository**
   - Authorize GitBook to access your GitHub
   - Select repository: `HisenZhang/inflight`
   - Select folder: `docs/user-guide`
   - Select file: `SUMMARY.md`

4. **Configure**
   - Set title: "InFlight User Guide"
   - Choose visibility (public/private)
   - Click "Import"

5. **Publish**
   - GitBook will build your documentation
   - Access at: `https://[your-space].gitbook.io/inflight`

**GitBook.com Features:**
- ✅ Custom domain support
- ✅ Advanced search
- ✅ Analytics
- ✅ Team collaboration
- ✅ Version control
- ✅ PDF export
- ⚠️ Free tier has limitations
- ⚠️ Requires account

### GitBook Configuration

The `book.json` file in `/docs/user-guide/` contains GitBook settings:
- Plugins for search, code copy, GitHub link
- Theme configuration
- Table of contents structure

## Option 4: Netlify or Vercel (Alternative Free Options)

Both are excellent alternatives to Cloudflare Pages:

**Netlify:**
- Go to https://netlify.com
- Import from GitHub
- Build output: `docs`
- URL: `https://inflight-docs.netlify.app`

**Vercel:**
- Go to https://vercel.com
- Import from GitHub
- Output directory: `docs`
- URL: `https://inflight-docs.vercel.app`

## Comparison

| Feature | Cloudflare Pages | Netlify | Vercel | GitBook.com |
|---------|------------------|---------|--------|-------------|
| **Cost** | Free | Free | Free | Free tier limited |
| **Setup Time** | 5 minutes | 5 minutes | 5 minutes | 10 minutes |
| **Build Step** | None | None | None | Automatic |
| **Custom Domain** | Yes (free) | Yes (free) | Yes (free) | Yes (paid) |
| **Bandwidth** | Unlimited | 100GB/mo | 100GB/mo | Limited |
| **CDN Locations** | 200+ | 100+ | 100+ | N/A |
| **Branch Previews** | ✅ Unlimited | ✅ Limited | ✅ Limited | ✅ |
| **Analytics** | ✅ Built-in | Add-on | Add-on | Built-in |
| **DDoS Protection** | ✅ | Add-on | Add-on | N/A |

## Recommended Approach

**⭐ Best choice:** Use **Cloudflare Pages** (Option 1)
- Unlimited bandwidth
- Best performance (200+ CDN locations)
- Built-in analytics and DDoS protection
- Free forever
- 5-minute setup

**For premium docs features:** Use **GitBook.com** (Option 3)
- If you need PDF export
- If you want advanced analytics
- If you need team collaboration features

## Testing Locally

### Docsify Local Server

To test the GitHub Pages version locally:

```bash
# Install docsify-cli
npm install -g docsify-cli

# Serve documentation
cd /path/to/inflight/docs
docsify serve

# Open browser to http://localhost:3000
```

### GitBook Local Build

To test GitBook version locally:

```bash
# Install GitBook CLI (legacy)
npm install -g gitbook-cli

# Navigate to docs
cd /path/to/inflight/docs/user-guide

# Install plugins
gitbook install

# Serve documentation
gitbook serve

# Open browser to http://localhost:4000
```

## Updating Documentation

### For GitHub Pages
1. Edit markdown files in `/docs/user-guide/`
2. Commit and push to GitHub
3. GitHub Pages auto-updates (1-2 minutes)

### For GitBook.com
1. Edit markdown files
2. Commit and push to GitHub
3. GitBook auto-syncs from GitHub
4. Changes appear immediately

## Custom Domain (Optional)

### GitHub Pages Custom Domain

1. Add `CNAME` file to `/docs/`:
   ```
   docs.inflight.app
   ```

2. Configure DNS:
   - Add CNAME record: `docs` → `hisenzhang.github.io`

3. GitHub Settings → Pages → Custom domain → Enter domain

### GitBook Custom Domain

1. Go to Space Settings → Domain
2. Enter custom domain
3. Configure DNS as instructed
4. Verify ownership

## Troubleshooting

### GitHub Pages Not Working

**Problem:** 404 error after enabling

**Solution:**
1. Ensure `/docs/index.html` exists
2. Wait 5 minutes for propagation
3. Check Settings → Pages shows green checkmark
4. Verify branch and folder are correct

### GitBook Import Fails

**Problem:** Cannot import repository

**Solution:**
1. Ensure `SUMMARY.md` is valid
2. Check repository is public or GitBook has access
3. Verify `docs/user-guide/` path exists

### Docsify Not Loading

**Problem:** Blank page or "Loading..." stuck

**Solution:**
1. Check browser console for errors
2. Verify CDN URLs in `index.html` are accessible
3. Check `_sidebar.md` paths are correct
4. Ensure `.nojekyll` file exists

## Support

- **GitHub Pages**: https://docs.github.com/pages
- **GitBook**: https://docs.gitbook.com/
- **Docsify**: https://docsify.js.org/
- **ReadTheDocs**: https://docs.readthedocs.io/

---

**Current Status:** Documentation is ready for deployment with any of these options. GitHub Pages with Docsify is configured and ready to use.
