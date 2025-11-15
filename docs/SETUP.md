# Documentation Setup Guide

This guide explains how to publish the InFlight user documentation.

## Option 1: GitHub Pages (Recommended - Free & Simple)

GitHub Pages with Docsify provides a beautiful, searchable documentation site without any build step.

### Enable GitHub Pages

1. Go to your repository on GitHub: `https://github.com/HisenZhang/inflight`
2. Click **Settings** (top right)
3. Scroll to **Pages** section (left sidebar)
4. Under **Source**, select:
   - Branch: `main` (or your default branch)
   - Folder: `/docs`
5. Click **Save**
6. Wait 1-2 minutes for deployment

### Access Your Documentation

Once deployed, your documentation will be available at:

```
https://hisenzhang.github.io/inflight/
```

**Features:**
- ✅ Instant search
- ✅ Beautiful theme
- ✅ Mobile responsive
- ✅ No build step required
- ✅ Auto-updates when you push to GitHub
- ✅ Free hosting

## Option 2: GitBook.com (Premium Features)

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

## Option 3: ReadTheDocs (Free for Open Source)

Another popular option for open-source projects.

### Setup Steps

1. Go to https://readthedocs.org/
2. Sign in with GitHub
3. Import `HisenZhang/inflight` repository
4. Configure to use `/docs/user-guide/`
5. Build and publish

**ReadTheDocs Features:**
- ✅ Free for open source
- ✅ Version hosting (multiple versions)
- ✅ Search
- ✅ PDF/ePub export
- ✅ Custom domains

## Comparison

| Feature | GitHub Pages | GitBook.com | ReadTheDocs |
|---------|--------------|-------------|-------------|
| **Cost** | Free | Free tier limited | Free (OSS) |
| **Setup Time** | 5 minutes | 10 minutes | 15 minutes |
| **Build Step** | None (Docsify) | Automatic | Automatic |
| **Custom Domain** | Yes (free) | Yes (paid) | Yes (free) |
| **Search** | Yes | Yes | Yes |
| **Analytics** | Via Google | Built-in (paid) | Built-in |
| **PDF Export** | No | Yes | Yes |
| **Collaboration** | Git-based | Built-in | Git-based |

## Recommended Approach

**For quick setup:** Use **GitHub Pages** (Option 1)
- Already configured with Docsify
- Works immediately after enabling
- No account needed beyond GitHub

**For premium features:** Use **GitBook.com** (Option 2)
- If you need PDF export
- If you want analytics
- If you need team collaboration

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
