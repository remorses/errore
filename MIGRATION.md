# Migrating to errore

This guide shows how to migrate a TypeScript codebase from try-catch exceptions to type-safe errors as values, Go-style.

## Philosophy

Instead of:

```ts
try {
  const user = await fetchUser(id)
  const posts = await fetchPosts(user.id)
  return posts
} catch (e) {
  // What errors can happen here? Who knows!
  console.error(e)
}
```

You write:

```ts
const user = await fetchUser(id)
if (user instanceof Error) return user // early return, like Go

const posts = await fetchPosts(user.id)
if (posts instanceof Error) return posts

return posts
```

TypeScript knows exactly what errors can occur and enforces handling them.

## Migration Strategy: Start from the Leaves

Migrate bottom-up, starting with the lowest-level functions that interact with external systems (database, network, file system). Then work your way up.

```
High-level handlers (migrate last)
       ↑
  Business logic
       ↑
  Service functions
       ↑
Low-level utilities (migrate first) ← START HERE
```

## Step 1: Define Your Error Types

Create typed errors for your domain using `createTaggedError`:

```ts
// errors.ts
import * as errore from 'errore'

// Database errors
class DbConnectionError extends errore.createTaggedError({
  name: 'DbConnectionError',
}) {}

class RecordNotFoundError extends errore.createTaggedError({
  name: 'RecordNotFoundError',
  message: '$table with id $id not found',
}) {}

// Network errors
class NetworkError extends errore.createTaggedError({
  name: 'NetworkError',
  message: 'Request to $url failed: $reason',
}) {}

// Validation errors
class ValidationError extends errore.createTaggedError({
  name: 'ValidationError',
  message: 'Invalid $field: $reason',
}) {}

// Auth errors
class UnauthorizedError extends errore.createTaggedError({
  name: 'UnauthorizedError',
  message: 'Unauthorized',
}) {}
```

## Step 2: Migrate Leaf Functions

### Before: Function that throws

```ts
async function getUserById(id: string): Promise<User> {
  const user = await db.query('SELECT * FROM users WHERE id = ?', [id])
  if (!user) {
    throw new Error('User not found')
  }
  return user
}
```

### After: Function returns error or value

```ts
import * as errore from 'errore'

async function getUserById(
  id: string,
): Promise<DbConnectionError | RecordNotFoundError | User> {
  const result = await db
    .query('SELECT * FROM users WHERE id = ?', [id])
    .catch(
      (e) =>
        new DbConnectionError({ message: 'Database query failed', cause: e }),
    )

  if (result instanceof Error) return result
  if (!result) return new RecordNotFoundError({ table: 'users', id })

  return result
}
```

## Step 3: Migrate Callers (Early Return Pattern)

### Before: try-catch

```ts
async function getFullUser(id: string): Promise<FullUser> {
  try {
    const user = await getUserById(id)
    const profile = await getProfileByUserId(user.id)
    const settings = await getSettingsByUserId(user.id)

    return { ...user, profile, settings }
  } catch (e) {
    console.error('Failed to get full user:', e)
    throw e
  }
}
```

### After: Early returns (Go-style)

```ts
type GetFullUserError = DbConnectionError | RecordNotFoundError

async function getFullUser(id: string): Promise<GetFullUserError | FullUser> {
  const user = await getUserById(id)
  if (user instanceof Error) return user

  const profile = await getProfileByUserId(user.id)
  if (profile instanceof Error) return profile

  const settings = await getSettingsByUserId(user.id)
  if (settings instanceof Error) return settings

  return { ...user, profile, settings }
}
```

## Step 4: Handle Errors at the Top Level

At your API handlers or entry points, handle all errors explicitly:

```ts
import * as errore from 'errore'

app.get('/users/:id', async (req, res) => {
  const user = await getFullUser(req.params.id)

  if (user instanceof Error) {
    const response = errore.matchError(user, {
      RecordNotFoundError: (e) => ({
        status: 404,
        body: { error: `${e.table} ${e.id} not found` },
      }),
      DbConnectionError: (e) => ({
        status: 500,
        body: { error: 'Database error' },
      }),
      Error: (e) => ({ status: 500, body: { error: 'Unexpected error' } }),
    })
    return res.status(response.status).json(response.body)
  }

  return res.json(user)
})
```

## Common Patterns

### Wrapping External Libraries

