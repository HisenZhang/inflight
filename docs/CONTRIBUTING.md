# Contributing to InFlight Documentation

Thank you for your interest in improving the InFlight documentation! This guide will help you get started.

## Documentation Structure

The documentation is organized into two main sections:

```
docs/
├── index.html              # Docsify configuration
├── README.md               # Documentation home page
├── _sidebar.md             # Navigation sidebar
├── _headers                # Cloudflare Pages headers
├── _redirects              # URL redirects
├── .nojekyll              # Disable Jekyll processing
│
├── user-guide/            # User-facing documentation
│   ├── README.md          # User guide introduction
│   ├── quick-start.md     # Getting started guide
│   ├── tab-*.md           # Tab-specific guides
│   ├── keyboard-shortcuts.md
│   ├── troubleshooting.md
│   └── faq.md
│
└── developer/             # Developer documentation
    ├── ARCHITECTURE.md    # System architecture
    ├── SETUP.md          # Development setup
    ├── TESTING.md        # Testing guide
    ├── PARSER_ARCHITECTURE.md
    ├── ROUTE_GRAMMAR.md
    ├── ROUTE_SYNTAX.md
    ├── CLOUDFLARE_DEPLOYMENT.md
    └── reference/        # Additional references
        ├── ARTCC_WAYPOINTS_GUIDE.md
        ├── IMPLEMENTATION_SUMMARY.md
        └── REFACTORING_SUMMARY.md
```

## How to Contribute

### 1. Local Setup

```bash
# Install Docsify CLI (optional, for local preview)
npm install -g docsify-cli

# Serve documentation locally
cd docs
docsify serve

# Open http://localhost:3000
```

### 2. Making Changes

1. **Fork the repository** on GitHub
2. **Clone your fork** locally
3. **Create a branch** for your changes:
   ```bash
   git checkout -b docs/improve-quick-start
   ```
4. **Make your changes** in the appropriate file(s)
5. **Test locally** using `docsify serve`
6. **Commit your changes**:
   ```bash
   git add docs/
   git commit -m "Improve quick start guide with more examples"
   ```
7. **Push to your fork**:
   ```bash
   git push origin docs/improve-quick-start
   ```
8. **Create a Pull Request** on GitHub

### 3. Documentation Guidelines

#### Writing Style

- **Clear and concise**: Use simple language
- **Action-oriented**: Start with verbs (Click, Enter, Select)
- **User-focused**: Write from the user's perspective
- **Examples**: Include practical examples where helpful
- **Screenshots**: Add images for complex UI interactions (optional)

#### Markdown Formatting

**Headers:**
```markdown
# H1 - Page Title (one per page)
## H2 - Main Sections
### H3 - Subsections
```

**Code blocks:**
````markdown
```bash
# Bash commands
npm install
```

```javascript
// JavaScript code
const example = "code";
```
````

**Links:**
```markdown
[Link text](relative/path/to/file.md)
[External link](https://example.com)
```

**Callouts:**
```markdown
> **Note:** Important information for users

> **Warning:** Critical warnings about potential issues

> **Tip:** Helpful tips and best practices
```

**Lists:**
```markdown
- Unordered list item
- Another item

1. Ordered list item
2. Another item
```

#### File Naming

- Use **kebab-case**: `quick-start.md`, `keyboard-shortcuts.md`
- Be **descriptive**: File name should indicate content
- **Consistency**: Follow existing patterns

#### Adding New Pages

1. Create the markdown file in the appropriate directory
2. Add an entry to `_sidebar.md`:
   ```markdown
   * **User Guide**
     * [Your New Page](user-guide/your-new-page.md)
   ```
3. Link from related pages where appropriate

### 4. User Guide Contributions

**User documentation should:**
- Be written for pilots and flight planners
- Focus on **how** to use features, not how they work internally
- Include practical examples and use cases
- Use aviation terminology correctly
- Be accessible to beginners but comprehensive for advanced users

**Good user guide content:**
```markdown
## Planning Your Route

1. Switch to the ROUTE tab
2. Enter your waypoints separated by spaces:
   - Example: `KJFK KORD KSFO`
3. Click COMPUTE or press Enter
4. View your navigation log in the NAVLOG tab

**Tip:** You can also use airways like `KJFK V44 KORD`
```

### 5. Developer Documentation Contributions

