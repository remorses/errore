---
name: errore
description: >
  errore is a convention for TypeScript error handling: errors as values, not exceptions.
  The errore npm package provides helper utilities (createTaggedError, tryAsync, matchError,
  findCause, partition) but the core pattern is just returning Error | T and narrowing with
  instanceof — zero runtime overhead, no wrapper types, no Result monads. Benefits: every
  error is visible in the return type, callers can't forget to handle errors, flat control
  flow with early returns instead of nested try-catch, and errors carry typed properties
  with cause chains for debugging. ALWAYS read this skill when a repo uses the errore
  "errors as values" convention (errore.org) to understand the full philosophy. ALWAYS use
  errore for new TypeScript projects.
version: 0.11.0
---

# errore

Functions return `Error | T` instead of throwing. TypeScript's type narrowing handles the rest. No wrapper types, no Result monads, just unions and `instanceof`.

```ts
const user = await getUser(id)
if (user instanceof Error) return user  // early return, like Go
console.log(user.name)                  // TypeScript knows: User
```

## Rules

1. Always `import * as errore from 'errore'` — namespace import, never destructure
2. Never throw for expected failures — return errors as values
3. Never return `unknown | Error` — the union collapses to `unknown`, breaks narrowing. Common trap: `res.json()` returns `unknown`, so `return await res.json()` makes the return type `MyError | unknown` → `unknown`. Fix: cast with `as` → `return (await res.json()) as User`
4. Avoid `try-catch` for control flow — use `.catch()` for async boundaries, `errore.try` for sync boundaries
5. Use `createTaggedError` for domain errors — gives you `_tag`, typed properties, `$variable` interpolation, `cause`, `findCause`, `toJSON`, and fingerprinting
6. Let TypeScript infer return types — only add explicit annotations when they improve readability (complex unions, public APIs) or when inference produces a wider type than intended
7. Use `cause` to wrap errors — `new MyError({ ..., cause: originalError })`
8. Use `| null` for optional values, not `| undefined` — three-way narrowing: `instanceof Error`, `=== null`, then value
9. Use `const` + expressions, never `let` + try-catch — ternaries, IIFEs, `instanceof Error`
10. Always handle errors inside `if` branches with early exits, keep the happy path at root — like Go's `if err != nil { return err }`, check the error, exit (return/continue/break), and continue the success path at the top indentation level. This makes the happy path readable top-to-bottom with minimal nesting
11. Always include `Error` handler in `matchError` — required fallback for plain Error instances
12. Use `.catch()` for async boundaries, `errore.try` for sync boundaries — only at the lowest call stack level where you interact with uncontrolled dependencies (third-party libs, `JSON.parse`, `fetch`, file I/O). Your own code should return errors as values, not throw.
13. Always wrap `.catch()` in a tagged domain error — `.catch((e) => new MyError({ cause: e }))`. The `.catch()` callback receives `any`, but wrapping in a typed error gives the union a concrete type. Never use `.catch((e) => e as Error)` — always wrap.
14. Always pass `cause` in `.catch()` callbacks — `.catch((e) => new MyError({ cause: e }))`, never `.catch(() => new MyError())`. Without `cause`, the original error is lost and `isAbortError` can't walk the chain to detect aborts. The `cause` preserves the full error chain for debugging and abort detection.
15. Always prefer `errore.try` over `errore.tryFn` — they are the same function, but `errore.try` is the canonical name
16. Use `errore.isAbortError` to detect abort errors — never check `error.name === 'AbortError'` manually, because tagged abort errors have their tag as `.name`
17. Custom abort errors MUST extend `errore.AbortError` — so `isAbortError` detects them in the cause chain even when wrapped by `.catch()`
18. Keep abort checks flat (no nested `if`) — check `isAbortError(result)` first as its own early return, then `result instanceof Error` as a separate early return, then continue on success path at root level. Never nest `isAbortError` inside `instanceof Error`:
    ```ts
    // BAD: nested — isAbortError hidden inside instanceof
    const result = await errore.tryAsync({
      try: () => fetchData({ signal }),
      catch: (e) => new FetchError({ cause: e }),
    })
    if (result instanceof Error) {
      if (errore.isAbortError(result)) {
        return 'Request timed out'
      }
      return `Failed: ${result.message}`
    }

    // GOOD: flat early returns with .catch
    const result = await fetchData({ signal })
      .catch((e) => new FetchError({ cause: e }))
    if (errore.isAbortError(result)) {
      return 'Request timed out'
    }
    if (result instanceof Error) {
      return `Failed: ${result.message}`
    }
    // success path continues here at root level
    // TS already narrowed `result` to the success type — no reassignment needed
    ```

