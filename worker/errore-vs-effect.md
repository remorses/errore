# Getting Started

---

## Defining Errors

How each approach defines typed error classes.

```typescript
import { Data } from 'effect'

// !focus(1:3)
class NotFoundError extends Data.TaggedError(
  'NotFoundError'
)<{ readonly id: string }> {}

// !focus(1:3)
class NetworkError extends Data.TaggedError(
  'NetworkError'
)<{ readonly url: string }> {}
```

```typescript
import * as errore from 'errore'

// !focus(1:4)
class NotFoundError extends errore.createTaggedError({
  name: 'NotFoundError',
  message: 'User $id not found',
}) {}

// !focus(1:4)
class NetworkError extends errore.createTaggedError({
  name: 'NetworkError',
  message: 'Request to $url failed',
}) {}
```

---

## The Effect Type

Effect tracks three type parameters for every operation. errore uses a plain union.

```typescript
import { Effect } from 'effect'

// !focus(1:10)
//         ┌── success
//         │      ┌── error
//         │      │         ┌── dependencies
//         ▼      ▼         ▼
// Effect< User,  HttpError, Database >
type GetUser = Effect.Effect<
  User,
  NotFoundError | NetworkError,
  Database
>

// Every function returns this 3-param type
// !focus(1:5)
function getUser(
  id: string
): Effect.Effect<
  User, NotFoundError | NetworkError, Database
>
```

```typescript
// !focus(1:5)
// Just a union: Error | Value
// No extra type parameters
function getUser(
  id: string
): Promise<NotFoundError | NetworkError | User>

// !focus(1:5)
// The return type tells the full story
const user = await getUser(id)
if (user instanceof NotFoundError) { /* ... */ }
if (user instanceof NetworkError) { /* ... */ }
console.log(user.name) // User
```

---

## Running the Program

Every Effect program must be executed through a runtime. errore returns plain values — no runtime needed.

```typescript
import { Effect } from 'effect'

// !focus(1:6)
// Nothing runs until you call a runner
const program = Effect.gen(function* () {
  const user = yield* fetchUser(id)
  const posts = yield* fetchPosts(user.id)
  return { user, posts }
})

// Choose your runner:
// !focus(1:4)
await Effect.runPromise(program)
Effect.runSync(program)
Effect.runFork(program)
Runtime.runPromise(customRuntime)(program)
```

```typescript
// !focus(1:3)
// Just call the function. It returns a value.
const user = await fetchUser(id)
if (user instanceof Error) return user

const posts = await fetchPosts(user.id)
if (posts instanceof Error) return posts

// !focus(1:2)
// No runtime needed. Already done.
return { user, posts }
```

---

## Basic Error Handling

Fetching a user and handling a potential error.

```typescript
import { Effect } from 'effect'

function getUser(id: string) {
  return Effect.gen(function* () {
    // !focus(1:2)
    const user = yield* fetchUser(id)
    return user
  })
}

// !focus(1:7)
const result = Effect.runSync(
  getUser('123').pipe(
    Effect.catchTag('NotFoundError', (e) =>
      Effect.succeed(null)
    )
  )
)
```

```typescript
function getUser(
  id: string
): NotFoundError | User {
  // !focus(1:2)
  const user = fetchUser(id)
  if (user instanceof NotFoundError) return user
  return user
}

// !focus(1:2)
const user = getUser('123')
if (user instanceof NotFoundError) {
  console.log('not found')
}
console.log(user.name)
```

---

# Error Handling

---

## Catching Specific Errors

Selectively recovering from specific error types while letting others propagate.

```typescript
import { Effect } from 'effect'

// catchTag — handle one specific error
// !focus(1:7)
const program = fetchUser(id).pipe(
  Effect.catchTag('NotFoundError', (e) =>
    Effect.succeed(
      { name: 'guest', id: e.id }
    )
  )
)
// NetworkError still propagates

// catchTags — handle multiple error types
// !focus(1:10)
const handled = fetchUser(id).pipe(
  Effect.catchTags({
    NotFoundError: (e) =>
      Effect.succeed({ name: 'guest', id: e.id }),
    NetworkError: (e) =>
      Effect.succeed(
        { name: 'offline', id: 'unknown' }
      )
  })
)

await Effect.runPromise(handled)
```

```typescript
// !focus(1:5)
// Handle one specific error, let others propagate
const user = await fetchUser(id)
if (user instanceof NotFoundError) {
  return { name: 'guest', id: user.id }
}
if (user instanceof Error) return user
// NetworkError propagates, user is User here
```