Use `errore.try` for sync, `.catch()` for async:

```ts
import * as errore from 'errore'

// Sync: JSON parsing
function parseJson(input: string): ValidationError | unknown {
  const result = errore.try({
    try: () => JSON.parse(input),
    catch: () => new ValidationError({ field: 'json', reason: 'Invalid JSON' }),
  })
  return result
}

// Async: fetch wrapper
async function fetchJson<T>(url: string): Promise<NetworkError | T> {
  const response = await fetch(url).catch(
    (e) => new NetworkError({ url, reason: 'Fetch failed', cause: e }),
  )
  if (response instanceof Error) return response

  if (!response.ok) {
    return new NetworkError({ url, reason: `HTTP ${response.status}` })
  }

  const data = await (response.json() as Promise<T>).catch(
    (e) => new NetworkError({ url, reason: 'Invalid JSON response', cause: e }),
  )
  return data
}
```

### Optional Values: Use `| null`

Combine error handling with optional values naturally:

```ts
import * as errore from 'errore'

async function findUserByEmail(
  email: string,
): Promise<DbConnectionError | User | null> {
  const result = await db
    .query('SELECT * FROM users WHERE email = ?', [email])
    .catch((e) => new DbConnectionError({ message: 'Query failed', cause: e }))

  if (result instanceof Error) return result
  return result ?? null // explicitly return null if not found
}

// Caller
const user = await findUserByEmail('test@example.com')
if (user instanceof Error) return user
if (user === null) {
  // Handle not found case
  return new RecordNotFoundError({ table: 'users', id: email })
}
// user is User
```

### Validating Input

```ts
function validateCreateUser(input: unknown): ValidationError | CreateUserInput {
  if (!input || typeof input !== 'object') {
    return new ValidationError({
      field: 'body',
      reason: 'Invalid request body',
    })
  }

  const { email, name } = input as Record<string, unknown>

  if (typeof email !== 'string' || !email.includes('@')) {
    return new ValidationError({ field: 'email', reason: 'Invalid email' })
  }

  if (typeof name !== 'string' || name.length < 2) {
    return new ValidationError({
      field: 'name',
      reason: 'Name must be at least 2 characters',
    })
  }

  return { email, name }
}
```

### Multiple Sequential Operations

```ts
import * as errore from 'errore'

async function createUserWithProfile(
  input: CreateUserInput,
): Promise<ValidationError | DbConnectionError | User> {
  // Validate
  const validated = validateCreateUser(input)
  if (validated instanceof Error) return validated

  // Create user
  const user = await createUser(validated)
  if (user instanceof Error) return user

  // Create default profile
  const profile = await createProfile({ userId: user.id, bio: '' })
  if (profile instanceof Error) return profile

  // Send welcome email (don't fail if this fails)
  const emailResult = await sendWelcomeEmail(user.email)
  if (emailResult instanceof Error) {
    console.warn('Failed to send welcome email:', emailResult.message)
    // Continue anyway
  }

  return user
}
```

### Parallel Operations

```ts
async function getUserDashboard(
  userId: string,
): Promise<DbConnectionError | RecordNotFoundError | Dashboard> {
  // Fetch in parallel
  const [userResult, postsResult, statsResult] = await Promise.all([
    getUser(userId),
    getUserPosts(userId),
    getUserStats(userId),
  ])

  // Check each result
  if (userResult instanceof Error) return userResult
  if (postsResult instanceof Error) return postsResult
  if (statsResult instanceof Error) return statsResult

  return {
    user: userResult,
    posts: postsResult,
    stats: statsResult,
  }
}
```

### Replacing `let` + try-catch with Expressions

A common pattern is declaring a variable with `let`, then assigning inside try-catch for error recovery. This is ugly and error-prone. errore makes these into clean expressions.

#### Pattern 1: Fallback value on error

**Before:**

```ts
let config
try {
  config = JSON.parse(fs.readFileSync('config.json', 'utf-8'))
} catch (e) {
  config = { port: 3000, debug: false } // fallback
}
```

**After:** Use `errore.unwrapOr` for a one-liner

```ts
import * as errore from 'errore'

const config = errore.unwrapOr(
  errore.try(() => JSON.parse(fs.readFileSync('config.json', 'utf-8'))),
  { port: 3000, debug: false },
)
```

#### Pattern 2: Different fallback logic based on error