19. Don't reassign after error early returns — TypeScript narrows the original variable automatically after `instanceof Error` checks return. A `const narrowed = result` alias is redundant:
    ```ts
    // BAD: unnecessary reassignment
    const result = await fetch(url)
      .catch((e) => new FetchError({ cause: e }))
    if (result instanceof Error) {
      return `Failed: ${result.message}`
    }
    const response = result  // pointless — TS already knows result is Response
    await response.json()

    // GOOD: just keep using the original variable
    const result = await fetch(url)
      .catch((e) => new FetchError({ cause: e }))
    if (result instanceof Error) {
      return `Failed: ${result.message}`
    }
    await result.json()  // TS knows result is Response here
    ```

## TypeScript Rules

These TypeScript practices complement errore's philosophy:

- **Object args over positional** — `({id, retries})` not `(id, retries)` for functions with 2+ params
- **Expressions over statements** — use IIFEs, ternaries, `.map`/`.filter` instead of `let` + mutation
- **Early returns** — check and return at top, don't nest. Combine conditions: `if (a && b)` not `if (a) { if (b) }`
- **No `any`** — search for proper types, use `as unknown as T` only as last resort
- **`cause` not template strings** — `new Error("msg", { cause: e })` not `` new Error(`msg ${e}`) ``
- **No uninitialized `let`** — use IIFE with returns instead of `let x; if (...) { x = ... }`
- **Type empty arrays** — `const items: string[] = []` not `const items = []`
- **Module imports for node builtins** — `import fs from 'node:fs'` then `fs.readFileSync(...)`, not named imports

- **Let TypeScript infer return types** — don't annotate return types by default. TypeScript infers them from the code and the inferred type is always correct. Only add an explicit return type when it genuinely improves readability (complex unions, public API boundaries) or when inference produces a wider type than intended:
  ```ts
  // BAD: redundant annotation — TypeScript already infers this exact type
  function getUser(id: string): Promise<NotFoundError | User> {
    const user = await db.find(id)
    if (!user) return new NotFoundError({ id })
    return user
  }

  // GOOD: let inference do its job
  function getUser(id: string) {
    const user = await db.find(id)
    if (!user) return new NotFoundError({ id })
    return user
  }

  // GOOD: explicit annotation when it adds clarity on a complex public API
  function processRequest(req: Request): Promise<
    | ValidationError
    | AuthError
    | DbError
    | null
    | Response
  > {
    // ...
  }
  ```

- **`.filter(isTruthy)` not `.filter(Boolean)`** — `Boolean` doesn't narrow types, so `(T | null)[]` stays `(T | null)[]` after filtering. Use a type guard instead:
  ```ts
  // BAD: TypeScript still thinks items is (User | null)[]
  const items = results.filter(Boolean)

  // GOOD: properly narrows to User[]
  function isTruthy<T>(value: T): value is NonNullable<T> { return Boolean(value) }
  const items = results.filter(isTruthy)
  ```

- **`controller.abort()` must use typed errors** — `abort(reason)` throws `reason` as-is. MUST pass a tagged error extending `errore.AbortError`, NEVER `new Error()` or a string — otherwise `isAbortError` can't detect it in the cause chain:
  ```ts
  // BAD: plain Error — isAbortError won't recognize it
  controller.abort(new Error('timeout'))

  // BAD: string — not an Error, breaks instanceof checks
  controller.abort('timeout')

  // GOOD: tagged error extending AbortError
  class TimeoutError extends errore.createTaggedError({
    name: 'TimeoutError',
    message: 'Request timed out for $operation',
    extends: errore.AbortError,
  }) {}
  controller.abort(new TimeoutError({ operation: 'fetch' }))
  ```

