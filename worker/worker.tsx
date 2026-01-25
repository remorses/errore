import { Hono } from 'hono'
import { html, raw } from 'hono/html'

const app = new Hono()

function css(strings: TemplateStringsArray, ...exprs: any[]): string {
  let result = strings[0] ?? ''
  for (let i = 0; i < exprs.length; i++) {
    result += String(exprs[i]) + (strings[i + 1] ?? '')
  }
  return result
}

const styles = css`
  *,
  *::before,
  *::after {
    box-sizing: border-box;
  }

  :root {
    --color-bg: #f6f5f1;
    --color-text: #2a2a29;
    --color-text-secondary: #3d3d3b;
    --color-text-muted: #5a5856;
    --color-accent: #04a4ba;
    --color-link: #0d7d8c;
    --color-code-bg: #fdfcf9;
    --color-code-border: #e8e6e1;
    --font-serif: 'Source Serif 4', Georgia, serif;
    --font-sans: 'Lato', -apple-system, BlinkMacSystemFont, sans-serif;
    --font-mono: 'IBM Plex Mono', 'SF Mono', Monaco, monospace;
  }

  html {
    font-size: 16px;
  }

  body {
    margin: 0;
    padding: 0;
    background-color: var(--color-bg);
    color: var(--color-text);
    font-family: var(--font-serif);
    line-height: 1.5;
    -webkit-font-smoothing: antialiased;
    -moz-osx-font-smoothing: grayscale;
  }

  main {
    display: grid;
    grid-template-columns: 1fr min(72ch, calc(100% - 48px)) 1fr;
    padding: 4rem 0 6rem;
  }

  main > * {
    grid-column: 2;
  }

  h1 {
    font-family: var(--font-serif);
    font-size: 3.5rem;
    font-weight: 700;
    line-height: 1.1;
    color: var(--color-text);
    margin: 0 0 1rem;
    letter-spacing: -0.02em;
  }

  h2 {
    font-family: var(--font-serif);
    font-size: 2.75rem;
    font-weight: 600;
    line-height: 1.3;
    color: var(--color-text);
    margin: 3rem 0 1.5rem;
  }

  h3 {
    font-family: var(--font-sans);
    font-size: 1.1rem;
    font-weight: 900;
    line-height: 1.5;
    color: var(--color-text-secondary);
    margin: 2rem 0 0.75rem;
    text-transform: uppercase;
    letter-spacing: 0.05em;
  }

  p {
    font-family: var(--font-serif);
    font-size: 1.2rem;
    font-weight: 400;
    line-height: 1.5;
    color: var(--color-text);
    margin: 0 0 1.5rem;
  }

  p.subtitle {
    font-size: 1.5rem;
    font-weight: 500;
    color: var(--color-text-secondary);
    margin-bottom: 2rem;
  }

  p.small {
    font-family: var(--font-sans);
    font-size: 0.9375rem;
    font-weight: 700;
    line-height: 1.6;
    color: var(--color-text-muted);
  }

  a {
    color: var(--color-link);
    text-decoration: none;
    border-bottom: 1px solid transparent;
    transition: border-color 0.2s ease;
    font-weight: 600;
  }

  a:hover {
    border-bottom-color: var(--color-link);
  }

  code[class*='language-'],
  pre[class*='language-'] {
    font-family: var(--font-mono);
    font-size: 0.85rem;
    font-weight: 450;
    line-height: 1.7;
    color: var(--color-text);
    background: none;
    text-shadow: none;
    direction: ltr;
    text-align: left;
    white-space: pre;
    word-spacing: normal;
    word-break: normal;
    tab-size: 2;
    hyphens: none;
  }

  pre[class*='language-'] {
    grid-column: 2 / -1;
    padding: 0.4rem 0;
    margin: 0.5rem 0 1rem;
    overflow: visible;
    background: none;
    border: none;
    box-shadow: none;
  }

  :not(pre) > code {
    font-family: var(--font-mono);
    font-size: 0.8em;
    font-weight: 500;
    background: rgba(0, 0, 0, 0.04);
    padding: 0.1em 0.35em;
    border-radius: 4px;
    color: var(--color-text);
  }

  .token.comment,
  .token.prolog,
  .token.doctype,
  .token.cdata {
    color: #8b9298;
    font-style: italic;
  }

  .token.punctuation {
    color: #5c6773;
  }

  .token.property,
  .token.tag,
  .token.boolean,
  .token.number,
  .token.constant,
  .token.symbol,
  .token.deleted {
    color: #c75d5d;
  }

  .token.selector,
  .token.attr-name,
  .token.string,
  .token.char,
  .token.builtin,
  .token.inserted {
    color: #598c4a;
  }

  .token.operator,
  .token.entity,
  .token.url,
  .language-css .token.string,
  .style .token.string {
    color: #a67f59;
  }

  .token.atrule,
  .token.attr-value,
  .token.keyword {
    color: #7c5dc7;
  }

  .token.function,
  .token.class-name {
    color: #3c7fc1;
  }

  .token.regex,
  .token.important,
  .token.variable {
    color: #e07c46;
  }

  ul, ol {
    padding: 0;
    margin: 0 0 1.5rem 1.5rem;
  }

  ol {
    list-style: decimal;
  }

  li {
    font-family: var(--font-serif);
    font-size: 1.2rem;
    font-weight: 400;
    line-height: 1.5;
    margin-bottom: 0.75rem;
  }

  li strong {
    font-weight: 700;
    color: var(--color-text);
  }

  .intro-letter {
    float: left;
    font-size: 5.2rem;
    line-height: 2.5rem;
    font-weight: 700;
    margin: 1.15rem 0.25rem 0 0;
    color: var(--color-text);
  }

  .tag {
    display: inline-block;
    font-family: var(--font-sans);
    font-size: 0.75rem;
    font-weight: 900;
    text-transform: uppercase;
    letter-spacing: 0.06em;
    color: var(--color-accent);
    margin-bottom: 1rem;
  }

  footer {
    text-align: center;
    padding: 3rem 1.5rem 4rem;
    font-family: var(--font-sans);
    font-size: 0.9rem;
    font-weight: 600;
    color: var(--color-text-muted);
  }

  footer pre[class*='language-'] {
    display: flex;
    justify-content: center;
    padding: 0.5rem 0;
    margin: 0 0 1rem;
  }

  footer a {
    color: var(--color-text-secondary);
  }

  footer a:hover {
    color: var(--color-link);
  }

  @media (max-width: 768px) {
    h1 {
      font-size: 2.5rem;
    }

    h2 {
      font-size: 2rem;
    }

    p,
    li {
      font-size: 1.1rem;
      line-height: 1.45;
    }

    pre[class*='language-'] {
      grid-column: 2;
      padding: 0.3rem 0;
      font-size: 0.8rem;
    }

    .intro-letter {
      font-size: 4rem;
      line-height: 2rem;
    }
  }
`