**Developer documentation should:**
- Explain **how** things work internally
- Include code examples and architecture diagrams
- Document APIs, data structures, and algorithms
- Help developers contribute to the project
- Reference source code files

**Good developer content:**
```markdown
## Route Parser Architecture

The route parser uses a two-stage process:

1. **Lexical Analysis**: Tokenizes route string
   - See: `compute/route-expander.js:parseRoute()`
   - Returns: Array of tokens with types

2. **Semantic Analysis**: Resolves waypoints
   - See: `compute/query-engine.js:resolveWaypoint()`
   - Returns: Expanded waypoint list with coordinates
```

### 6. Testing Your Changes

**Before submitting:**

✅ **Verify links work**: All internal links point to existing files
✅ **Check formatting**: Markdown renders correctly in Docsify
✅ **Test locally**: Use `docsify serve` to preview
✅ **Spell check**: No typos or grammatical errors
✅ **Code examples**: All code blocks have proper syntax highlighting
✅ **Mobile-friendly**: Test on mobile/tablet if possible

### 7. Pull Request Process

**PR Title Format:**
```
docs: Brief description of changes
```

**Examples:**
- `docs: Add wind correction tutorial to user guide`
- `docs: Update architecture diagrams`
- `docs: Fix broken links in developer guide`

**PR Description Template:**
```markdown
## What Changed
Brief description of your changes

## Why
Reason for the change (e.g., "User confusion about X", "Missing info on Y")

## Type of Change
- [ ] User guide update
- [ ] Developer documentation
- [ ] Fix typos/formatting
- [ ] Add new page
- [ ] Update existing content

## Checklist
- [ ] Tested locally with docsify serve
- [ ] All links work
- [ ] Markdown formatting is correct
- [ ] Updated _sidebar.md if new page
- [ ] Followed writing style guidelines
```

### 8. Common Tasks

#### Adding a Screenshot

1. Take screenshot (use browser dev tools to resize window to standard size)
2. Save to `docs/images/` (create directory if needed)
3. Optimize image (use online tools to compress)
4. Reference in markdown:
   ```markdown
   ![Route entry example](images/route-tab-example.png)
   ```

#### Updating the Sidebar

Edit `docs/_sidebar.md`:
```markdown
* **User Guide**
  * [Existing Page](user-guide/existing.md)
  * [Your New Page](user-guide/new-page.md)  ← Add here
```

#### Creating a New Section

1. Create directory: `mkdir docs/new-section`
2. Add README: `docs/new-section/README.md`
3. Update `_sidebar.md`:
   ```markdown
   * **New Section**
     * [Introduction](new-section/README.md)
   ```

## Documentation Framework

We use **Docsify** for our documentation:

- **No build step**: Pure markdown, rendered client-side
- **Fast**: Loads instantly, great search
- **Simple**: Just markdown files
- **Deployed on**: Cloudflare Pages

**Docsify Features:**
- Sidebar navigation
- Full-text search
- Syntax highlighting
- Responsive design
- Anchor links
- Zoom images

**Learn more:** https://docsify.js.org/

## Style Guide

### Terminology

**Correct:**
- waypoint (not "waypoint name" or "fix")
- navigation log / navlog (not "nav log")
- InFlight (capital I and F, not "Inflight")
- Docsify (capital D)
- Cloudflare Pages (two words)

**Aviation terms:**
- Use ICAO codes: KJFK (not JFK)
- Spell out abbreviations first: VOR (VHF Omnidirectional Range)
- Use proper case: STAR, SID, NDB, DME

### Tone

- **Professional** but **friendly**
- **Helpful** and **encouraging**
- **Clear** and **direct**
- **Avoid jargon** unless necessary (then explain it)

### Examples

**Good:**
```markdown
Switch to the ROUTE tab and enter your waypoints. For example,
`KJFK KORD KSFO` creates a route from New York to Chicago to
San Francisco.
```

**Avoid:**
```markdown
Navigate to the route interface and input your desired waypoint
sequence in the text field provided.
```

## Need Help?

- **Questions:** Open a GitHub Discussion
- **Bugs:** Report in GitHub Issues
- **Suggestions:** Create a Pull Request or Issue

## License

By contributing to InFlight documentation, you agree that your
contributions will be licensed under the MIT License.

---

Thank you for helping improve InFlight documentation! 🚀