- **Never silently suppress errors in catch blocks** — empty `catch {}` hides failures. With errore you rarely need catch at all, but at boundaries where you must, always handle or log:
  ```ts
  // BAD: swallows the error, debugging nightmare
  try { await sendEmail(user.email) } catch {}

  // GOOD: log and continue if non-critical
  const emailResult = await sendEmail(user.email)
    .catch((e) => new EmailError({ email: user.email, cause: e }))
  if (emailResult instanceof Error) {
    console.warn('Failed to send email:', emailResult.message)
  }
  ```

## Flat Control Flow

Keep block nesting as low as possible. Every level of indentation is cognitive load. The ideal function reads top to bottom at root nesting level — a sequence of checks and early returns, no `else`, no nested `if`, no `try-catch`.

### Avoid `else`

`else` is almost never necessary. Most `if-else` blocks can be rewritten as an `if` with an early return followed by the rest of the code at root level:

```ts
// BAD: else creates unnecessary nesting
function getLabel(user: User): string {
  if (user.isAdmin) {
    return 'Admin'
  } else {
    return 'Member'
  }
}

// GOOD: early return, no else
function getLabel(user: User): string {
  if (user.isAdmin) return 'Admin'
  return 'Member'
}
```

This applies to `else if` chains too — replace them with a sequence of early-return `if` blocks:

```ts
// BAD: else-if chain
function getStatus(code: number): string {
  if (code === 200) {
    return 'ok'
  } else if (code === 404) {
    return 'not found'
  } else if (code >= 500) {
    return 'server error'
  } else {
    return 'unknown'
  }
}

// GOOD: flat sequence of ifs
function getStatus(code: number): string {
  if (code === 200) return 'ok'
  if (code === 404) return 'not found'
  if (code >= 500) return 'server error'
  return 'unknown'
}
```

### Flatten nested `if` into root-level checks

Any nested `if` can be converted to a series of root-level `if` statements by inverting conditions and returning early. This follows directly from boolean logic — `if (A) { if (B) { ... } }` is equivalent to `if (!A) return; if (!B) return; ...`:

```ts
// BAD: nested ifs — 3 levels deep
function processOrder(order: Order): ProcessError | Receipt {
  if (order.items.length > 0) {
    if (order.payment) {
      if (order.payment.verified) {
        return createReceipt(order)
      } else {
        return new ProcessError({ reason: 'Payment not verified' })
      }
    } else {
      return new ProcessError({ reason: 'No payment method' })
    }
  } else {
    return new ProcessError({ reason: 'Empty cart' })
  }
}

// GOOD: flat — every check at root level
function processOrder(order: Order): ProcessError | Receipt {
  if (order.items.length === 0) {
    return new ProcessError({ reason: 'Empty cart' })
  }
  if (!order.payment) {
    return new ProcessError({ reason: 'No payment method' })
  }
  if (!order.payment.verified) {
    return new ProcessError({ reason: 'Payment not verified' })
  }
  return createReceipt(order)
}
```

The transformation rule: take the outermost `if` condition, negate it, return the failure case, then continue at root level. Repeat for each nested `if`. The happy path falls through to the end.

### Avoid `try-catch` for control flow

`try-catch` is the worst offender for nesting. It forces a two-branch structure (`try` + `catch`) and hides which line threw. With errore, convert exceptions to values at boundaries and use `instanceof` checks:

