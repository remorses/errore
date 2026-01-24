const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Errore - Errors as Values in TypeScript</title>
  <meta name="description" content="A manifesto for type-safe error handling in TypeScript. Errors as values, not exceptions.">
  <meta property="og:title" content="Errore - Errors as Values">
  <meta property="og:description" content="A manifesto for type-safe error handling in TypeScript. Errors as values, not exceptions.">
  <meta property="og:type" content="website">
  <meta property="og:url" content="https://errore.org">
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Source+Serif+4:ital,opsz,wght@0,8..60,400;0,8..60,500;0,8..60,600;0,8..60,700;1,8..60,400;1,8..60,500&family=Lato:wght@400;700;900&display=swap" rel="stylesheet">
  <link href="https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;500&display=swap" rel="stylesheet">
  <link href="https://cdnjs.cloudflare.com/ajax/libs/prism/1.29.0/themes/prism.min.css" rel="stylesheet">
  <style>
    *, *::before, *::after {
      box-sizing: border-box;
    }

    :root {
      --color-bg: #f6f5f1;
      --color-text: #2a2a29;
      --color-text-secondary: #3d3d3b;
      --color-text-muted: #5a5856;
      --color-accent: #04A4BA;
      --color-link: #0d7d8c;
      --color-code-bg: #fdfcf9;
      --color-code-border: #e8e6e1;
      --font-serif: "Source Serif 4", Georgia, serif;
      --font-sans: "Lato", -apple-system, BlinkMacSystemFont, sans-serif;
      --font-mono: "IBM Plex Mono", "SF Mono", Monaco, monospace;
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

    /* Prism overrides for light theme */
    code[class*="language-"],
    pre[class*="language-"] {
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

    pre[class*="language-"] {
      grid-column: 1 / -1;
      display: flex;
      justify-content: center;
      padding: 2.5rem 1.5rem;
      margin: 1.5rem 0 2rem;
      overflow: visible;
      background: none;
      border: none;
      box-shadow: none;
    }

    pre[class*="language-"] code {
      text-align: left;
    }

    :not(pre) > code {
      font-family: var(--font-mono);
      font-size: 0.875em;
      font-weight: 500;
      background: rgba(0, 0, 0, 0.04);
      padding: 0.2em 0.45em;
      border-radius: 5px;
      color: var(--color-text);
    }

    /* Prism token colors - elegant light theme */
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

    ul {
      padding: 0;
      margin: 0 0 1.5rem 1.5rem;
    }

    li {
      font-family: var(--font-serif);
      font-size: 1.2rem;
      font-weight: 400;
      line-height: 1.5;
      margin-bottom: 0.5rem;
    }

    li strong {
      font-weight: 700;
      color: var(--color-text);
    }

    hr {
      border: none;
      height: 3px;
      background-color: var(--color-accent);
      width: 20%;
      margin: 3rem auto;
    }

    blockquote {
      text-align: center;
      padding: 2rem 0;
      margin: 2rem 0;
    }

    blockquote p {
      font-style: italic;
      font-size: 1.5rem;
      font-weight: 600;
      max-width: 36ch;
      margin: 0 auto;
      line-height: 1.6;
    }

    blockquote::before,
    blockquote::after {
      content: "";
      display: block;
      margin: 0 auto 1rem;
      width: 3rem;
      border-top: 2px solid rgba(0, 0, 0, 0.1);
    }

    blockquote::after {
      margin: 1rem auto 0;
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

    footer pre[class*="language-"] {
      padding: 1.5rem 1rem;
      margin: 0 0 1.5rem;
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

      p, li {
        font-size: 1.1rem;
        line-height: 1.45;
      }

      pre[class*="language-"] {
        padding: 2rem 1rem;
        font-size: 0.8rem;
      }

      .intro-letter {
        font-size: 4rem;
        line-height: 2rem;
      }
    }
  </style>
</head>
<body>
  <main>
    <span class="tag">Manifesto</span>
    <h1>Errors as Values in TypeScript</h1>
    <p class="subtitle">A different way to handle errors in TypeScript</p>

    <p><span class="intro-letter">E</span>xceptions are a lie we tell ourselves. We pretend our code won't fail, wrapping everything in try-catch blocks as an afterthought, hoping for the best. But errors are not exceptional—they are inevitable, predictable, and deserve to be treated as first-class citizens in our type system.</p>

    <p>Errore is a TypeScript library that brings the elegance of Go's error handling to the JavaScript ecosystem. Instead of throwing exceptions into the void, we return them. Instead of hoping someone catches our errors, we make them impossible to ignore.</p>

    <h2>The Problem with Exceptions</h2>

    <p>Traditional exception handling creates invisible control flow. When you call a function, you have no idea if it might throw. The type signature lies to you—it promises a return value but might deliver an explosion instead.</p>

    <pre class="language-typescript"><code class="language-typescript">// This function lies. It says it returns a User.
// But it might throw. You'd never know from the types.
async function getUser(id: string): Promise&lt;User&gt; {
  const response = await fetch(\`/api/users/\${id}\`);
  if (!response.ok) throw new Error('User not found');
  return response.json();
}</code></pre>

    <p>Every function that might throw creates a hidden dependency. Every caller must know, somehow, that this innocent-looking function could blow up their entire call stack.</p>

    <h2>The Solution: Errors as Values</h2>

    <p>With errore, errors become visible. They're part of the function signature. They're impossible to accidentally ignore.</p>

    <pre class="language-typescript"><code class="language-typescript">import { err, ok, Result } from 'errore';

// This function tells the truth. It returns User or an error.
async function getUser(id: string): Promise&lt;Result&lt;User, NotFoundError&gt;&gt; {
  const response = await fetch(\`/api/users/\${id}\`);
  if (!response.ok) return err(new NotFoundError(id));
  return ok(await response.json());
}</code></pre>

    <p>Now the caller knows exactly what they're dealing with. The type system enforces that they handle both success and failure cases.</p>

    <h2>Why This Matters</h2>

    <ul>
      <li><strong>Type safety</strong> — Errors are part of the type signature, not hidden surprises</li>
      <li><strong>Explicit handling</strong> — You must acknowledge errors; you cannot accidentally ignore them</li>
      <li><strong>Composability</strong> — Chain operations cleanly with map, flatMap, and other combinators</li>
      <li><strong>Predictability</strong> — No more wondering "does this throw?" The types tell you everything</li>
    </ul>

  </main>

  <footer>
    <pre class="language-bash"><code class="language-bash">npm install errore</code></pre>
    <p><a href="https://github.com/remorses/errore">GitHub</a> · Made by <a href="https://github.com/remorses">remorses</a></p>
  </footer>

  <script src="https://cdnjs.cloudflare.com/ajax/libs/prism/1.29.0/prism.min.js"></script>
  <script src="https://cdnjs.cloudflare.com/ajax/libs/prism/1.29.0/components/prism-typescript.min.js"></script>
  <script src="https://cdnjs.cloudflare.com/ajax/libs/prism/1.29.0/components/prism-bash.min.js"></script>
</body>
</html>`;

export default {
  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);

    // Redirect www to non-www
    if (url.hostname === 'www.errore.org') {
      url.hostname = 'errore.org';
      return Response.redirect(url.toString(), 301);
    }

    return new Response(html, {
      headers: {
        'Content-Type': 'text/html;charset=UTF-8',
        'Cache-Control': 'public, max-age=3600',
      },
    });
  },
};