// The hook - instant understanding
const codeHook = `const user = await getUser(id)
if (user instanceof Error) return user
console.log(user.name)`

// Why this works
const codeWhyItWorks = `// The return type tells the truth
async function getUser(id: string): Promise<NotFoundError | User> {
  const user = await db.find(id)
  if (!user) return new NotFoundError({ id })
  return user
}`

// Compile error example
const codeCompileError = `const user = await getUser(id)
console.log(user.name)
//                ~~~~
// Error: Property 'name' does not exist on type 'NotFoundError'`

// Expression vs block
const codeExpressionVsBlock = `// With errore: error handling is an expression
const config = parseConfig(input)
if (config instanceof Error) return config
const db = connectDB(config.dbUrl)
if (db instanceof Error) return db

// BAD: with try-catch, error handling is a block
let config: Config
let db: Database
try {
  config = parseConfig(input)
  db = connectDB(config.dbUrl)
} catch (e) {
  ...
}`

// Go comparison
const codeGoComparison = `// Go: you can forget to check err
user, err := fetchUser(id)
fmt.Println(user.Name)  // Compiles fine. Crashes at runtime.

// TypeScript + errore: you cannot forget
const user = await fetchUser(id)
console.log(user.name)  // Won't compile until you handle the error.`

// Null handling
const codeNullHandling = `// Errors and nulls work together naturally
function findUser(id: string): NotFoundError | User | null {
  if (id === 'invalid') return new NotFoundError({ id })
  if (id === 'missing') return null
  return { id, name: 'Alice' }
}

const user = findUser(id)
if (user instanceof Error) return user
const name = user?.name ?? 'Guest'`

