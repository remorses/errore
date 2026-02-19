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
import { TaggedError } from 'errore'

// !focus(1:3)
class NotFoundError extends TaggedError(
  'NotFoundError'
)<{ id: string }>() {}

// !focus(1:3)
class NetworkError extends TaggedError(
  'NetworkError'
)<{ url: string }>() {}
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

// !focus(1:5)
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

// !focus(1:6)
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

## Pattern Matching

Exhaustive handling of all error cases.

```typescript
import { Effect, Match } from 'effect'

const program = fetchUser(id).pipe(
  // !focus(1:8)
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
import { matchError } from 'errore'

const user = await fetchUser(id)

// !focus(1:5)
if (user instanceof Error) {
  const message = matchError(user, {
    NotFoundError: e => `User ${e.id} missing`,
    NetworkError: e => `Failed: ${e.url}`,
  })
  console.log(message)
}
```

---

## Parallel Operations

Running multiple operations concurrently and handling individual failures.

```typescript
import { Effect } from 'effect'

// !focus(1:5)
const program = Effect.all([
  fetchUser(id),
  fetchPosts(id),
  fetchStats(id),
])

// !focus(1:6)
const result = await Effect.runPromise(
  program.pipe(
    Effect.catchTag('NotFoundError', () =>
      Effect.succeed([null, [], null])
    )
  )
)
```

```typescript
// !focus(1:5)
const [user, posts, stats] = await Promise.all([
  fetchUser(id),
  fetchPosts(id),
  fetchStats(id),
])

// !focus(1:5)
if (user instanceof Error) {
  console.error('User fetch failed', user)
}
if (posts instanceof Error) {
  console.error('Posts fetch failed', posts)
}
if (stats instanceof Error) {
  console.error('Stats fetch failed', stats)
}
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
import { trySync } from 'errore'

// !focus(1:6)
function parseConfig(
  input: string
): ParseError | Config {
  const result = trySync(() => JSON.parse(input))
  if (result instanceof Error) {
    return new ParseError({
      reason: result.message
    })
  }
  return result
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

// !focus(1:4)
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
// !focus(1:4)
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
