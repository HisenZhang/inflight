# Notes for Claude Code Sessions

This document provides context for future AI assistant sessions working on this project.

## Project Overview

**InFlight** - Lightweight web-based flight planning application with comprehensive navigation log and tactical display.

- **Language:** Pure JavaScript (no build tools for main app)
- **Architecture:** 3-engine model (Data, Compute, Display)
- **Storage:** IndexedDB for offline-first functionality
- **Documentation:** VitePress-based docs site

## Documentation Framework: VitePress

### Important: NO Markdown Files in Project Root!

**Rule:** All documentation MUST go in `docs/` directory.

**Exception:** Only `README.md` should exist in project root (repository overview).

### VitePress Structure

```
docs/
├── .vitepress/
│   ├── config.mts          # VitePress configuration
│   ├── theme/
│   │   ├── index.ts        # Theme entry point
│   │   └── custom.css      # Aviation theme styling
│   └── dist/              # Build output (gitignored)
├── README.md               # Documentation homepage
├── CONTRIBUTING.md
├── VITEPRESS_MIGRATION.md
├── user-guide/            # User-facing documentation
└── developer/             # Developer documentation
    ├── ARCHITECTURE.md
    ├── SETUP.md
    ├── DEPLOYMENT.md
    ├── CLOUDFLARE_DEPLOYMENT.md
    └── reference/         # Reference docs
```

### NPM Scripts

```bash
npm run docs:dev      # Start dev server (http://localhost:5173)
npm run docs:build    # Build for production
npm run docs:preview  # Preview production build
```

### Cloudflare Pages Deployment

**Build Settings:**
- Framework preset: VitePress
- Build command: `npm run docs:build`
- Build output directory: `docs/.vitepress/dist`
- Node version: 18+

### Theme

**Brand Color:** #00D9FF (Aviation cyan)
**Custom Theme:** `docs/.vitepress/theme/custom.css`

## When Adding Documentation

1. ✅ Create files in `docs/` or subdirectories
2. ✅ Update `docs/.vitepress/config.mts` sidebar if adding new pages
3. ✅ Test with `npm run docs:dev`
4. ❌ NEVER create `.md` files in project root (except README.md)

## Project Structure

```
inflight/
├── README.md              # Main repository README (ONLY .md in root!)
├── index.html            # Main application
├── package.json          # Project dependencies
├── docs/                 # ALL documentation goes here
├── lib/                  # External libraries
├── utils/                # Shared utilities
├── data/                 # Data engine (CRUD)
├── compute/              # Compute engine (business logic)
├── state/                # State management
├── display/              # Display engine (UI)
└── tests/                # Test suite
```

## Common Tasks

### Adding a New Doc Page

1. Create markdown file in appropriate `docs/` subdirectory
2. Edit `docs/.vitepress/config.mts`:
   ```typescript
   sidebar: {
     '/': [
       {
         text: 'Section',
         items: [
           { text: 'New Page', link: '/path/to/new-page' }
         ]
       }
     ]
   }
   ```
3. Test: `npm run docs:dev`
4. Build: `npm run docs:build`

### Creating Summary/Reference Docs

**Always put in docs/developer/ or docs/developer/reference/**

Examples:
- Migration docs → `docs/developer/VITEPRESS_MIGRATION.md`
- Deployment guide → `docs/developer/DEPLOYMENT.md`
- Implementation notes → `docs/developer/reference/IMPLEMENTATION_SUMMARY.md`

### Testing Changes

```bash
# Start dev server with hot reload
npm run docs:dev

# Build to check for errors
npm run docs:build

# Preview production build
npm run docs:preview
```

## Git Workflow

### Ignored Directories

```gitignore
node_modules/
docs/.vitepress/dist/
docs/.vitepress/cache/
data/local/
```

### Committing Docs Changes

1. Test locally first
2. Commit with descriptive message:
   ```bash
   git add docs/
   git commit -m "docs: add new deployment guide"
   ```

## VitePress Configuration

### Key Config Files

**`docs/.vitepress/config.mts`:**
- Site title, description
- Navigation bar
- Sidebar structure
- Search settings
- Theme colors
- SEO settings

**`docs/.vitepress/theme/custom.css`:**
- Brand colors (#00D9FF)
- Custom component styles
- Aviation theme overrides

### Dead Links

Currently using `ignoreDeadLinks: true` in config because:
- Old Docsify files (`_sidebar.md`, `SUMMARY.md`) contain dead links
- Some feature pages referenced but not created yet

## Documentation Guidelines

### File Naming

- Use kebab-case: `deployment-guide.md`
- Be descriptive: `cloudflare-pages-setup.md`
- Consistent with existing patterns

### Writing Style

- Clear and concise
- Action-oriented (start with verbs)
- Include code examples
- Use proper markdown formatting

### Location Rules

| Type | Location | Example |
|------|----------|---------|
| User guide | `docs/user-guide/` | `quick-start.md` |
| Developer docs | `docs/developer/` | `ARCHITECTURE.md` |
| Reference | `docs/developer/reference/` | `IMPLEMENTATION_SUMMARY.md` |
| Meta docs | `docs/` | `CONTRIBUTING.md` |
| Project README | Root only | `README.md` |

## Troubleshooting

### Build Fails

```bash
# Clear cache and rebuild
rm -rf docs/.vitepress/cache docs/.vitepress/dist
npm run docs:build
```

### Dead Link Warnings

Add to `docs/.vitepress/config.mts`:
```typescript
ignoreDeadLinks: true  // Already set
```

Or fix the links in the source files.

### Dev Server Won't Start

```bash
# Reinstall dependencies
rm -rf node_modules package-lock.json
npm install

# Try again
npm run docs:dev
```

## Remember

1. **NO .md files in project root** (except README.md)
2. **All docs in `docs/`** directory
3. **Update VitePress config** when adding pages
4. **Test locally** before committing
5. **Aviation theme** uses cyan (#00D9FF)

## Quick Reference

```bash
# Development
npm run docs:dev        # http://localhost:5173

# Build
npm run docs:build      # Output: docs/.vitepress/dist/

# Preview
npm run docs:preview    # Test production build

# Main app
npm start              # Open main application
npm test               # Run tests
```

## Resources

- **VitePress Docs:** https://vitepress.dev/
- **Project Docs:** `docs/developer/DEPLOYMENT.md`
- **Migration Guide:** `docs/VITEPRESS_MIGRATION.md`
- **Contributing:** `docs/CONTRIBUTING.md`

---

**Last Updated:** November 15, 2024
**VitePress Version:** 1.6.4
**Node Version Required:** 18+
