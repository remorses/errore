// Server-side syntax highlighting using @code-hike/lighter.
// Parses focus annotations (// !focus, # !focus) from code comments,
// highlights with lighter, and renders to HTML strings with focus dimming.
// Renders both light and dark themes, toggled via CSS prefers-color-scheme.

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

function renderLines(
  lines: { style?: { color?: string }; content: string }[][],
  focusedLines: Set<number>,
  hasFocus: boolean,
): string {
  return lines
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
}

/**
 * Highlight code and render to an HTML string.
 * Renders both light and dark variants, toggled via CSS.
 * If focus annotations are present, unfocused lines get dimmed.
 */
export async function highlightCode(
  code: string,
  lang: string = 'typescript',
): Promise<string> {
  const { cleanedCode, focusedLines } = parseFocusAnnotations(code)
  const hasFocus = focusedLines.size > 0
  const focusClass = hasFocus ? ' ch-has-focus' : ''

  const [dark, light] = await Promise.all([
    lighterHighlight(cleanedCode, lang, 'github-dark'),
    lighterHighlight(cleanedCode, lang, 'github-light'),
  ])

  const darkHtml = renderLines(dark.lines, focusedLines, hasFocus)
  const lightHtml = renderLines(light.lines, focusedLines, hasFocus)

  const darkFg = dark.style?.color || '#e1e4e8'
  const lightFg = light.style?.color || '#24292e'

  return `<pre class="ch-pre ch-dark${focusClass}" style="background:var(--bg);color:${darkFg}"><code>${darkHtml}</code></pre><pre class="ch-pre ch-light${focusClass}" style="background:var(--bg);color:${lightFg}"><code>${lightHtml}</code></pre>`
}