// Tagged errors
const codeTaggedErrors = `class NotFoundError extends errore.createTaggedError({
  name: 'NotFoundError',
  message: 'User $id not found'
}) {}

class NetworkError extends errore.createTaggedError({
  name: 'NetworkError', 
  message: 'Request to $url failed'
}) {}

const err = new NotFoundError({ id: '123' })
err.message  // "User 123 not found"
err.id       // "123"`

// Pattern matching
const codePatternMatch = `// Exhaustive matching - compiler errors if you miss a case
const message = errore.matchError(error, {
  NotFoundError: e => \`User \${e.id} not found\`,
  NetworkError: e => \`Failed to reach \${e.url}\`,
  Error: e => \`Unexpected: \${e.message}\`
})

// Forgot NotFoundError? TypeScript complains:
errore.matchError(error, {
  NetworkError: e => \`...\`,
  Error: e => \`...\`
})
// TS Error: Property 'NotFoundError' is missing in type '{ NetworkError: ...; Error: ...; }'`

// instanceof checking
const codeInstanceofExhaustive = `async function getUser(id: string): Promise<NotFoundError | NetworkError | ValidationError | User>

const user = await getUser(id)
if (user instanceof NotFoundError) return 'not found'
if (user instanceof NetworkError) return 'network issue'
// Forgot ValidationError? TypeScript knows:
return user.name
//     ~~~~
// TS Error: Property 'name' does not exist on type 'ValidationError'`

// Migration: try-catch
const codeMigrationBefore = `try {
  const user = await getUser(id)
  const posts = await getPosts(user.id)
  const enriched = await enrichPosts(posts)
  return enriched
} catch (e) {
  if (e instanceof NotFoundError) { console.warn('User not found', id); return null }
  if (e instanceof NetworkError) { console.error('Network failed', e.url); return null }
  if (e instanceof RateLimitError) { console.warn('Rate limited'); return null }
  throw e  // unknown error, hope someone catches it
}`

const codeMigrationAfter = `const user = await getUser(id)
if (user instanceof NotFoundError) { console.warn('User not found', id); return null }
if (user instanceof NetworkError) { console.error('Network failed', user.url); return null }

const posts = await getPosts(user.id)
if (posts instanceof NetworkError) { console.error('Network failed', posts.url); return null }
if (posts instanceof RateLimitError) { console.warn('Rate limited'); return null }

const enriched = await enrichPosts(posts)
if (enriched instanceof Error) { console.error('Processing failed', enriched); return null }

return enriched`

// Migration: parallel operations
const codeMigrationParallelBefore = `try {
  const [user, posts, stats] = await Promise.all([
    getUser(id),
    getPosts(id),
    getStats(id)
  ])
  return { user, posts, stats }
} catch (e) {
  // Which one failed? No idea.
  console.error('Something failed', e)
  return null
}`

const codeMigrationParallelAfter = `const [user, posts, stats] = await Promise.all([
  getUser(id),
  getPosts(id),
  getStats(id)
])

if (user instanceof Error) { console.error('User fetch failed', user); return null }
if (posts instanceof Error) { console.error('Posts fetch failed', posts); return null }
if (stats instanceof Error) { console.error('Stats fetch failed', stats); return null }

return { user, posts, stats }`

// Migration: wrapping external libs
const codeMigrationWrapBefore = `function parseConfig(input: string): Config {
  return JSON.parse(input)  // throws on invalid JSON
}`

const codeMigrationWrapAfter = `function parseConfig(input: string): ParseError | Config {
  const result = errore.try(() => JSON.parse(input))
  if (result instanceof Error) return new ParseError({ reason: result.message })
  return result
}`

