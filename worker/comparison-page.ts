// Comparison page renderer for /errore-vs-effect.
// Parses the MD content file into sections, highlights code blocks
// with @code-hike/lighter, renders prose with marked, and outputs
// a full HTML page with side-by-side comparison layout.

import { marked } from 'marked'
import { highlightCode } from './highlight'
import { darkModeColors, hideScrollbars } from './shared-styles'

interface Section {
  prose: string
  codeBlocks: { lang: string; code: string }[]
}

/**
 * Parse the comparison markdown into sections split by ---.
 * Each section has prose (markdown) and exactly two fenced code blocks.
 */
function parseSections(md: string): Section[] {
  const rawSections = md.split(/\n---\n/)

  return rawSections.map((raw) => {
    const codeBlocks: { lang: string; code: string }[] = []

    // Extract fenced code blocks and replace with placeholders
    const prose = raw.replace(
      /```(\w+)?\n([\s\S]*?)```/g,
      (_match, lang, code) => {
        codeBlocks.push({ lang: lang || 'typescript', code: code.trimEnd() })
        return '' // remove from prose
      },
    )

    return { prose: prose.trim(), codeBlocks }
  })
}

/**
 * Render a single comparison section to HTML.
 */
async function renderSection(section: Section): Promise<string> {
  const proseHtml = await marked.parse(section.prose)

  if (section.codeBlocks.length < 2) {
    // Not a comparison section, just render prose + any single code block
    const codeHtml =
      section.codeBlocks.length === 1
        ? await highlightCode(
            section.codeBlocks[0].code,
            section.codeBlocks[0].lang,
          )
        : ''
    return `<section class="comparison-section">${proseHtml}${codeHtml}</section>`
  }

  const [left, right] = await Promise.all([
    highlightCode(section.codeBlocks[0].code, section.codeBlocks[0].lang),
    highlightCode(section.codeBlocks[1].code, section.codeBlocks[1].lang),
  ])

  const leftLabel = 'Effect'
  const rightLabel = 'errore'

  return `
    <section class="comparison-section">
      <div class="comparison-prose">${proseHtml}</div>
      <div class="comparison">
        <div class="comparison-side">
          <div class="comparison-label">${escapeHtml(leftLabel)}</div>
          ${left}
        </div>
        <div class="comparison-side">
          <div class="comparison-label">${escapeHtml(rightLabel)}</div>
          ${right}
        </div>
      </div>
    </section>`
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

/**
 * Render the full comparison page from markdown content.
 */
export async function renderComparisonPage(mdContent: string): Promise<string> {
  const sections = parseSections(mdContent)
  const sectionsHtml = await Promise.all(sections.map(renderSection))

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>errore vs Effect — Side-by-Side Comparison</title>
  <meta name="description" content="Compare Effect.ts and errore side by side. See how typed error handling looks with each approach." />
  <meta property="og:title" content="errore vs Effect — Side-by-Side Comparison" />
  <meta property="og:description" content="Compare Effect.ts and errore side by side. See how typed error handling looks with each approach." />
  <meta property="og:image" content="https://errore.org/og-errore-vs-effect.png" />
  <meta property="og:url" content="https://errore.org/errore-vs-effect" />
  <meta property="og:type" content="website" />
  <meta name="twitter:card" content="summary_large_image" />
  <meta name="twitter:title" content="errore vs Effect — Side-by-Side Comparison" />
  <meta name="twitter:description" content="Compare Effect.ts and errore side by side. See how typed error handling looks with each approach." />
  <meta name="twitter:image" content="https://errore.org/og-errore-vs-effect.png" />
  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
  <link href="https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;500&family=Inter:wght@400;500;600;700&family=Source+Serif+4:opsz,wght@8..60,400;8..60,600;8..60,700&display=swap" rel="stylesheet" />
  <style>${getStyles()}</style>
</head>
<body>
  <header class="page-header">
    <a href="/" class="back-link">&larr; errore.org</a>
    <h1>errore <span class="vs">vs</span> Effect</h1>
    <p class="subtitle">Side-by-side comparison of typed error handling approaches in TypeScript.</p>
  </header>
  <main>
    ${sectionsHtml.join('\n')}
  </main>
  <footer class="page-footer">
    <p>
      <a href="/">errore.org</a> &middot;
      <a href="https://github.com/remorses/errore">GitHub</a> &middot;
      <a href="https://www.npmjs.com/package/errore">npm</a>
    </p>
  </footer>
</body>
</html>`
}

function getStyles(): string {
  return `
    *, *::before, *::after {
      box-sizing: border-box;
      margin: 0;
      padding: 0;
    }

    :root {
      --bg: #faf9f6;
      --fg: #1a1a1a;
      --fg-secondary: #444;
      --fg-muted: #666;
      --fg-faint: #888;
      --fg-dim: #999;
      --inline-code-bg: #eee;
      --border: #e5e3de;
      --code-border: rgba(255,255,255,0.06);
    }

    @media (prefers-color-scheme: dark) {
      :root {
        --bg: ${darkModeColors.bg};
        --fg: ${darkModeColors.fg};
        --fg-secondary: ${darkModeColors.fgSecondary};
        --fg-muted: ${darkModeColors.fgMuted};
        --fg-faint: ${darkModeColors.fgFaint};
        --fg-dim: ${darkModeColors.fgDim};
        --inline-code-bg: ${darkModeColors.inlineCodeBg};
        --border: ${darkModeColors.border};
        --code-border: rgba(255,255,255,0.08);
      }
    }

    body {
      font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;
      background: var(--bg);
      color: var(--fg);
      line-height: 1.6;
      -webkit-font-smoothing: antialiased;
    }

    ${hideScrollbars}

    /* Header */
    .page-header {
      max-width: 1000px;
      margin: 0 auto;
      padding: 3rem 2rem 2rem;
      text-align: left;
    }
    .back-link {
      display: inline-block;
      margin-bottom: 1rem;
      color: var(--fg-muted);
      text-decoration: none;
      font-size: 0.9rem;
    }
    .back-link:hover { color: var(--fg); }
    .page-header h1 {
      font-family: 'Source Serif 4', Georgia, serif;
      font-size: 2.5rem;
      font-weight: 700;
      letter-spacing: -0.02em;
    }
    .vs {
      font-weight: 400;
      color: var(--fg-dim);
      font-size: 0.8em;
    }
    .subtitle {
      margin-top: 0.5rem;
      color: var(--fg-muted);
      font-size: 1.1rem;
    }

    /* Main */
    main {
      max-width: 1000px;
      margin: 0 auto;
      padding: 1rem 2rem 4rem;
    }

    /* Section */
    .comparison-section {
      margin-bottom: 4rem;
      text-align: left;
    }

    /* Group headings (h1 sections with no code blocks) */
    .comparison-section > h1 {
      font-size: 1.1rem;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.08em;
      color: var(--fg-muted);
      margin: 2rem 0 0;
      padding-top: 2rem;
      border-top: 1px solid var(--border);
    }
    .comparison-section:first-child > h1 {
      border-top: none;
      padding-top: 0;
      margin-top: 0;
    }

    /* Prose */
    .comparison-prose {
      margin: 0 0 1.5rem;
    }
    .comparison-prose h2 {
      font-family: 'Source Serif 4', Georgia, serif;
      font-size: 1.5rem;
      font-weight: 600;
      margin-bottom: 0.5rem;
      letter-spacing: -0.01em;
    }
    .comparison-prose p {
      color: var(--fg-secondary);
      font-size: 1rem;
      margin-bottom: 0.75rem;
    }
    .comparison-prose code {
      font-family: 'IBM Plex Mono', monospace;
      font-size: 0.875em;
      background: var(--inline-code-bg);
      padding: 0.15em 0.35em;
      border-radius: 3px;
    }
    .comparison-prose strong {
      font-weight: 600;
      color: var(--fg);
    }
    .comparison-prose a {
      color: var(--fg);
      text-decoration: underline;
      text-underline-offset: 2px;
    }

    /* Side-by-side */
    .comparison {
      display: flex;
      flex-direction: column;
      gap: 1rem;
      width: 100%;
    }
    @media (min-width: 768px) {
      .comparison {
        flex-direction: row;
        gap: 1.5rem;
      }
      .comparison-side {
        width: 50%;
        min-width: 0;
      }
    }

    .comparison-label {
      font-family: 'Inter', sans-serif;
      font-size: 0.8rem;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      color: var(--fg-faint);
      margin-bottom: 0.5rem;
    }

    /* Code blocks — light/dark toggle */
    .ch-pre.ch-dark { display: none; }
    .ch-pre.ch-light { display: block; }
    @media (prefers-color-scheme: dark) {
      .ch-pre.ch-dark { display: block; }
      .ch-pre.ch-light { display: none; }
    }
    .ch-pre {
      border-radius: 8px;
      padding: 0;
      overflow-x: auto;
      font-family: 'IBM Plex Mono', monospace;
      font-size: 0.75rem;
      border: none;
    }
    .ch-pre code {
      font-family: inherit;
    }
    .ch-line {
      display: block;
      padding: 0 0.25rem;
      transition: opacity 0.15s ease;
    }
    .ch-has-focus .ch-line {
      opacity: 0.65;
    }
    .ch-has-focus .ch-line.ch-focused {
      opacity: 1;
    }

    /* Footer */
    .page-footer {
      max-width: 1000px;
      margin: 0 auto;
      padding: 2rem;
      text-align: center;
      border-top: 1px solid var(--border);
      color: var(--fg-faint);
      font-size: 0.9rem;
    }
    .page-footer a {
      color: var(--fg-muted);
      text-decoration: none;
    }
    .page-footer a:hover {
      color: var(--fg);
    }
  `
}