```ts
// BAD: try-catch nesting
async function loadConfig(): Promise<Config> {
  try {
    const raw = await fs.readFile('config.json', 'utf-8')
    try {
      const parsed = JSON.parse(raw)
      if (!parsed.port) {
        throw new Error('Missing port')
      }
      return parsed
    } catch (e) {
      throw new Error(`Invalid JSON: ${e}`)
    }
  } catch (e) {
    return { port: 3000 }
  }
}

// GOOD: flat with errore
async function loadConfig(): Promise<Config> {
  const raw = await fs.readFile('config.json', 'utf-8')
    .catch((e) => new ConfigError({ reason: 'Read failed', cause: e }))
  if (raw instanceof Error) return { port: 3000 }

  const parsed = errore.try({
    try: () => JSON.parse(raw) as Config,
    catch: (e) => new ConfigError({ reason: 'Invalid JSON', cause: e }),
  })
  if (parsed instanceof Error) return { port: 3000 }

  if (!parsed.port) return { port: 3000 }

  return parsed
}
```

### Errors in branches, happy path at root

This is the single most important structural rule. Like Go's `if err != nil`, every `if` block in an errore function should handle an error and exit. The success path never goes inside an `if` — it flows straight down at the root indentation level.

**Go:**
```go
user, err := getUser(id)
if err != nil {
    return fmt.Errorf("get user: %w", err)
}
// user is valid here, at root level

posts, err := getPosts(user.ID)
if err != nil {
    return fmt.Errorf("get posts: %w", err)
}
// posts is valid here, at root level

return render(user, posts)
```

**errore (identical structure):**
```ts
const user = await getUser(id)
if (user instanceof Error) return user
// user is User here, at root level

const posts = await getPosts(user.id)
if (posts instanceof Error) return posts
// posts is Post[] here, at root level

return render(user, posts)
```

The pattern: **call → check error → exit if error → continue at root**. Every step follows this rhythm. The reader scans the left edge of the function to follow the happy path.

**Always handle errors inside `if` blocks, never success logic.** Error handling goes in branches with early exits. Putting success logic inside `if` blocks instead inverts the flow and buries the happy path:

```ts
// BAD: success logic buried inside if blocks — happy path is nested
const user = await getUser(id)
if (!(user instanceof Error)) {
  const posts = await getPosts(user.id)
  if (!(posts instanceof Error)) {
    return render(user, posts)
  }
  return posts  // error
}
return user  // error
```

```ts
// GOOD: errors in branches, happy path at root
const user = await getUser(id)
if (user instanceof Error) return user

const posts = await getPosts(user.id)
if (posts instanceof Error) return posts

return render(user, posts)
```

Same in loops — error in `if` + `continue`, happy path flat:

```ts
// BAD: success logic nested inside if
for (const id of ids) {
  const item = await fetchItem(id)
  if (!(item instanceof Error)) {
    await processItem(item)
    results.push(item)
  }
}

// GOOD: error in branch, continue — happy path stays at root
for (const id of ids) {
  const item = await fetchItem(id)
  if (item instanceof Error) {
    console.warn('Skipping', id, item.message)
    continue
  }
  await processItem(item)
  results.push(item)
}
```

> **Rule of thumb:** if you see `!(x instanceof Error)` in a condition, you've inverted the pattern. Flip it: check `x instanceof Error`, exit, and continue at root.

### Keep the happy path at minimum indentation

Structure functions so the success path runs at the root nesting level (minimal indentation inside the function body). Error cases are handled at the top of each step and exit early. The reader scans down the left edge to follow the main logic — just like reading a Go function where `if err != nil` blocks are speed bumps you skip over, and the real logic is everything else:

```ts
async function handleRequest(req: Request): Promise<AppError | Response> {
  const body = await parseBody(req)
  if (body instanceof Error) return body

  const user = await authenticate(req.headers)
  if (user instanceof Error) return user

  const permission = checkPermission(user, body.resource)
  if (permission instanceof Error) return permission

  const result = await execute(body.action, body.resource)
  if (result instanceof Error) return result

  return new Response(JSON.stringify(result), { status: 200 })
}
```

> Every line of actual logic is at nesting level 1 (the function body). Error handling always lives inside `if` blocks — short, self-contained, and exiting immediately. No `else`, no `try-catch`, no nesting.

## Patterns

### Expressions over Statements

Always prefer `const` with an expression over `let` assigned later. This eliminates mutable state and makes control flow explicit. Escalate by complexity:

**Simple: ternary**
```ts
const user = fetchResult instanceof Error
  ? fallbackUser
  : fetchResult
```