---

## Pattern Matching

Exhaustive handling of all error cases.

```typescript
import { Effect, Match } from 'effect'

const program = fetchUser(id).pipe(
  // !focus(1:11)
  Effect.catchAll((error) =>
    Match.value(error).pipe(
      Match.tag('NotFoundError', (e) =>
        Effect.succeed(`User ${e.id} missing`)
      ),
      Match.tag('NetworkError', (e) =>
        Effect.succeed(`Failed: ${e.url}`)
      ),
      Match.exhaustive
    )
  )
)
```

```typescript
import * as errore from 'errore'

const user = await fetchUser(id)

// !focus(1:6)
if (user instanceof Error) {
  const message = errore.matchError(user, {
    NotFoundError: e => `User ${e.id} missing`,
    NetworkError: e => `Failed: ${e.url}`,
    Error: e => `Unexpected: ${e.message}`,
  })
  console.log(message)
}
```

---

## Short-Circuiting

When an error occurs in a chain of operations, all subsequent steps are skipped.

```typescript
import { Effect, Console } from 'effect'

const task1 = Console.log('step 1...')
const task2 = Effect.fail(new NetworkError({
  url: '/api'
}))
const task3 = Console.log('step 3...')

// !focus(1:6)
const program = Effect.gen(function* () {
  yield* task1     // runs
  yield* task2     // fails — short circuits
  yield* task3     // never reached
})

// Output: "step 1..."
// Then fails with NetworkError
await Effect.runPromise(program)
```

```typescript
// !focus(1:2)
console.log('step 1...')

const result = fetchData()
// !focus(1:2)
// Fails — early return, skip the rest
if (result instanceof Error) return result

// !focus(1:2)
// Never reached if fetchData failed
console.log('step 3...')
```

---

## Error Propagation

How errors flow through the call stack.

```typescript
import { Effect } from 'effect'

// !focus(1:5)
function getUser(id: string): Effect.Effect<
  User,
  NotFoundError | NetworkError,
  never
>

// !focus(1:8)
const program = getUser('123').pipe(
  Effect.flatMap((user) =>
    getPosts(user.id)
  ),
  // Errors from both getUser and getPosts
  // accumulate in the channel type
  Effect.catchAll(handleError)
)
```

```typescript
// !focus(1:4)
function getUser(
  id: string
): NotFoundError | NetworkError | User

// !focus(1:6)
const user = getUser('123')
if (user instanceof Error) return user

const posts = getPosts(user.id)
if (posts instanceof Error) return posts
// TypeScript knows posts is Post[]
```

---

## Fallback Chain

Trying multiple strategies in sequence, falling back on failure.

```typescript
import { Effect } from 'effect'

// !focus(1:10)
const program = fetchFromCache(id).pipe(
  Effect.orElse(() => fetchFromDb(id)),
  Effect.orElse(() => fetchFromApi(id)),
  Effect.catchAll(() =>
    Effect.succeed({
      name: 'Unknown',
      id
    })
  )
)

await Effect.runPromise(program)
```

```typescript
// !focus(1:8)
const cache = await fetchFromCache(id)
if (!(cache instanceof Error)) return cache

const db = await fetchFromDb(id)
if (!(db instanceof Error)) return db

const api = await fetchFromApi(id)
if (!(api instanceof Error)) return api

// !focus(1:2)
// All sources failed — return default
return { name: 'Unknown', id }
```

---

## Error Accumulation

Collecting all errors instead of short-circuiting on the first failure.

```typescript
import { Effect } from 'effect'

// !focus(1:10)
const program = Effect.forEach(
  userIds,
  (id) => fetchUser(id),
  { concurrency: 'unbounded' }
).pipe(
  Effect.validate,
  Effect.catchAll(([errors]) =>
    Effect.succeed({ errors, users: [] })
  )
)

// Or partition with Effect.partition
// !focus(1:7)
const [errors, users] = await Effect.runPromise(
  Effect.partition(
    userIds,
    (id) => fetchUser(id),
    { concurrency: 'unbounded' }
  )
)
```

```typescript
import * as errore from 'errore'

// !focus(1:5)
const results = await Promise.all(
  userIds.map((id) => fetchUser(id))
)

const [users, errors] = errore.partition(results)
// users: User[], errors: Error[]

// !focus(1:3)
errors.forEach((e) =>
  console.warn('Failed:', e.message)
)
```

---

# Async, Retries & Timeouts

---