// Migration: validation
const codeMigrationValidateBefore = `function createUser(input: unknown): User {
  if (!input.email) throw new Error('Email required')
  if (!input.name) throw new Error('Name required')
  return { email: input.email, name: input.name }
}`

const codeMigrationValidateAfter = `function createUser(input: unknown): ValidationError | User {
  if (!input.email) return new ValidationError({ field: 'email', reason: 'required' })
  if (!input.name) return new ValidationError({ field: 'name', reason: 'required' })
  return { email: input.email, name: input.name }
}`

// Why not neverthrow / better-result
const codeNeverthrow = `// neverthrow / better-result
import { ok, err, Result } from 'neverthrow'

function getUser(id: string): Result<User, NotFoundError> {
  const user = db.find(id)
  if (!user) return err(new NotFoundError({ id }))
  return ok(user)  // must wrap
}

const result = getUser('123')
if (result.isErr()) {
  console.log(result.error)  // must unwrap
  return
}
console.log(result.value.name)  // must unwrap`

const codeNeverthrowErrore = `// errore
function getUser(id: string): User | NotFoundError {
  const user = db.find(id)
  if (!user) return new NotFoundError({ id })
  return user  // just return
}

const user = getUser('123')
if (user instanceof Error) {
  console.log(user)  // it's already the error
  return
}
console.log(user.name)  // it's already the user`

// Zero dependency example
const codeZeroDep = `// You can write this without installing errore at all
class NotFoundError extends Error {
  readonly _tag = 'NotFoundError'
  constructor(public id: string) {
    super(\`User \${id} not found\`)
  }
}

async function getUser(id: string): Promise<User | NotFoundError> {
  const user = await db.find(id)
  if (!user) return new NotFoundError(id)
  return user
}

const user = await getUser('123')
if (user instanceof Error) return user
console.log(user.name)`

// Effect comparison
const codeEffect = `// Effect.ts - a paradigm shift
import { Effect, pipe } from 'effect'

const program = pipe(
  fetchUser(id),
  Effect.flatMap(user => fetchPosts(user.id)),
  Effect.map(posts => posts.filter(p => p.published)),
  Effect.catchTag('NotFoundError', () => Effect.succeed([]))
)

const result = await Effect.runPromise(program)`

const codeEffectErrore = `// errore - regular TypeScript
const user = await fetchUser(id)
if (user instanceof Error) return []

const posts = await fetchPosts(user.id)
if (posts instanceof Error) return []

return posts.filter(p => p.published)`

// Perfect for libraries
const codeLibraryBad = `// ❌ Library that forces a dependency
import { Result } from 'some-result-lib'
export function parse(input: string): Result<AST, ParseError>

// Users must install and learn 'some-result-lib'`

const codeLibraryGood = `// ✓ Library using plain TypeScript unions
export function parse(input: string): AST | ParseError

// Users handle errors with standard instanceof
// No new dependencies, no new concepts`





