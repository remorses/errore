---
name: errore
description: Type-safe errors as values for TypeScript. Like Go, but with full type inference.
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
3. Never return `unknown | Error` — the union collapses to `unknown`, breaks narrowing
4. Never use `try-catch` for control flow — use `errore.tryAsync` / `errore.try` to convert exceptions to values
5. Use `createTaggedError` for domain errors — gives you `_tag`, typed properties, `$variable` interpolation, `cause`, `findCause`, `toJSON`, and fingerprinting
6. Always annotate return types with the error union — `Promise<MyError | OtherError | Value>`
7. Use `cause` to wrap errors — `new MyError({ ..., cause: originalError })`
8. Use `| null` for optional values, not `| undefined` — three-way narrowing: `instanceof Error`, `=== null`, then value
9. Use `const` + expressions, never `let` + try-catch — ternaries, IIFEs, `errore.unwrapOr`
10. Use early returns, never nested if-else — check error, return, continue flat
11. Always include `Error` handler in `matchError` — required fallback for plain Error instances

## TypeScript Rules

These TypeScript practices complement errore's philosophy:

- **Object args over positional** — `({id, retries})` not `(id, retries)` for functions with 2+ params
- **Block body on arrow functions** — `(x) => { return x }` not `(x) => x`, easier to add statements later
- **Expressions over statements** — use IIFEs, ternaries, `.map`/`.filter` instead of `let` + mutation
- **Early returns** — check and return at top, don't nest. Combine conditions: `if (a && b)` not `if (a) { if (b) }`
- **No `any`** — search for proper types, use `as unknown as T` only as last resort
- **`cause` not template strings** — `new Error("msg", { cause: e })` not `` new Error(`msg ${e}`) ``
- **No uninitialized `let`** — use IIFE with returns instead of `let x; if (...) { x = ... }`
- **Type empty arrays** — `const items: string[] = []` not `const items = []`
- **Module imports for node builtins** — `import fs from 'node:fs'` then `fs.readFileSync(...)`, not named imports

## Patterns

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
  const response = await errore.tryAsync({
    try: () => fetch(url),
    catch: (e) => new NetworkError({ url, reason: 'Fetch failed', cause: e }),
  })
  if (response instanceof Error) return response

  if (!response.ok) {
    return new NetworkError({ url, reason: `HTTP ${response.status}` })
  }

  const data = await errore.tryAsync({
    try: () => response.json() as Promise<T>,
    catch: (e) => new NetworkError({ url, reason: 'Invalid JSON', cause: e }),
  })
  return data
}
```

> `errore.tryAsync` catches exceptions and maps them to typed errors. Use `errore.try` for sync code. The `cause` preserves the original exception.

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
  const result = await errore.tryAsync({
    try: () => db.query(email),
    catch: (e) => new DbError({ message: 'Query failed', cause: e }),
  })
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

### Sequential Operations

<!-- bad -->
```ts
async function createUserWithProfile(input: CreateUserInput): Promise<FullUser> {
  try {
    const validated = validateInput(input)
    const user = await createUser(validated)
    const profile = await createProfile({ userId: user.id })
    return { ...user, profile }
  } catch (e) {
    console.error('Something failed:', e)
    throw e
  }
}
```

<!-- good -->
```ts
async function createUserWithProfile(
  input: CreateUserInput,
): Promise<ValidationError | DbError | FullUser> {
  const validated = validateInput(input)
  if (validated instanceof Error) return validated

  const user = await createUser(validated)
  if (user instanceof Error) return user

  const profile = await createProfile({ userId: user.id })
  if (profile instanceof Error) return profile

  return { ...user, profile }
}
```

> Each step is checked independently. The return type is the union of all possible errors.

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
const config = errore.unwrapOr(
  errore.try(() => JSON.parse(fs.readFileSync('config.json', 'utf-8'))),
  { port: 3000, debug: false },
)
```

> `unwrapOr` replaces the `let` + try-catch pattern with a single expression. No mutation, no intermediate state.

### Error Wrapping with Cause

<!-- bad -->
```ts
try {
  return await externalService.call(id)
} catch (e) {
  throw new Error(`Service call failed for ${id}: ${e}`)
}
```

<!-- good -->
```ts
const result = await errore.tryAsync({
  try: () => externalService.call(id),
  catch: (e) => new ServiceError({ id, cause: e }),
})
if (result instanceof Error) return result
return result
```

> `cause` preserves the full error chain. The original error's stack trace and properties are accessible via `.cause`. This is Go's `fmt.Errorf("context: %w", err)` pattern.

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

### Retry Logic

<!-- bad -->
```ts
let result
let attempts = 0
while (attempts < 3) {
  try {
    result = await fetchData()
    break
  } catch (e) {
    attempts++
    if (attempts >= 3) throw e
    await sleep(1000)
  }
}
```

<!-- good -->
```ts
async function fetchWithRetry(): Promise<NetworkError | Data> {
  for (let attempt = 0; attempt < 3; attempt++) {
    const result = await fetchData()
    if (errore.isOk(result)) return result

    if (attempt < 2) await sleep(1000 * 2 ** attempt)
  }
  return new NetworkError({ url: '/api', reason: 'Failed after 3 attempts' })
}
```

> A plain `for` loop with `continue` replaces recursive execute + throw-to-retry. Each failure point decides independently whether to retry or return.

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
  // unwrap throws if error, returns value otherwise
  return errore.unwrap(user, 'Failed to get user')
}
```

> Use `errore.unwrap` at boundaries where legacy code expects exceptions. Migrate gradually: leaf functions first, then work upward.

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

errors.forEach((e) => { console.warn('Failed:', e.message) })
// items contains only successful results, fully typed
```