## Async Operations

Handling async operations that can fail.

```typescript
import { Effect } from 'effect'

// !focus(1:7)
const getUser = (id: string) =>
  Effect.tryPromise({
    try: () => fetch(`/api/users/${id}`)
      .then(r => r.json()),
    catch: () =>
      new NetworkError({ url: `/api/users/${id}` })
  })

const program = Effect.gen(function* () {
  // !focus
  const user = yield* getUser('123')
  return user
})

await Effect.runPromise(program)
```

```typescript
// !focus(1:8)
async function getUser(
  id: string
): Promise<NetworkError | User> {
  const res = await fetch(`/api/users/${id}`)
    .catch(() => null)
  if (!res) return new NetworkError({
    url: `/api/users/${id}`
  })
  return res.json()
}

// !focus(1:2)
const user = await getUser('123')
if (user instanceof NetworkError) return user
console.log(user.name)
```

---

## Retrying with Backoff

Retrying a failing operation with exponential backoff and a maximum number of attempts.

```typescript
import { Effect, Schedule } from 'effect'

// !focus(1:5)
const policy = Schedule.exponential('100 millis').pipe(
  Schedule.compose(Schedule.recurs(3)),
  Schedule.union(
    Schedule.spaced('5 seconds')
  )
)

const program = Effect.gen(function* () {
  // !focus(1:4)
  const user = yield* Effect.retry(
    fetchUser(id),
    policy
  )
  return user
})

await Effect.runPromise(program)
```

```typescript
// !focus(1:10)
async function fetchWithRetry(
  id: string
): Promise<NetworkError | User> {
  for (let i = 0; i < 3; i++) {
    const user = await fetchUser(id)
    if (!(user instanceof Error)) return user
    await sleep(100 * 2 ** i)
  }
  return new NetworkError({ url: `/users/${id}` })
}

// !focus(1:2)
const user = await fetchWithRetry(id)
if (user instanceof Error) return user
console.log(user.name)
```

---

## Retry Until Condition

Retrying until a specific error condition is met, with different handling for the final error.

```typescript
import { Effect } from 'effect'

// !focus(1:8)
const program = Effect.retry(
  fetchUser(id),
  {
    times: 5,
    until: (err) =>
      err._tag === 'NotFoundError'
  }
)

// Or with retryOrElse for a fallback
// !focus(1:8)
const withFallback = Effect.retryOrElse(
  fetchUser(id),
  Schedule.recurs(3),
  (error, _) =>
    Effect.succeed(
      { name: 'guest', id: 'unknown' }
    )
)

await Effect.runPromise(withFallback)
```

```typescript
// !focus(1:11)
async function fetchWithRetry(
  id: string
): Promise<NotFoundError | NetworkError | User> {
  for (let i = 0; i < 5; i++) {
    const user = await fetchUser(id)
    // Don't retry if it's a NotFoundError
    if (user instanceof NotFoundError) return user
    if (!(user instanceof Error)) return user
  }
  return new NetworkError({ url: `/users/${id}` })
}

// Or with a fallback on exhaustion
// !focus(1:4)
const user = await fetchWithRetry(id)
const result = user instanceof Error
  ? { name: 'guest', id: 'unknown' }
  : user
```

---

## Timeout

Aborting an operation if it takes too long and returning a typed error.

```typescript
import { Effect } from 'effect'

// !focus(1:9)
const program = fetchUser(id).pipe(
  Effect.timeoutFail({
    duration: '5 seconds',
    onTimeout: () => new TimeoutError({
      operation: 'fetchUser',
      duration: '5s'
    })
  })
)

// The error channel now includes TimeoutError
// !focus(1:7)
const result = await Effect.runPromise(
  program.pipe(
    Effect.catchTag('TimeoutError', (e) =>
      Effect.succeed(null)
    )
  )
)
```

```typescript
import * as errore from 'errore'

// !focus(1:7)
async function fetchWithTimeout(
  id: string
): Promise<TimeoutError | NetworkError | User> {
  const controller = new AbortController()
  const timer = setTimeout(
    () => controller.abort(), 5000
  )

  // !focus(1:8)
  const user = await errore.tryAsync({
    try: () => fetchUser(id, {
      signal: controller.signal
    }),
    catch: (e) => e.name === 'AbortError'
      ? new TimeoutError({ operation: 'fetchUser' })
      : new NetworkError({ url: `/users/${id}` })
  })
  clearTimeout(timer)

  // !focus(1:2)
  if (user instanceof Error) return user
  console.log(user.name)
}
```