function Page() {
  return html`
    <!DOCTYPE html>
    <html lang="en">
      <head>
        <meta charset="UTF-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <title>Errore - Errors as Values in TypeScript</title>
        <meta name="description" content="A manifesto for type-safe error handling in TypeScript. Errors as values, not exceptions." />
        <meta property="og:title" content="Errore - Errors as Values" />
        <meta property="og:description" content="A manifesto for type-safe error handling in TypeScript. Errors as values, not exceptions." />
        <meta property="og:type" content="website" />
        <meta property="og:url" content="https://errore.org" />
        <meta property="og:image" content="https://raw.githubusercontent.com/remorses/errore/main/og-image.png" />
        <meta property="og:image:width" content="1200" />
        <meta property="og:image:height" content="630" />
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:title" content="Errore - Errors as Values" />
        <meta name="twitter:description" content="A manifesto for type-safe error handling in TypeScript. Errors as values, not exceptions." />
        <meta name="twitter:image" content="https://raw.githubusercontent.com/remorses/errore/main/og-image.png" />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
        <link href="https://fonts.googleapis.com/css2?family=Source+Serif+4:ital,opsz,wght@0,8..60,400;0,8..60,500;0,8..60,600;0,8..60,700;1,8..60,400;1,8..60,500&family=Lato:wght@400;700;900&display=swap" rel="stylesheet" />
        <link href="https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;500&display=swap" rel="stylesheet" />
        <link href="https://cdnjs.cloudflare.com/ajax/libs/prism/1.29.0/themes/prism.min.css" rel="stylesheet" />
        <style>${raw(styles)}</style>
      </head>
      <body>
        <main>
          <span class="tag">Manifesto</span>
          <h1>Errors as Values in TypeScript</h1>
          <p class="subtitle">No wrappers. No exceptions. Just unions.</p>

          <p><span class="intro-letter">E</span>rrors are not exceptional—they are inevitable. Instead of throwing exceptions and hoping someone catches them, return errors as values. Make them part of the type signature. Let the compiler enforce that every error is handled.</p>

          <pre class="language-typescript"><code class="language-typescript">${codeHook}</code></pre>

          <p>Functions return errors in their type signature. Callers check with <code>instanceof Error</code>. TypeScript narrows the type automatically. That's it.</p>

          <pre class="language-typescript"><code class="language-typescript">${codeWhyItWorks}</code></pre>

          <p><strong>If you forget to handle the error, your code won't compile:</strong></p>

          <pre class="language-typescript"><code class="language-typescript">${codeCompileError}</code></pre>

          <p>This gives you:</p>

          <ol>
            <li><strong>Compile-time safety.</strong> Unhandled errors are caught by TypeScript, not by your users in production.</li>
            <li><strong>Self-documenting signatures.</strong> The return type shows exactly what can go wrong. No need to read the implementation or hope for documentation.</li>
            <li><strong>Error handling as expressions.</strong> No more <code>let x; try { x = fn() } catch...</code>. Fewer variables, less nesting, errors handled where they occur.</li>
            <li><strong>Trackable error flow.</strong> Create custom error classes. Trace them through your codebase. Like Effect, but without the learning curve.</li>
          </ol>

          <p><strong>Expressions instead of blocks.</strong> Error handling stays linear:</p>

          <pre class="language-typescript"><code class="language-typescript">${codeExpressionVsBlock}</code></pre>

          <p><strong>Better than Go.</strong> This is Go-style error handling—errors as values, not exceptions. But with one key difference: Go's two return values let you ignore the error and use the value anyway. A single union makes that impossible:</p>

          <pre class="language-typescript"><code class="language-typescript">${codeGoComparison}</code></pre>

          <p><strong>Errors and nulls together.</strong> Use <code>?.</code> and <code>??</code> naturally:</p>

          <pre class="language-typescript"><code class="language-typescript">${codeNullHandling}</code></pre>

          <h2>Tagged Errors</h2>

          <p>For more structure, create typed errors with <code>$variable</code> interpolation:</p>

          <pre class="language-typescript"><code class="language-typescript">${codeTaggedErrors}</code></pre>

          <p><strong>Pattern match with <code>matchError</code>.</strong> It's exhaustive—the compiler errors if you forget to handle a case:</p>

          <pre class="language-typescript"><code class="language-typescript">${codePatternMatch}</code></pre>

          <p><strong>Same with <code>instanceof</code>.</strong> TypeScript tracks which errors you've handled. Forget one, and it won't compile:</p>

          <pre class="language-typescript"><code class="language-typescript">${codeInstanceofExhaustive}</code></pre>

          <p>This guarantees every error flow is handled. No silent failures. No forgotten edge cases.</p>

          <h2>Migration</h2>

          <p><strong>try-catch with multiple error types:</strong></p>
          <pre class="language-typescript"><code class="language-typescript">${codeMigrationBefore}</code></pre>
          <pre class="language-typescript"><code class="language-typescript">${codeMigrationAfter}</code></pre>

          <p><strong>Parallel operations with Promise.all:</strong></p>
          <pre class="language-typescript"><code class="language-typescript">${codeMigrationParallelBefore}</code></pre>
          <pre class="language-typescript"><code class="language-typescript">${codeMigrationParallelAfter}</code></pre>

          <p><strong>Wrapping libraries that throw:</strong></p>
          <pre class="language-typescript"><code class="language-typescript">${codeMigrationWrapBefore}</code></pre>
          <pre class="language-typescript"><code class="language-typescript">${codeMigrationWrapAfter}</code></pre>

          <p><strong>Validation:</strong></p>
          <pre class="language-typescript"><code class="language-typescript">${codeMigrationValidateBefore}</code></pre>
          <pre class="language-typescript"><code class="language-typescript">${codeMigrationValidateAfter}</code></pre>

          <h2>Vs neverthrow / better-result</h2>

          <p>These libraries wrap values in a <code>Result&lt;T, E&gt;</code> container. You construct with <code>ok()</code> and <code>err()</code>, then unwrap with <code>.value</code> and <code>.error</code>:</p>

          <pre class="language-typescript"><code class="language-typescript">${codeNeverthrow}</code></pre>

          <pre class="language-typescript"><code class="language-typescript">${codeNeverthrowErrore}</code></pre>

          <p><strong>The key insight:</strong> <code>T | Error</code> already encodes success/failure. TypeScript's type narrowing does the rest. No wrapper needed.</p>

          <p>neverthrow requires an <a href="https://github.com/mdbetancourt/eslint-plugin-neverthrow">eslint plugin</a> to catch unhandled results. With errore, TypeScript itself prevents using a value without checking the error first.</p>

          <h2>Vs Effect.ts</h2>

          <p>Effect is not just error handling—it's a complete functional programming framework with dependency injection, concurrency, resource management, and more:</p>

          <pre class="language-typescript"><code class="language-typescript">${codeEffect}</code></pre>

          <pre class="language-typescript"><code class="language-typescript">${codeEffectErrore}</code></pre>

          <p><strong>Use Effect</strong> when you want DI, structured concurrency, and the full FP experience. <strong>Use errore</strong> when you just want type-safe errors without rewriting your codebase.</p>

          <h2>Zero-Dependency Philosophy</h2>

          <p>errore is more a <strong>way of writing code</strong> than a library. The core pattern requires nothing:</p>

          <pre class="language-typescript"><code class="language-typescript">${codeZeroDep}</code></pre>

          <p>The <code>errore</code> package provides conveniences: <code>createTaggedError</code> for less boilerplate, <code>matchError</code> for exhaustive matching, <code>tryAsync</code> for catching exceptions. But the pattern—<strong>errors as union types</strong>—works with zero dependencies.</p>

          <h3>Perfect for Libraries</h3>

          <p>This approach is ideal for library authors. Instead of forcing users to adopt your error handling framework:</p>

          <pre class="language-typescript"><code class="language-typescript">${codeLibraryBad}</code></pre>

          <pre class="language-typescript"><code class="language-typescript">${codeLibraryGood}</code></pre>

          <p>Your library stays lightweight. Users get type-safe errors without adopting an opinionated wrapper.</p>
        </main>

        <footer>
          <pre class="language-bash"><code class="language-bash">npm install errore</code></pre>
          <p><a href="https://github.com/remorses/errore">GitHub</a> · Made by <a href="https://github.com/remorses">remorses</a></p>
        </footer>

        <script src="https://cdnjs.cloudflare.com/ajax/libs/prism/1.29.0/prism.min.js"></script>
        <script src="https://cdnjs.cloudflare.com/ajax/libs/prism/1.29.0/components/prism-typescript.min.js"></script>
        <script src="https://cdnjs.cloudflare.com/ajax/libs/prism/1.29.0/components/prism-bash.min.js"></script>
      </body>
    </html>
  `
}

app.get('*', (c) => {
  const url = new URL(c.req.url)

  // Redirect www to non-www
  if (url.hostname === 'www.errore.org') {
    url.hostname = 'errore.org'
    return c.redirect(url.toString(), 301)
  }

  return c.html(Page())
})

export default app