**Before:**

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

**After:** Use `instanceof` + conditional

```ts
const fetchResult = await fetchUser(id)
const user =
  fetchResult instanceof RecordNotFoundError
    ? await createDefaultUser(id)
    : fetchResult

// Or more explicitly:
const user = (() => {
  const result = await fetchUser(id)
  if (RecordNotFoundError.is(result)) {
    return createDefaultUser(id)
  }
  return result
})()
```

#### Pattern 3: Retry on failure

**Before:**

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

**After:** Loop with early break

```ts
import * as errore from 'errore'

async function fetchWithRetry(): Promise<NetworkError | Data> {
  for (let attempt = 0; attempt < 3; attempt++) {
    const result = await fetchData()
    if (errore.isOk(result)) return result

    if (attempt < 2) await sleep(1000) // don't sleep on last attempt
  }
  return new NetworkError({ url: '/api', reason: 'Failed after 3 attempts' })
}

const result = await fetchWithRetry()
```

#### Pattern 4: Accumulating results, some may fail

**Before:**

```ts
const results = []
for (const id of ids) {
  try {
    const item = await fetchItem(id)
    results.push(item)
  } catch (e) {
    console.warn(`Failed to fetch ${id}`)
    // continue with others
  }
}
```

**After:** Use `errore.partition` or filter

```ts
import * as errore from 'errore'

const allResults = await Promise.all(ids.map(fetchItem))
const [items, errors] = errore.partition(allResults)

// Log errors if needed
errors.forEach((e) => console.warn('Failed:', e.message))

// items contains only successful results
```

#### Pattern 5: Transform or default

**Before:**

```ts
let value
try {
  const raw = await fetchValue()
  value = transform(raw)
} catch (e) {
  value = defaultValue
}
```

**After:** Clean expression

```ts
const raw = await fetchValue()
const value = raw instanceof Error ? defaultValue : transform(raw)
```

#### Pattern 6: Cache with fallback to fetch

**Before:**

```ts
let data
try {
  data = cache.get(key)
  if (!data) throw new Error('cache miss')
} catch (e) {
  data = await fetchFromDb(key)
  cache.set(key, data)
}
```

**After:** Explicit flow

```ts
import * as errore from 'errore'

const cached = cache.get(key) // returns Data | null

const data =
  cached ??
  (await (async () => {
    const fetched = await fetchFromDb(key)
    if (errore.isOk(fetched)) cache.set(key, fetched)
    return fetched
  })())
```

Or simpler:

```ts
import * as errore from 'errore'

async function getWithCache(key: string): Promise<DbError | Data> {
  const cached = cache.get(key)
  if (cached) return cached

  const fetched = await fetchFromDb(key)
  if (errore.isOk(fetched)) cache.set(key, fetched)

  return fetched
}
```

#### Pattern 7: Multiple sources with fallback chain

**Before:**

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

**After:** Chain with `??` and `errore.isOk`

```ts
import * as errore from 'errore'

const envConfig = loadFromEnv() // ConfigError | Config
const fileConfig = loadFromFile() // ConfigError | Config

const config = errore.isOk(envConfig)
  ? envConfig
  : errore.isOk(fileConfig)
    ? fileConfig
    : defaultConfig
```

Or as a function:

```ts
import * as errore from 'errore'

function loadConfig(): Config {
  const sources = [loadFromEnv, loadFromFile]

  for (const load of sources) {
    const result = load()
    if (errore.isOk(result)) return result
  }

  return defaultConfig
}
```

#### Key Insight: Expressions over Statements

The pattern is always:

1. **Before:** `let x; try { x = ... } catch { x = ... }` (statements)
2. **After:** `const x = result instanceof Error ? fallback : result` (expression)

This makes code:

- More readable (no mutation)
- Type-safe (TypeScript tracks the union)
- Easier to test (pure expressions)

### Converting Existing Code Gradually

You can convert one function at a time. Use `unwrap` at boundaries:

```ts
import * as errore from 'errore'

// New code using errore
async function getUser(id: string): Promise<DbConnectionError | User> {
  // ... returns error or value
}

// Old code that expects throws - use errore.unwrap at the boundary
async function legacyHandler(id: string) {
  const user = await getUser(id)
  // errore.unwrap throws if error, returns value otherwise
  return errore.unwrap(user, 'Failed to get user')
}
```