---

## Parallel Operations

Running multiple operations concurrently and handling individual failures.

```typescript
import { Effect } from 'effect'

// !focus(1:7)
const program = Effect.all([
  fetchUser(id),
  fetchPosts(id),
  fetchStats(id),
], { concurrency: 'unbounded' })

// All succeed or the first error propagates
await Effect.runPromise(program)
```

```typescript
// !focus(1:5)
const [user, posts, stats] = await Promise.all([
  fetchUser(id),
  fetchPosts(id),
  fetchStats(id),
])

// !focus(1:4)
// Check each result individually
if (user instanceof Error) return user
if (posts instanceof Error) return posts
if (stats instanceof Error) return stats

return { user, posts, stats }
```

---

# Cancellation & Cleanup

---

## Interruption

Cancelling a running operation from the outside using fibers.

```typescript
import { Effect, Fiber } from 'effect'

const program = Effect.gen(function* () {
  // !focus(1:2)
  // Fork a long-running task into a fiber
  const fiber = yield* Effect.fork(longRunningTask)

  // Do other work...
  yield* doSomethingElse()

  // !focus(1:2)
  // Cancel the fiber if still running
  yield* Fiber.interrupt(fiber)
})

// Or race two effects — loser gets interrupted
// !focus(1:4)
const fastest = Effect.race(
  fetchFromPrimary(id),
  fetchFromReplica(id)
)

await Effect.runPromise(fastest)
```

```typescript
// !focus(1:4)
// AbortController replaces fibers
const controller = new AbortController()
const task = longRunningTask(controller.signal)

// Do other work...
await doSomethingElse()

// !focus(1:2)
// Cancel the task
controller.abort()

// Or race two operations — first wins
// !focus(1:5)
const fastest = await Promise.race([
  fetchFromPrimary(id),
  fetchFromReplica(id),
])
if (fastest instanceof Error) return fastest
```

---

## Ensuring Cleanup on Interruption

Guaranteeing resource cleanup even when an operation is cancelled or interrupted.

```typescript
import { Effect } from 'effect'

// !focus(1:11)
const withConnection = Effect.acquireRelease(
  Effect.sync(() => {
    const conn = createConnection()
    console.log('opened')
    return conn
  }),
  (conn) => Effect.sync(() => {
    conn.close()
    console.log('closed')
  })
)

// !focus(1:7)
const program = Effect.scoped(
  Effect.gen(function* () {
    const conn = yield* withConnection
    const data = yield* query(conn, sql)
    return data
  })
)

// If interrupted, the connection is still closed
await Effect.runPromise(program)
```

```typescript
import * as errore from 'errore'

// !focus(1:4)
async function queryDb(
  sql: string
): Promise<DbError | Row[]> {
  await using cleanup = new errore.AsyncDisposableStack()

  // !focus(1:6)
  const conn = createConnection()
  console.log('opened')
  cleanup.defer(() => {
    conn.close()
    console.log('closed')
  })

  // !focus(1:5)
  // If anything fails, connection is still closed
  return errore.tryAsync({
    try: () => query(conn, sql),
    catch: (e) => new DbError({ cause: e }),
  })
}

// !focus(1:2)
const data = await queryDb(sql)
if (data instanceof Error) return data
```

---

## Finalization (ensuring / onExit)

Guaranteeing a cleanup step runs regardless of success, failure, or interruption.

```typescript
import { Effect, Console } from 'effect'

// !focus(1:5)
// ensuring: cleanup runs on success, failure,
// and interruption
const program = Effect.gen(function* () {
  const data = yield* fetchData()
  return data
}).pipe(
  // !focus(1:3)
  Effect.ensuring(
    Console.log('Cleanup completed')
  )
)

// onExit: cleanup receives the Exit value
// !focus(1:8)
const withExit = Effect.gen(function* () {
  const data = yield* fetchData()
  return data
}).pipe(
  Effect.onExit((exit) =>
    Console.log(`Exit: ${exit._tag}`)
  )
)

await Effect.runPromise(program)
```

```typescript
import * as errore from 'errore'

// !focus(1:4)
// await using = cleanup runs on every exit path
async function getData(): Promise<FetchError | Data> {
  await using cleanup =
    new errore.AsyncDisposableStack()

  // !focus(1:3)
  cleanup.defer(() =>
    console.log('Cleanup completed')
  )

  const data = await errore.tryAsync({
    try: () => fetchData(),
    catch: (e) => new FetchError({ cause: e }),
  })
  return data
  // cleanup runs automatically
}
```

