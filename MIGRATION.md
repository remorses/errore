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
if (user instanceof Error) return user  // early return, like Go

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
import { createTaggedError } from 'errore'

// Database errors
class DbConnectionError extends createTaggedError({
  name: 'DbConnectionError',
  message: '$message',
}) {}

class RecordNotFoundError extends createTaggedError({
  name: 'RecordNotFoundError',
  message: '$table with id $id not found',
}) {}

// Network errors
class NetworkError extends createTaggedError({
  name: 'NetworkError',
  message: 'Request to $url failed: $reason',
}) {}

// Validation errors
class ValidationError extends createTaggedError({
  name: 'ValidationError',
  message: 'Invalid $field: $reason',
}) {}

// Auth errors
class UnauthorizedError extends createTaggedError({
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
import { tryAsync } from 'errore'

async function getUserById(id: string): Promise<DbConnectionError | RecordNotFoundError | User> {
  const result = await tryAsync({
    try: () => db.query('SELECT * FROM users WHERE id = ?', [id]),
    catch: (e) => new DbConnectionError({ message: 'Database query failed', cause: e })
  })
  
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
type GetFullUserError = 
  | DbConnectionError 
  | RecordNotFoundError

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
import { matchError } from 'errore'

app.get('/users/:id', async (req, res) => {
  const user = await getFullUser(req.params.id)
  
  if (user instanceof Error) {
    const response = matchError(user, {
      RecordNotFoundError: (e) => ({ status: 404, body: { error: `${e.table} ${e.id} not found` } }),
      DbConnectionError: (e) => ({ status: 500, body: { error: 'Database error' } }),
    })
    return res.status(response.status).json(response.body)
  }
  
  return res.json(user)
})
```

## Common Patterns

### Wrapping External Libraries

Use `tryFn` or `tryAsync` to wrap functions that throw:

```ts
import { tryFn, tryAsync } from 'errore'

// Sync: JSON parsing
function parseJson(input: string): ValidationError | unknown {
  const result = tryFn({
    try: () => JSON.parse(input),
    catch: () => new ValidationError({ field: 'json', reason: 'Invalid JSON' })
  })
  return result
}

// Async: fetch wrapper
async function fetchJson<T>(url: string): Promise<NetworkError | T> {
  const response = await tryAsync({
    try: () => fetch(url),
    catch: (e) => new NetworkError({ url, reason: `Fetch failed: ${e}` })
  })
  if (response instanceof Error) return response
  
  if (!response.ok) {
    return new NetworkError({ url, reason: `HTTP ${response.status}` })
  }
  
  const data = await tryAsync({
    try: () => response.json() as Promise<T>,
    catch: () => new NetworkError({ url, reason: 'Invalid JSON response' })
  })
  return data
}
```

### Optional Values: Use `| null`

Combine error handling with optional values naturally:

```ts
import { tryAsync } from 'errore'

async function findUserByEmail(email: string): Promise<DbConnectionError | User | null> {
  const result = await tryAsync({
    try: () => db.query('SELECT * FROM users WHERE email = ?', [email]),
    catch: (e) => new DbConnectionError({ message: 'Query failed', cause: e })
  })
  
  if (result instanceof Error) return result
  return result ?? null  // explicitly return null if not found
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
    return new ValidationError({ field: 'body', reason: 'Invalid request body' })
  }
  
  const { email, name } = input as Record<string, unknown>
  
  if (typeof email !== 'string' || !email.includes('@')) {
    return new ValidationError({ field: 'email', reason: 'Invalid email' })
  }
  
  if (typeof name !== 'string' || name.length < 2) {
    return new ValidationError({ field: 'name', reason: 'Name must be at least 2 characters' })
  }
  
  return { email, name }
}
```

### Multiple Sequential Operations

```ts
import { isOk } from 'errore'

async function createUserWithProfile(
  input: CreateUserInput
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
  userId: string
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
let config;
try {
  config = JSON.parse(fs.readFileSync('config.json', 'utf-8'))
} catch (e) {
  config = { port: 3000, debug: false }  // fallback
}
```

**After:** Use `unwrapOr` for a one-liner
```ts
import { tryFn, unwrapOr } from 'errore'

const config = unwrapOr(
  tryFn(() => JSON.parse(fs.readFileSync('config.json', 'utf-8'))),
  { port: 3000, debug: false }
)
```

#### Pattern 2: Different fallback logic based on error

**Before:**
```ts
let user;
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
const user = fetchResult instanceof RecordNotFoundError
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
let result;
let attempts = 0;
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
import { isOk } from 'errore'

async function fetchWithRetry(): Promise<NetworkError | Data> {
  for (let attempt = 0; attempt < 3; attempt++) {
    const result = await fetchData()
    if (isOk(result)) return result
    
    if (attempt < 2) await sleep(1000)  // don't sleep on last attempt
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

**After:** Use `partition` or filter
```ts
import { partition } from 'errore'

const allResults = await Promise.all(ids.map(fetchItem))
const [items, errors] = partition(allResults)

// Log errors if needed
errors.forEach(e => console.warn('Failed:', e.message))

// items contains only successful results
```

#### Pattern 5: Transform or default

**Before:**
```ts
let value;
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
let data;
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
import { isOk } from 'errore'

const cached = cache.get(key)  // returns Data | null

const data = cached ?? await (async () => {
  const fetched = await fetchFromDb(key)
  if (isOk(fetched)) cache.set(key, fetched)
  return fetched
})()
```

Or simpler:
```ts
import { isOk } from 'errore'

async function getWithCache(key: string): Promise<DbError | Data> {
  const cached = cache.get(key)
  if (cached) return cached
  
  const fetched = await fetchFromDb(key)
  if (isOk(fetched)) cache.set(key, fetched)
  
  return fetched
}
```

#### Pattern 7: Multiple sources with fallback chain

**Before:**
```ts
let config;
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

**After:** Chain with `??` and `unwrapOr`
```ts
import { isOk } from 'errore'

const envConfig = loadFromEnv()      // ConfigError | Config
const fileConfig = loadFromFile()    // ConfigError | Config

const config = isOk(envConfig) ? envConfig
  : isOk(fileConfig) ? fileConfig
  : defaultConfig
```

Or as a function:
```ts
import { isOk } from 'errore'

function loadConfig(): Config {
  const sources = [loadFromEnv, loadFromFile]
  
  for (const load of sources) {
    const result = load()
    if (isOk(result)) return result
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
import { unwrap } from 'errore'

// New code using errore
async function getUser(id: string): Promise<DbConnectionError | User> {
  // ... returns error or value
}

// Old code that expects throws - use unwrap at the boundary
async function legacyHandler(id: string) {
  const user = await getUser(id)
  // unwrap throws if error, returns value otherwise
  return unwrap(user, 'Failed to get user')
}
```

## Checklist

- [ ] Define error types in `errors.ts` using `createTaggedError`
- [ ] Identify leaf functions (database, network, file I/O)
- [ ] Migrate leaf functions to return `Error | Value`
- [ ] Update function signatures with explicit error unions
- [ ] Replace `try-catch` with `instanceof Error` checks and early returns
- [ ] Use `matchError` at top-level handlers for exhaustive handling
- [ ] Use `| null` for optional values instead of `| undefined`
- [ ] Add `_` handler in `matchError` if you need to catch unexpected errors

## Quick Reference

```ts
import { createTaggedError, tryFn, tryAsync, isOk, unwrap, unwrapOr, match, matchError } from 'errore'

// Define errors with $variable interpolation
class MyError extends createTaggedError({
  name: 'MyError',
  message: 'Operation failed: $reason'
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
  const msg = matchError(result, {
    MyError: e => e.reason,
    _: e => `Unknown: ${e.message}`  // plain Error fallback
  })
  console.log(msg)
}
```