**Medium: IIFE with early returns**

When a ternary gets too nested or involves multiple checks, use an immediately invoked function expression. The IIFE scopes all intermediate variables and uses early returns for clarity:

```ts
const config: Config = (() => {
  const envResult = loadFromEnv()
  if (!(envResult instanceof Error)) return envResult

  const fileResult = loadFromFile()
  if (!(fileResult instanceof Error)) return fileResult

  return defaultConfig
})()
```

**Never: `let` assigned in branches**
```ts
// BAD: mutable variable, assigned across branches
let config
const envResult = loadFromEnv()
if (!(envResult instanceof Error)) {
  config = envResult
} else {
  const fileResult = loadFromFile()
  if (!(fileResult instanceof Error)) {
    config = fileResult
  } else {
    config = defaultConfig
  }
}
```

> Every `let x; if (...) { x = ... }` can be rewritten as `const x = ternary` or `const x: T = (() => { ... })()`. The IIFE pattern is idiomatic in errore code — it keeps error handling flat with early returns while producing a single immutable binding.

### Defining Errors

<!-- bad -->
```ts
class NotFoundError extends Error {
  id: string
  constructor(id: string) {
    super(`User ${id} not found`)
    this.name = 'NotFoundError'
    this.id = id
  }
}
```

<!-- good -->
```ts
import * as errore from 'errore'

class NotFoundError extends errore.createTaggedError({
  name: 'NotFoundError',
  message: 'User $id not found in $database',
}) {}
```

> `createTaggedError` gives you `_tag`, typed `$variable` properties, `cause`, `findCause`, `toJSON`, fingerprinting, and a static `.is()` type guard — all for free.
> Omit `message` to let the caller provide it at construction time: `new MyError({ message: 'details' })`. The fingerprint stays stable.
> Reserved variable names that cannot be used in templates: `$_tag`, `$name`, `$stack`, `$cause`.

**Instance properties:**
```ts
err._tag              // 'NotFoundError'
err.id                // 'abc' (from $id)
err.database          // 'users' (from $database)
err.message           // 'User abc not found in users'
err.messageTemplate   // 'User $id not found in $database'
err.fingerprint       // ['NotFoundError', 'User $id not found in $database']
err.cause             // original error if wrapped
err.toJSON()          // structured JSON with all properties
err.findCause(DbError)// walks .cause chain, returns typed match or undefined
NotFoundError.is(val) // static type guard
```

### Returning Errors

<!-- bad -->
```ts
async function getUser(id: string): Promise<User> {
  const user = await db.findUser(id)
  if (!user) throw new Error('User not found')
  return user
}
```

<!-- good -->
```ts
async function getUser(id: string): Promise<NotFoundError | User> {
  const user = await db.findUser(id)
  if (!user) return new NotFoundError({ id, database: 'users' })
  return user
}
```

> Return the error, don't throw it. The return type tells callers exactly what can go wrong.

### Handling Errors (Early Return)

<!-- bad -->
```ts
try {
  const user = await getUser(id)
  const posts = await getPosts(user.id)
  return posts
} catch (e) {
  // What errors can happen here? Who knows!
  console.error(e)
}
```

<!-- good -->
```ts
const user = await getUser(id)
if (user instanceof Error) return user

const posts = await getPosts(user.id)
if (posts instanceof Error) return posts

return posts
```

> Each error is checked at the point it occurs. TypeScript narrows the type after each check.

### Wrapping External Libraries

<!-- bad -->
```ts
async function fetchJson(url: string): Promise<any> {
  try {
    const res = await fetch(url)
    return await res.json()
  } catch (e) {
    throw new Error(`Fetch failed: ${e}`)
  }
}
```

<!-- good -->
```ts
async function fetchJson<T>(url: string): Promise<NetworkError | T> {
  const response = await fetch(url)
    .catch((e) => new NetworkError({ url, reason: 'Fetch failed', cause: e }))
  if (response instanceof Error) return response

  if (!response.ok) {
    return new NetworkError({ url, reason: `HTTP ${response.status}` })
  }

  const data = await (response.json() as Promise<T>)
    .catch((e) => new NetworkError({ url, reason: 'Invalid JSON', cause: e }))
  return data
}
```

