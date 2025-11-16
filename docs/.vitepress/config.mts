import { defineConfig } from 'vitepress'

// https://vitepress.dev/reference/site-config
export default defineConfig({
  title: "InFlight",
  description: "Flight planning and navigation documentation",

  // Base URL for deployment
  base: '/',

  // Ignore dead links (old Docsify files and features that don't exist yet)
  ignoreDeadLinks: true,

  // Theme configuration
  themeConfig: {
    // Site title and logo
    siteTitle: 'InFlight',

    // Navigation bar
    nav: [
      { text: 'Home', link: '/' },
      { text: 'User Guide', link: '/user-guide/' },
      { text: 'Developer Guide', link: '/developer/ARCHITECTURE' },
      {
        text: 'GitHub',
        link: 'https://github.com/HisenZhang/inflight'
      }
    ],

    // Sidebar navigation
    sidebar: {
      '/': [
        {
          text: 'Getting Started',
          collapsed: false,
          items: [
            { text: 'Quick Start', link: '/user-guide/quick-start' },
            { text: 'Quick Reference', link: '/user-guide/QUICK_REFERENCE' }
          ]
        },
        {
          text: 'User Guide',
          collapsed: false,
          items: [
            { text: 'Introduction', link: '/user-guide/' },
            { text: 'WELCOME Tab', link: '/user-guide/tab-welcome' },
            { text: 'DATA Tab', link: '/user-guide/tab-data' },
            { text: 'ROUTE Tab', link: '/user-guide/tab-route' },
            { text: 'NAVLOG Tab', link: '/user-guide/tab-navlog' },
            { text: 'MAP Tab', link: '/user-guide/tab-map' },
            { text: 'CHKLST Tab', link: '/user-guide/tab-chklst' },
            { text: 'STATS Tab', link: '/user-guide/tab-stats' },
            { text: 'Keyboard Shortcuts', link: '/user-guide/keyboard-shortcuts' },
            { text: 'Troubleshooting', link: '/user-guide/troubleshooting' },
            { text: 'FAQ', link: '/user-guide/faq' }
          ]
        },
        {
          text: 'Developer Guide',
          collapsed: false,
          items: [
            { text: 'Architecture Overview', link: '/developer/ARCHITECTURE' },
            { text: 'Development Setup', link: '/developer/SETUP' },
            { text: 'Testing Guide', link: '/developer/TESTING' },
            { text: 'Test Routes', link: '/developer/TEST_ROUTES' },
            { text: 'Route Parser', link: '/developer/PARSER_ARCHITECTURE' },
            { text: 'Route Grammar', link: '/developer/ROUTE_GRAMMAR' },
            { text: 'Route Syntax', link: '/developer/ROUTE_SYNTAX' },
            { text: 'Deployment Guide', link: '/developer/DEPLOYMENT' },
            { text: 'Cloudflare Pages Setup', link: '/developer/CLOUDFLARE_DEPLOYMENT' },
            { text: 'Consolidation Summary', link: '/developer/CONSOLIDATION_SUMMARY' }
          ]
        },
        {
          text: 'Developer Reference',
          collapsed: true,
          items: [
            { text: 'ARTCC Waypoints Guide', link: '/developer/reference/ARTCC_WAYPOINTS_GUIDE' },
            { text: 'Implementation Summary', link: '/developer/reference/IMPLEMENTATION_SUMMARY' },
            { text: 'Refactoring Summary', link: '/developer/reference/REFACTORING_SUMMARY' },
            { text: 'Testing Summary', link: '/developer/reference/AUTOMATED_TESTING_SUMMARY' }
          ]
        },
        {
          text: 'Resources',
          collapsed: true,
          items: [
            { text: 'Contributing Guide', link: '/CONTRIBUTING' },
            {
              text: 'GitHub Repository',
              link: 'https://github.com/HisenZhang/inflight'
            },
            {
              text: 'Report an Issue',
              link: 'https://github.com/HisenZhang/inflight/issues'
            }
          ]
        }
      ]
    },

    // Social links
    socialLinks: [
      { icon: 'github', link: 'https://github.com/HisenZhang/inflight' }
    ],

    // Footer
    footer: {
      message: 'Made with ❤️ for aviation enthusiasts',
      copyright: 'Licensed under MIT'
    },

    // Search
    search: {
      provider: 'local'
    },

    // Edit link
    editLink: {
      pattern: 'https://github.com/HisenZhang/inflight/edit/main/docs/:path',
      text: 'Edit this page on GitHub'
    },

    // Last updated
    lastUpdated: {
      text: 'Updated at',
      formatOptions: {
        dateStyle: 'full',
        timeStyle: 'medium'
      }
    },

    // Outline (table of contents)
    outline: {
      level: [2, 3],
      label: 'On this page'
    }
  },

  // Markdown configuration
  markdown: {
    lineNumbers: true,
    theme: {
      light: 'github-light',
      dark: 'github-dark'
    }
  },

  // Head tags (for SEO and icons)
  head: [
    ['link', { rel: 'icon', href: 'data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 100 100%22><text y=%22.9em%22 font-size=%2290%22>✈️</text></svg>' }],
    ['meta', { name: 'theme-color', content: '#00D9FF' }],
    ['meta', { name: 'og:type', content: 'website' }],
    ['meta', { name: 'og:locale', content: 'en' }],
    ['meta', { name: 'og:site_name', content: 'InFlight Documentation' }]
  ]
})