## Checklist

- [ ] Define error types in `errors.ts` using `createTaggedError`
- [ ] Identify leaf functions (database, network, file I/O)
- [ ] Migrate leaf functions to return `Error | Value`
- [ ] Update function signatures with explicit error unions
- [ ] Replace `try-catch` with `instanceof Error` checks and early returns
- [ ] Use `matchError` at top-level handlers for exhaustive handling (always include `Error` handler)
- [ ] Use `| null` for optional values instead of `| undefined`

## Flat Control Flow Patterns

### Avoid else

```ts
// before
function getLabel(user: User): string {
  if (user.isAdmin) {
    return 'Admin'
  } else {
    return 'Member'
  }
}

// after
function getLabel(user: User): string {
  if (user.isAdmin) return 'Admin'
  return 'Member'
}
```

### Flatten else-if chains

```ts
// before
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

// after
function getStatus(code: number): string {
  if (code === 200) return 'ok'
  if (code === 404) return 'not found'
  if (code >= 500) return 'server error'
  return 'unknown'
}
```

### Flatten nested ifs

```ts
// before — 3 levels deep
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

// after — flat, every check at root level
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

### Avoid try-catch nesting

```ts
// before
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

// after
async function loadConfig(): Promise<Config> {
  const raw = await fs
    .readFile('config.json', 'utf-8')
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

### Don't invert the pattern

```ts
// before — success logic buried inside if blocks, happy path is nested
const user = await getUser(id)
if (!(user instanceof Error)) {
  const posts = await getPosts(user.id)
  if (!(posts instanceof Error)) {
    return render(user, posts)
  }
  return posts // error
}
return user // error

// after — errors in branches, happy path at root
const user = await getUser(id)
if (user instanceof Error) return user

const posts = await getPosts(user.id)
if (posts instanceof Error) return posts

return render(user, posts)
```

Same in loops:

```ts
// before — success logic nested inside if
for (const id of ids) {
  const item = await fetchItem(id)
  if (!(item instanceof Error)) {
    await processItem(item)
    results.push(item)
  }
}

// after — error in branch, continue
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

### Expressions over statements (let + branches)

```ts
// before — mutable variable, assigned across branches
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

// after — IIFE with early returns, single immutable binding
const config: Config = (() => {
  const envResult = loadFromEnv()
  if (!(envResult instanceof Error)) return envResult
  const fileResult = loadFromFile()
  if (!(fileResult instanceof Error)) return fileResult
  return defaultConfig
})()
```

## Additional Patterns

### Custom Base Classes

```ts
// before
class AppError extends Error {
  statusCode = 500
  toResponse() {
    return { error: this.message, code: this.statusCode }
  }
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

// after
class AppError extends Error {
  statusCode = 500
  toResponse() {
    return { error: this.message, code: this.statusCode }
  }
}

class NotFoundError extends errore.createTaggedError({
  name: 'NotFoundError',
  message: 'Resource $id not found',
  extends: AppError,
}) {
  statusCode = 404
}
```

### Boundary Rule — Don't Wrap Too Much

```ts
// before — business logic mixed into .catch
async function getUser(id: string): Promise<AppError | User> {
  return fetch(`/users/${id}`)
    .then(async (res) => {
      const data = await res.json()
      if (!data.active) throw new Error('inactive')
      return { ...data, displayName: `${data.first} ${data.last}` }
    })
    .catch((e) => new AppError({ id, cause: e }))
}

// before — wrapping your own code that already returns errors as values
async function processOrder(id: string): Promise<OrderError | Order> {
  return createOrder(id) // createOrder already returns errors!
    .catch((e) => new OrderError({ id, cause: e }))
}

// after — .catch() only wraps the external dependency, nothing else
async function getUser(id: string) {
  const res = await fetch(`/users/${id}`).catch(
    (e) => new NetworkError({ url: `/users/${id}`, cause: e }),
  )
  if (res instanceof Error) return res

  const data = await (res.json() as Promise<UserPayload>).catch(
    (e) => new NetworkError({ url: `/users/${id}`, cause: e }),
  )
  if (data instanceof Error) return data

  // business logic is outside .catch — plain code, not wrapped
  if (!data.active) return new InactiveUserError({ id })
  return { ...data, displayName: `${data.first} ${data.last}` }
}
```

### Resource Cleanup (defer)

```ts
// before — nested try-finally
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

// after — Go-like defer with DisposableStack
import * as errore from 'errore'

async function processRequest(id: string): Promise<DbError | Result> {
  await using cleanup = new errore.AsyncDisposableStack()

  const db = await connectDb().catch((e) => new DbError({ cause: e }))
  if (db instanceof Error) return db
  cleanup.defer(() => db.close())

  const cache = await openCache().catch((e) => new CacheError({ cause: e }))
  if (cache instanceof Error) return cache
  cleanup.defer(() => cache.flush())

  return result
  // cleanup runs automatically in LIFO order:
  // 1. cache.flush()
  // 2. db.close()
}
```

### Walking the Cause Chain

```ts
// before — only checks one level deep
if (error.cause instanceof DbError) {
  console.log(error.cause.host)
}

// after — walks the entire .cause chain (like Go's errors.As)
const dbErr = error.findCause(DbError)
if (dbErr) {
  console.log(dbErr.host) // type-safe access
}
```

### Abort & Cancellation

```ts
// before — plain Error or string, isAbortError can't detect it
controller.abort(new Error('timeout'))
controller.abort('timeout')

// after — typed error extending AbortError
class TimeoutError extends errore.createTaggedError({
  name: 'TimeoutError',
  message: 'Request timed out for $operation',
  extends: errore.AbortError,
}) {}
controller.abort(new TimeoutError({ operation: 'fetch' }))
```

### Flat abort checks

```ts
// before — isAbortError hidden inside instanceof
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

// after — flat early returns with .catch
const result = await fetchData({ signal }).catch(
  (e) => new FetchError({ cause: e }),
)
if (errore.isAbortError(result)) {
  return 'Request timed out'
}
if (result instanceof Error) {
  return `Failed: ${result.message}`
}
```

### Don't reassign after narrowing

```ts
// before — unnecessary reassignment
const result = await fetch(url).catch((e) => new FetchError({ cause: e }))
if (result instanceof Error) {
  return `Failed: ${result.message}`
}
const response = result // pointless — TS already knows result is Response
await response.json()

// after — just keep using the original variable
const result = await fetch(url).catch((e) => new FetchError({ cause: e }))
if (result instanceof Error) {
  return `Failed: ${result.message}`
}
await result.json() // TS knows result is Response here
```

## TypeScript Migration Patterns

### Don't annotate return types redundantly

```ts
// before — redundant annotation, TypeScript already infers this exact type
function getUser(id: string): Promise<NotFoundError | User> {
  const user = await db.find(id)
  if (!user) return new NotFoundError({ id })
  return user
}

// after — let inference do its job
function getUser(id: string) {
  const user = await db.find(id)
  if (!user) return new NotFoundError({ id })
  return user
}

// exception: explicit annotation when it adds clarity on a complex public API
function processRequest(
  req: Request,
): Promise<ValidationError | AuthError | DbError | null | Response> {
  // ...
}
```

### Use isTruthy instead of Boolean

```ts
// before — TypeScript still thinks items is (User | null)[]
const items = results.filter(Boolean)

// after — properly narrows to User[]
function isTruthy<T>(value: T): value is NonNullable<T> {
  return Boolean(value)
}
const items = results.filter(isTruthy)
```

### Never silently suppress errors

```ts
// before — swallows the error, debugging nightmare
try {
  await sendEmail(user.email)
} catch {}

// after — log and continue if non-critical
const emailResult = await sendEmail(user.email).catch(
  (e) => new EmailError({ email: user.email, cause: e }),
)
if (emailResult instanceof Error) {
  console.warn('Failed to send email:', emailResult.message)
}
```

## Quick Reference

```ts
import * as errore from 'errore'

// Define errors with $variable interpolation
class MyError extends errore.createTaggedError({
  name: 'MyError',
  message: 'Operation failed: $reason',
}) {}

// Return errors instead of throwing
function myFn(): MyError | string {
  if (bad) return new MyError({ reason: 'something went wrong' })
  return 'success'
}

// Early return pattern
const result = myFn()
if (result instanceof Error) return result
// result is string here

// Handle at top level
if (result instanceof Error) {
  const msg = errore.matchError(result, {
    MyError: (e) => e.reason,
    Error: (e) => `Unknown: ${e.message}`, // required fallback for plain Error
  })
  console.log(msg)
}
```