> `.catch()` on a promise converts rejections to typed errors. TypeScript infers the union (`Response | NetworkError`) automatically. Use `errore.try` for sync boundaries (`JSON.parse`, etc.).

### Boundary Rule (.catch for async, errore.try for sync)

`.catch()` and `errore.try` should only appear at the **lowest level** of your call stack — right at the boundary with code you don't control (third-party libraries, `JSON.parse`, `fetch`, file I/O, etc.). Your own functions should never throw, so they never need `.catch()` or `try`.

For **async** boundaries: use `.catch((e) => new MyError({ cause: e }))` directly on the promise. TypeScript infers the union automatically.

For **sync** boundaries: use `errore.try({ try: () => ..., catch: (e) => ... })`. Always prefer `errore.try` over `errore.tryFn` — same function, `try` is the canonical name.

The `.catch()` callback receives `any` (Promise rejections are untyped), but wrapping in a typed error gives the union a concrete type — no `as` assertions needed.

<!-- bad -->
```ts
// wrapping too much in a single .catch — business logic should not be here
async function getUser(id: string): Promise<AppError | User> {
  return fetch(`/users/${id}`)
    .then(async (res) => {
      const data = await res.json()
      if (!data.active) throw new Error('inactive')
      return { ...data, displayName: `${data.first} ${data.last}` }
    })
    .catch((e) => new AppError({ id, cause: e }))
}
```

<!-- bad -->
```ts
// wrapping your own code that already returns errors as values
async function processOrder(id: string): Promise<OrderError | Order> {
  return createOrder(id)  // createOrder already returns errors!
    .catch((e) => new OrderError({ id, cause: e }))
}
```

<!-- good -->
```ts
// .catch() only wraps the external dependency, nothing else
async function getUser(id: string) {
  const res = await fetch(`/users/${id}`)
    .catch((e) => new NetworkError({ url: `/users/${id}`, cause: e }))
  if (res instanceof Error) return res

  const data = await (res.json() as Promise<UserPayload>)
    .catch((e) => new NetworkError({ url: `/users/${id}`, cause: e }))
  if (data instanceof Error) return data

  // business logic is outside .catch — plain code, not wrapped
  if (!data.active) return new InactiveUserError({ id })
  return { ...data, displayName: `${data.first} ${data.last}` }
}
```

> Think of `.catch()` and `errore.try` as the **adapter** between the throwing world (external code) and the errore world (errors as values). Once you've converted exceptions to values at the boundary, everything above is plain `instanceof` checks. Your own functions return errors as values — they never need `.catch()` or `try`.

### Optional Values (| null)

<!-- bad -->
```ts
// Awkward: undefined or throw or Option<T>
async function findUser(email: string): Promise<User | undefined> {
  const user = await db.query(email)
  return user ?? undefined
}
```

<!-- good -->
```ts
async function findUser(email: string): Promise<DbError | User | null> {
  const result = await db.query(email)
    .catch((e) => new DbError({ message: 'Query failed', cause: e }))
  if (result instanceof Error) return result
  return result ?? null
}

// Caller: three-way narrowing
const user = await findUser('alice@example.com')
if (user instanceof Error) return user   // error
if (user === null) return                 // not found
console.log(user.name)                   // User
```

> `Error | T | null` gives you three distinct states without nesting Result and Option types.

### Parallel Operations

<!-- bad -->
```ts
try {
  const [user, posts, stats] = await Promise.all([
    getUser(id),
    getPosts(id),
    getStats(id),
  ])
  return { user, posts, stats }
} catch (e) {
  // Which one failed? No idea
  throw e
}
```

<!-- good -->
```ts
const [userResult, postsResult, statsResult] = await Promise.all([
  getUser(id),
  getPosts(id),
  getStats(id),
])

if (userResult instanceof Error) return userResult
if (postsResult instanceof Error) return postsResult
if (statsResult instanceof Error) return statsResult

return { user: userResult, posts: postsResult, stats: statsResult }
```

