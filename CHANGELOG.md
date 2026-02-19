# Changelog

## 0.12.0

- Add `DisposableStack` and `AsyncDisposableStack` polyfills for Go-like defer cleanup semantics using TC39 Explicit Resource Management (`using` / `await using`)
  - Works in every runtime — no native DisposableStack support required
  - Provides `defer()`, `use()`, `adopt()`, `move()` methods with LIFO cleanup ordering
  - Includes SuppressedError fallback for error chaining
  - 32 tests covering LIFO ordering, double-dispose safety, error chaining, and errore integration patterns
- Add `/errore-vs-effect` comparison page showing side-by-side code examples of errore vs Effect.ts patterns
  - Server-side syntax highlighting with @code-hike/lighter
  - 25+ sections covering error handling, async, retries, timeouts, cleanup, and architecture patterns
  - Light/dark theme toggle via CSS prefers-color-scheme
- Add benchmarks comparing Effect.gen vs errore performance
  - errore is 3-8x faster in sync loops, 4-7x faster in async
  - Near-zero heap allocations vs Effect's kb-range
- Expand SKILL.md with comprehensive agent-oriented reference
  - 16 self-contained before/after recipe patterns
  - Rules for try/tryAsync boundary placement (use at lowest call stack level only)
  - Flat control flow patterns (avoid nesting, prefer early returns)
  - TypeScript rules for isTruthy filters, AbortController with Error instances, no silent catch blocks
- Add return type inference guidance to SKILL.md
- Add Effect.ts before/after comparison examples to documentation
- Rename `bench/` to `benchmarks/`

## 0.11.0

- Add `fingerprint` property to all tagged errors for stable Sentry/logging error grouping
  - `createTaggedError` errors return `[_tag, messageTemplate]` — groups all instances of the same error class regardless of interpolated values
  - `TaggedError` errors return `[_tag]`
  - Directly usable as `event.fingerprint` in Sentry's `beforeSend` hook
- Add `messageTemplate` property to `createTaggedError` errors — exposes the raw `$variable` template string (e.g. `'User $id not found in $database'`)
- Include `fingerprint` and `messageTemplate` in `toJSON()` output for structured logging
- Guard reserved internal keys (`_tag`, `fingerprint`, `messageTemplate`, `name`, `stack`) from being overwritten by user-provided props or template variables
- Replace `Object.assign(this, args)` in `TaggedError` with key-by-key loop that skips reserved keys
- Add CLI with `errore skill` command to output SKILL.md contents for LLM context

## 0.10.0

- Add `findCause` to walk the `.cause` chain and find an ancestor matching a specific error class (Go's `errors.As` equivalent)
- Available as instance method on all tagged errors (`.findCause(ErrorClass)`) and as standalone function (`errore.findCause(err, ErrorClass)`)
- Returns `T | undefined` for use with optional chaining (`err.findCause(DbError)?.host`)
- Safe against circular `.cause` references
- Add docs for `findCause` in README and SKILL.md
- Add docs for error wrapping with `cause` and custom base class with `extends`

## 0.9.0

- **BREAKING:** rename `_` to `Error` in matchError handlers, fallback now always required
- **fix:** only catch Error instances in tryFn/tryAsync, re-throw non-Error values

## 0.8.2

- replace tsup with **tsc**
- add **declaration source maps**
- include **src** in package

## 0.8.1

- **ESM only** - remove CJS build

## 0.8.0

- Fix **npm exports** - correct ESM/CJS paths (`index.js`/`index.cjs` not `.mjs`)
- Add `createTaggedError` factory with `$variable` message interpolation
- Variables in message templates are automatically extracted and required in constructor
- Supports custom base class via `extends` option
- Recommended pattern: `class MyError extends createTaggedError({...}) {}`

## 0.7.1

- Export `tryFn` as `try` for cleaner API (`errore.try()` instead of `errore.tryFn()`)
- Update README and MIGRATION docs to use `import * as errore` (namespace import preferred over named imports)

## 0.7.0

- Bump to 0.7.0

## 0.6.0

- Switch to NodeNext module resolution
- Add API error handling example
- Add custom base class support to TaggedError
