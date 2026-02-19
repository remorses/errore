// Server-side syntax highlighting using @code-hike/lighter.
// Parses focus annotations (// !focus, # !focus) from code comments,
// highlights with lighter, and renders to HTML strings with focus dimming.

import { highlight as lighterHighlight } from '@code-hike/lighter'

interface FocusResult {
  cleanedCode: string
  focusedLines: Set<number>
}

/**
 * Parse focus annotations from code lines.
 * Supports:
 *   // !focus         → focus the next line
 *   // !focus(1:N)    → focus the next N lines
 *   # !focus          → same for bash/python
 *   # !focus(1:N)
 *
 * The annotation comment line itself is stripped from the output.
 */
export function parseFocusAnnotations(code: string): FocusResult {
  const lines = code.split('\n')
  const focusedLines = new Set<number>()
  const cleanedLines: string[] = []

  const focusRegex = /^\s*(?:\/\/|#)\s*!focus(?:\((\d+):(\d+)\))?\s*$/

  let outputLineNumber = 0
  for (let i = 0; i < lines.length; i++) {
    const match = lines[i].match(focusRegex)
    if (match) {
      const start = match[1] ? parseInt(match[1], 10) : 1
      const end = match[2] ? parseInt(match[2], 10) : 1
      for (let j = 0; j < end - start + 1; j++) {
        focusedLines.add(outputLineNumber + j)
      }
    } else {
      cleanedLines.push(lines[i])
      outputLineNumber++
    }
  }

  return {
    cleanedCode: cleanedLines.join('\n'),
    focusedLines,
  }
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

/**
 * Highlight code and render to an HTML string.
 * Returns a <pre><code> block with inline styles from the theme.
 * If focus annotations are present, unfocused lines get dimmed.
 */
export async function highlightCode(
  code: string,
  lang: string = 'typescript',
  theme: string = 'github-dark',
): Promise<string> {
  const { cleanedCode, focusedLines } = parseFocusAnnotations(code)
  const hasFocus = focusedLines.size > 0

  const { lines, style } = await lighterHighlight(cleanedCode, lang, theme)

  const linesHtml = lines
    .map((tokens, lineIndex) => {
      const isFocused = focusedLines.has(lineIndex)
      const lineClass = hasFocus
        ? isFocused
          ? 'ch-line ch-focused'
          : 'ch-line'
        : 'ch-line'

      const tokensHtml = tokens
        .map((token) => {
          const color = token.style?.color
          const content = escapeHtml(token.content)
          return color
            ? `<span style="color:${color}">${content}</span>`
            : `<span>${content}</span>`
        })
        .join('')

      return `<span class="${lineClass}">${tokensHtml}\n</span>`
    })
    .join('')

  const bg = style?.background || '#24292e'
  const fg = style?.color || '#e1e4e8'

  return `<pre class="ch-pre${hasFocus ? ' ch-has-focus' : ''}" style="background:${bg};color:${fg}"><code>${linesHtml}</code></pre>`
}