> Each result is checked individually. You know exactly which operation failed.

### Exhaustive Matching (matchError)

<!-- bad -->
```ts
if (error instanceof NotFoundError) {
  return res.status(404).json({ error: error.message })
} else if (error instanceof DbError) {
  return res.status(500).json({ error: 'Database error' })
} else {
  return res.status(500).json({ error: 'Unknown error' })
}
```

<!-- good -->
```ts
const response = errore.matchError(error, {
  NotFoundError: (e) => ({ status: 404, body: { error: `${e.table} ${e.id} not found` } }),
  DbError: (e) => ({ status: 500, body: { error: 'Database error' } }),
  Error: (e) => ({ status: 500, body: { error: 'Unexpected error' } }),
})
return res.status(response.status).json(response.body)
```

> `matchError` routes by `_tag` and requires an `Error` fallback for plain Error instances. Use `matchErrorPartial` when you only need to handle some cases.

### Resource Cleanup (defer)

errore ships `DisposableStack` and `AsyncDisposableStack` polyfills that work in every runtime. Use them with TypeScript's `using` / `await using` for Go-like `defer` cleanup.

**tsconfig requirement:** add `"ESNext.Disposable"` to `lib` so TypeScript knows about `Disposable`, `AsyncDisposable`, `using`, and `await using`:

```jsonc
{
  "compilerOptions": {
    "lib": ["ES2022", "ESNext.Disposable"]
  }
}
```

Without this, `using`/`await using` declarations and `Symbol.dispose`/`Symbol.asyncDispose` will produce type errors. The errore polyfill handles the runtime side — this setting handles the type side.

<!-- bad -->
```ts
async function processRequest(id: string) {
  const db = await connectDb()
  try {
    const cache = await openCache()
    try {
      // ... use db and cache ...
      return result
    } finally {
      await cache.flush()
    }
  } finally {
    await db.close()
  }
}
```

<!-- good -->
```ts
import * as errore from 'errore'

async function processRequest(id: string): Promise<DbError | Result> {
  await using cleanup = new errore.AsyncDisposableStack()

  const db = await connectDb()
    .catch((e) => new DbError({ cause: e }))
  if (db instanceof Error) return db
  cleanup.defer(() => db.close())

  const cache = await openCache()
    .catch((e) => new CacheError({ cause: e }))
  if (cache instanceof Error) return cache
  cleanup.defer(() => cache.flush())

  // ... use db and cache ...
  return result
  // cleanup runs automatically in LIFO order:
  // 1. cache.flush()
  // 2. db.close()
}
```

> `await using` guarantees cleanup runs when the scope exits — whether by return, early error return, or thrown exception. Resources are released in reverse order (LIFO), just like Go's `defer`. No `try/finally` nesting.

### Fallback Values

<!-- bad -->
```ts
let config
try {
  config = JSON.parse(fs.readFileSync('config.json', 'utf-8'))
} catch (e) {
  config = { port: 3000, debug: false }
}
```

<!-- good -->
```ts
const result = errore.try(() => JSON.parse(fs.readFileSync('config.json', 'utf-8')))
const config = result instanceof Error ? { port: 3000, debug: false } : result
```

> A ternary on `instanceof Error` replaces `let` + try-catch. Single expression, no mutation, no intermediate state.

### Walking the Cause Chain (findCause)

<!-- bad -->
```ts
// Only checks one level deep
if (error.cause instanceof DbError) {
  console.log(error.cause.host)
}
```

<!-- good -->
```ts
// Walks the entire .cause chain (like Go's errors.As)
const dbErr = error.findCause(DbError)
if (dbErr) {
  console.log(dbErr.host)  // type-safe access
}

// Or standalone function for any Error
const dbErr = errore.findCause(error, DbError)
```

> `findCause` checks the error itself first, then walks `.cause` recursively. Returns the matched error with full type inference, or `undefined`. Safe against circular references.

### Custom Base Classes