> `partition` splits an array of `(Error | T)[]` into `[T[], Error[]]`. No manual accumulation.

### Fallback Chain

<!-- bad -->
```ts
let config
try {
  config = loadFromEnv()
} catch {
  try {
    config = loadFromFile()
  } catch {
    config = defaultConfig
  }
}
```

<!-- good -->
```ts
const envConfig = loadFromEnv()
const fileConfig = loadFromFile()

const config = errore.isOk(envConfig) ? envConfig
  : errore.isOk(fileConfig) ? fileConfig
  : defaultConfig
```

> Chain with ternaries and `errore.isOk`. No nested try-catch, no mutation.

### Input Validation

<!-- bad -->
```ts
function validateUser(input: unknown): CreateUserInput {
  if (!input || typeof input !== 'object') {
    throw new Error('Invalid input')
  }
  const { email, name } = input as Record<string, unknown>
  if (typeof email !== 'string') throw new Error('Invalid email')
  if (typeof name !== 'string') throw new Error('Invalid name')
  return { email, name }
}
```

<!-- good -->
```ts
function validateUser(input: unknown): ValidationError | CreateUserInput {
  if (!input || typeof input !== 'object') {
    return new ValidationError({ field: 'body', reason: 'Invalid request body' })
  }
  const { email, name } = input as Record<string, unknown>

  if (typeof email !== 'string' || !email.includes('@')) {
    return new ValidationError({ field: 'email', reason: 'Invalid email format' })
  }
  if (typeof name !== 'string' || name.length < 2) {
    return new ValidationError({ field: 'name', reason: 'Name must be at least 2 characters' })
  }

  return { email, name }
}
```

> Validation functions return errors instead of throwing. The caller gets a typed error with the exact field and reason.

### Conditional Error Recovery

<!-- bad -->
```ts
let user
try {
  user = await fetchUser(id)
} catch (e) {
  if (e.code === 'NOT_FOUND') {
    user = await createDefaultUser(id)
  } else {
    throw e
  }
}
```

<!-- good -->
```ts
const fetchResult = await fetchUser(id)
const user = fetchResult instanceof RecordNotFoundError
  ? await createDefaultUser(id)
  : fetchResult
```

> A ternary expression replaces `let` + try-catch + conditional rethrow. One line, no mutation.

## Pitfalls

### unknown | Error collapses to unknown

```ts
// BAD: Error | unknown simplifies to unknown — no narrowing after instanceof check
function parse(input: string): Error | unknown { ... }

const result = parse('{}')
if (result instanceof Error) return result
result.field  // ERROR: result is still unknown

// GOOD: use explicit types
function parse(input: string): Error | ParsedData { ... }
```

### CustomError | Error is ambiguous when CustomError extends Error

```ts
// BAD: both sides of the union are Error instances
type Result = MyCustomError | Error

// instanceof Error matches BOTH — can't distinguish success from failure
// Success types must never extend Error
```

### Forgetting Error handler in matchError

```ts
// BAD: matchError requires Error handler for plain Error instances
errore.matchError(err, {
  NotFoundError: (e) => 'not found',
  // missing Error handler — compile error
})

// GOOD: always include Error fallback
errore.matchError(err, {
  NotFoundError: (e) => 'not found',
  Error: (e) => `unexpected: ${e.message}`,
})
```

## Quick Reference

```ts
import * as errore from 'errore'

// --- Define errors ---
class MyError extends errore.createTaggedError({
  name: 'MyError',
  message: 'Operation on $resource failed: $reason',
}) {}

// --- Return errors ---
function myFn(): MyError | string {
  if (bad) return new MyError({ resource: 'user', reason: 'not found' })
  return 'ok'
}

// --- Early return ---
const result = myFn()
if (result instanceof Error) return result
// result is string

// --- Wrap exceptions ---
const data = await errore.tryAsync({
  try: () => riskyCall(),
  catch: (e) => new MyError({ resource: 'api', reason: 'call failed', cause: e }),
})

// --- Type guards ---
errore.isError(value)     // value is Error
errore.isOk(value)        // value is not Error

// --- Transform ---
errore.map(result, (v) => v.toUpperCase())          // transform value, pass error through
errore.mapError(result, (e) => new WrapperError(e)) // transform error, pass value through
errore.andThen(result, (v) => nextStep(v))           // chain errore-returning functions

// --- Extract ---
errore.unwrap(result)                 // extract value or throw
errore.unwrap(result, 'custom msg')   // extract value or throw with message
errore.unwrapOr(result, fallback)     // extract value or use fallback
errore.match(result, {                // pattern match
  ok: (v) => `got ${v}`,
  err: (e) => `failed: ${e.message}`,
})
errore.partition(results)             // [values[], errors[]]

// --- Match errors ---
errore.matchError(error, {
  MyError: (e) => e.reason,
  Error: (e) => e.message,           // required fallback
})

// --- Cause chain ---
error.findCause(DbError)             // instance method on tagged errors
errore.findCause(error, DbError)     // standalone function

// --- Error properties ---
err._tag              // 'MyError'
err.resource          // 'user' (from $resource)
err.reason            // 'not found' (from $reason)
err.message           // 'Operation on user failed: not found'
err.messageTemplate   // 'Operation on $resource failed: $reason'
err.fingerprint       // ['MyError', 'Operation on $resource failed: $reason']
err.cause             // original error if wrapped
err.toJSON()          // structured JSON with all properties
MyError.is(value)     // static type guard
```