---

## Scoped Finalizers (addFinalizer)

Registering cleanup actions within a scope that execute when the scope closes — regardless of how it closes.

```typescript
import { Effect, Console } from 'effect'

// !focus(1:9)
const program = Effect.gen(function* () {
  yield* Effect.addFinalizer((exit) =>
    Console.log(
      `Finalizer: ${exit._tag}`
    )
  )
  const data = yield* fetchData()
  return data
})

// !focus(1:2)
// Must wrap in Effect.scoped to provide the Scope
const runnable = Effect.scoped(program)

await Effect.runPromise(runnable)
// Output: Finalizer: Success
```

```typescript
import * as errore from 'errore'

// !focus(1:7)
async function getData(): Promise<FetchError | Data> {
  await using cleanup =
    new errore.AsyncDisposableStack()

  cleanup.defer(() =>
    console.log('Finalizer: done')
  )

  // !focus(1:4)
  const data = await errore.tryAsync({
    try: () => fetchData(),
    catch: (e) => new FetchError({ cause: e }),
  })
  return data
  // "Finalizer: done" runs on every exit path
}
```

---

## Multiple Resources with Defer

Managing multiple resources where cleanup order matters — each resource must be released even if earlier cleanup fails.

```typescript
import { Effect } from 'effect'

// !focus(1:8)
const withDb = Effect.acquireRelease(
  Effect.promise(() => connectDb()),
  (db) => Effect.promise(() => db.close())
)
const withCache = Effect.acquireRelease(
  Effect.promise(() => openCache()),
  (cache) => Effect.promise(() => cache.flush())
)

// !focus(1:14)
const program = Effect.scoped(
  Effect.gen(function* () {
    const db = yield* withDb
    const cache = yield* withCache
    const order = yield* Effect.tryPromise({
      try: () => db.query(orderId),
      catch: () => new DbError({ orderId })
    })
    yield* Effect.promise(
      () => cache.set(orderId, order)
    )
    return order
  })
)

await Effect.runPromise(program)
```

```typescript
import * as errore from 'errore'

// !focus(1:3)
async function processOrder(
  orderId: string
): Promise<DbError | CacheError | Order> {
  // !focus(1:2)
  await using cleanup =
    new errore.AsyncDisposableStack()

  // !focus(1:4)
  const db = await errore.tryAsync({
    try: () => connectDb(),
    catch: (e) => new DbError({ orderId, cause: e }),
  })
  if (db instanceof Error) return db
  cleanup.defer(() => db.close())

  // !focus(1:5)
  const cache = await errore.tryAsync({
    try: () => openCache(),
    catch: (e) =>
      new CacheError({ orderId, cause: e }),
  })
  if (cache instanceof Error) return cache
  cleanup.defer(() => cache.flush())

  // !focus(1:4)
  const order = await errore.tryAsync({
    try: () => db.query(orderId),
    catch: (e) => new DbError({ orderId, cause: e }),
  })
  if (order instanceof Error) return order

  await cache.set(orderId, order)
  return order
  // cleanup: cache.flush() → db.close()
}
```

---

## Timeout with Resource Cleanup

Aborting an operation after a deadline while ensuring resources are released.

```typescript
import { Effect } from 'effect'

// !focus(1:10)
const program = Effect.scoped(
  Effect.gen(function* () {
    const conn = yield* acquireConnection
    yield* Effect.addFinalizer(() =>
      Effect.promise(() => conn.close())
    )
    return yield* Effect.tryPromise(
      () => conn.query(sql)
    )
  })
).pipe(
  // !focus(1:6)
  Effect.timeoutFail({
    duration: '5 seconds',
    onTimeout: () => new TimeoutError({
      operation: 'query'
    })
  })
)

await Effect.runPromise(program)
```

```typescript
import * as errore from 'errore'

// !focus(1:5)
async function queryWithTimeout(
  sql: string
): Promise<TimeoutError | DbError | Row[]> {
  await using cleanup =
    new errore.AsyncDisposableStack()

  // !focus(1:6)
  // AbortController for cancellation
  const controller = new AbortController()
  const timer = setTimeout(
    () => controller.abort(), 5000
  )
  cleanup.defer(() => clearTimeout(timer))

  // !focus(1:6)
  const conn = await errore.tryAsync({
    try: () => connect({ signal: controller.signal }),
    catch: (e) => e.name === 'AbortError'
      ? new TimeoutError({ operation: 'connect' })
      : new DbError({ cause: e }),
  })
  if (conn instanceof Error) return conn
  cleanup.defer(() => conn.close())

  // !focus(1:6)
  return errore.tryAsync({
    try: () => conn.query(sql),
    catch: (e) => e.name === 'AbortError'
      ? new TimeoutError({ operation: 'query' })
      : new DbError({ cause: e }),
  })
  // cleanup: conn.close() → clearTimeout()
}
```