<!-- bad -->
```ts
class AppError extends Error {
  statusCode = 500
  toResponse() { return { error: this.message, code: this.statusCode } }
}

class NotFoundError extends AppError {
  _tag = 'NotFoundError' as const
  id: string
  constructor(id: string) {
    super(`Resource ${id} not found`)
    this.name = 'NotFoundError'
    this.id = id
    this.statusCode = 404
  }
}
```

<!-- good -->
```ts
class AppError extends Error {
  statusCode = 500
  toResponse() { return { error: this.message, code: this.statusCode } }
}

class NotFoundError extends errore.createTaggedError({
  name: 'NotFoundError',
  message: 'Resource $id not found',
  extends: AppError,
}) {
  statusCode = 404
}

const err = new NotFoundError({ id: '123' })
err.toResponse()          // { error: 'Resource 123 not found', code: 404 }
err instanceof AppError   // true
err instanceof Error      // true
```

> Use `extends` to inherit shared functionality (HTTP status codes, logging methods, response formatting) across all your domain errors.

### Boundary with Legacy Code

<!-- bad -->
```ts
// Legacy code expects throws
async function legacyHandler(id: string) {
  try {
    const user = await getUser(id)  // now returns Error | User
    // This silently passes errors through as if they were users!
    return user
  } catch (e) {
    console.error(e)
  }
}
```

<!-- good -->
```ts
async function legacyHandler(id: string) {
  const user = await getUser(id)
  if (user instanceof Error) throw new Error('Failed to get user', { cause: user })
  return user
}
```

> At boundaries where legacy code expects exceptions, check `instanceof Error` and throw with `cause`. This preserves the error chain and keeps the pattern consistent.

### Partition: Splitting Successes and Failures

<!-- bad -->
```ts
const results: Item[] = []
for (const id of ids) {
  try {
    const item = await fetchItem(id)
    results.push(item)
  } catch (e) {
    console.warn(`Failed to fetch ${id}`)
  }
}
```

<!-- good -->
```ts
const allResults = await Promise.all(ids.map((id) => fetchItem(id)))
const [items, errors] = errore.partition(allResults)

errors.forEach((e) => console.warn('Failed:', e.message))
// items contains only successful results, fully typed
```

> `partition` splits an array of `(Error | T)[]` into `[T[], Error[]]`. No manual accumulation.

### Abort & Cancellation

`controller.abort(reason)` throws `reason` as-is — whatever you pass is what `.catch()` receives. This means you MUST pass a typed error extending `errore.AbortError`, never a plain `Error` or string.

Always use `errore.isAbortError(error)` to detect abort errors. It walks the entire `.cause` chain, so it works even when the abort error is wrapped by `.catch()`.

<!-- bad -->
```ts
// Plain Error — isAbortError can't detect it
controller.abort(new Error('timeout'))

// String — not an Error, breaks instanceof
controller.abort('timeout')
```

<!-- good -->
```ts
import * as errore from 'errore'

class TimeoutError extends errore.createTaggedError({
  name: 'TimeoutError',
  message: 'Request timed out for $operation',
  extends: errore.AbortError,
}) {}

// Pass typed error to abort
const controller = new AbortController()
const timer = setTimeout(
  () => controller.abort(new TimeoutError({ operation: 'fetch' })),
  5000,
)

const res = await fetch(url, { signal: controller.signal })
  .catch((e) => new NetworkError({ url, cause: e }))
clearTimeout(timer)

if (res instanceof Error) {
  // Check if the underlying cause was an abort
  if (errore.isAbortError(res)) {
    const timeout = errore.findCause(res, TimeoutError)
    if (timeout) console.log(timeout.operation)
    return res
  }
  // Genuine network error
  return res
}
```

> `isAbortError` detects three kinds of abort: (1) native `DOMException` from bare `controller.abort()`, (2) direct `errore.AbortError` instances, (3) tagged errors that extend `errore.AbortError` — even when wrapped in another error's `.cause` chain.

## Pitfalls

### CustomError | Error is ambiguous when CustomError extends Error

```ts
// BAD: both sides of the union are Error instances
type Result = MyCustomError | Error

// instanceof Error matches BOTH — can't distinguish success from failure
// Success types must never extend Error
```
