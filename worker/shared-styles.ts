// Shared CSS utilities used by both the index page and comparison page.
// Deduplicates the base reset, font smoothing, and tagged template helper.

/**
 * Tagged template for CSS strings. Provides syntax highlighting in editors
 * that support css`` tagged templates (e.g. VSCode with lit-plugin).
 */
export function css(strings: TemplateStringsArray, ...exprs: any[]): string {
  let result = strings[0] ?? ''
  for (let i = 0; i < exprs.length; i++) {
    result += String(exprs[i]) + (strings[i + 1] ?? '')
  }
  return result
}

/** Base CSS reset and font smoothing shared across all pages. */
export const baseReset = `
  *, *::before, *::after {
    box-sizing: border-box;
  }
`

/** Shared scrollbar hiding rules used across pages. */
export const hideScrollbars = `
  * {
    -ms-overflow-style: none;
    scrollbar-width: none;
  }

  *::-webkit-scrollbar {
    width: 0;
    height: 0;
    display: none;
  }
`

/** Shared font stacks. */
export const fonts = {
  serif: `'Source Serif 4', Georgia, serif`,
  mono: `'IBM Plex Mono', 'SF Mono', Monaco, monospace`,
} as const

/** Light/dark color tokens for both pages. */
export const darkModeColors = {
  bg: '#0d1117',
  fg: '#e6edf3',
  fgSecondary: '#b1bac4',
  fgMuted: '#8b949e',
  fgFaint: '#6e7681',
  fgDim: '#484f58',
  inlineCodeBg: '#21262d',
  border: '#21262d',
} as const