---

# Architecture

---

## Composing Operations

Chaining multiple fallible operations together.

```typescript
import { Effect } from 'effect'

const program = Effect.gen(function* () {
  // !focus(1:3)
  const user = yield* fetchUser(id)
  const posts = yield* fetchPosts(user.id)
  const enriched = yield* enrichPosts(posts)
  return enriched
})

// !focus(1:10)
const result = await Effect.runPromise(
  program.pipe(
    Effect.catchTag('NotFoundError', () =>
      Effect.succeed([])
    ),
    Effect.catchTag('NetworkError', () =>
      Effect.succeed([])
    )
  )
)
```

```typescript
// !focus(1:3)
const user = await fetchUser(id)
if (user instanceof NotFoundError) return []
if (user instanceof NetworkError) return []

// !focus(1:2)
const posts = await fetchPosts(user.id)
if (posts instanceof NetworkError) return []

// !focus(1:2)
const enriched = await enrichPosts(posts)
if (enriched instanceof Error) return []

return enriched
```

---

## Dependency Injection

Effect requires Context.Tag, Layer, and provideService to manage dependencies. errore uses plain function parameters.

```typescript
import { Effect, Context, Layer } from 'effect'

// !focus(1:4)
class Database extends Context.Tag('Database')<
  Database,
  { query: (sql: string) => Effect.Effect<Row[]> }
>() {}

// !focus(1:5)
const program = Effect.gen(function* () {
  const db = yield* Database
  const rows = yield* db.query('SELECT * FROM users')
  return rows
})

// Must provide the service before running
// !focus(1:9)
const DatabaseLive = Layer.succeed(
  Database,
  {
    query: (sql) =>
      Effect.tryPromise(() =>
        pg.query(sql).then(r => r.rows)
      )
  }
)

const runnable = Effect.provide(
  program,
  DatabaseLive
)

await Effect.runPromise(runnable)
```

```typescript
import * as errore from 'errore'

// !focus(1:4)
// Just pass the dependency as a parameter
async function getUsers(
  db: { query: (sql: string) => Promise<Row[]> }
): Promise<DbError | Row[]> {
  return errore.tryAsync({
    try: () => db.query('SELECT * FROM users'),
    catch: (e) => new DbError({ cause: e }),
  })
}

// !focus(1:4)
// Call it directly with the real db
const rows = await getUsers(pg)
// Or in tests with a mock
const rows = await getUsers(mockDb)
```

---

## Wrapping Libraries That Throw

Converting exception-throwing code to typed errors.

```typescript
import { Effect } from 'effect'

// !focus(1:7)
const parseConfig = (input: string) =>
  Effect.try({
    try: () => JSON.parse(input),
    catch: (e) => new ParseError({
      reason: String(e)
    })
  })

const program = Effect.gen(function* () {
  // !focus
  const config = yield* parseConfig(raw)
  return config
})
```

```typescript
import * as errore from 'errore'

// !focus(1:10)
function parseConfig(
  input: string
): ParseError | Config {
  return errore.try({
    try: () => JSON.parse(input),
    catch: (e) => new ParseError({
      reason: e.message
    })
  })
}

// !focus(1:2)
const config = parseConfig(raw)
if (config instanceof ParseError) return config
console.log(config.dbUrl)
```

---

## Library Authoring

Which approach is better for public APIs? Effect requires callers to install and learn the entire Effect ecosystem. errore uses plain TypeScript unions — **zero new dependencies** for your users.

```typescript
import { Effect } from 'effect'

// !focus(1:5)
export function parse(
  input: string
): Effect.Effect<AST, ParseError> {
  // ...
}

// Callers need:
// !focus(1:3)
// npm install effect
// Learn Effect, pipe, gen, yield*
// 50+ modules in the effect ecosystem
```

```typescript
// !focus(1:5)
export function parse(
  input: string
): AST | ParseError {
  // ...
}

// Callers need:
// !focus(1:3)
// Nothing. Standard instanceof.
// No new concepts, no new deps.
// Works with any TypeScript project.
```
