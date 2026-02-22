# Before & After: Fetching a Todo

Four progressive examples showing how errore eliminates nested try/catch while keeping full type safety. Each step adds real-world complexity: retries, timeouts, and tracing.

---

## 1. Basic Fetch

### Before

```ts
async function getTodo(
  id: number,
): Promise<
  | { ok: true; todo: any }
  | { ok: false; error: 'InvalidJson' | 'RequestFailed' }
> {
  try {
    const response = await fetch(`/todos/${id}`)
    if (!response.ok) throw new Error('Not OK!')
    try {
      const todo = await response.json()
      return { ok: true, todo }
    } catch (jsonError) {
      return { ok: false, error: 'InvalidJson' }
    }
  } catch (error) {
    return { ok: false, error: 'RequestFailed' }
  }
}
```

**Problems:**

- Nested try/catch to distinguish fetch errors from JSON parse errors
- Manual `{ ok, error }` discriminant — TypeScript can't enforce exhaustive handling
- `throw new Error("Not OK!")` just to jump to the outer catch — using exceptions for control flow
- Caller must check `result.ok` and cast `result.error` manually

### After

```ts
import * as errore from 'errore'

class InvalidJsonError extends errore.createTaggedError({
  name: 'InvalidJsonError',
  message: 'Failed to parse response for todo $id',
}) {}

class RequestFailedError extends errore.createTaggedError({
  name: 'RequestFailedError',
  message: 'Request failed for todo $id',
}) {}

async function getTodo(
  id: number,
): Promise<InvalidJsonError | RequestFailedError | { todo: any }> {
  const response = await fetch(`/todos/${id}`).catch(
    (e) => new RequestFailedError({ id: String(id), cause: e }),
  )
  if (response instanceof Error) return response

  if (!response.ok) {
    return new RequestFailedError({ id: String(id) })
  }

  const body = await response
    .json()
    .catch((e) => new InvalidJsonError({ id: String(id), cause: e }))
  if (body instanceof Error) return body

  return { todo: body }
}
```

**What changed:**

- No try/catch at all — `.catch()` converts exceptions to values
- Each error is a distinct class with typed properties and a `cause` chain
- Flat control flow: check, return early, continue
- Return type `InvalidJsonError | RequestFailedError | { todo: any }` is a real union — TypeScript enforces exhaustive handling at the call site

### Caller

```ts
const result = await getTodo(1)

if (result instanceof Error) {
  // Exhaustive match on error type
  const msg = errore.matchError(result, {
    InvalidJsonError: (e) => `Bad JSON for todo ${e.id}`,
    RequestFailedError: (e) => `Fetch failed for todo ${e.id}`,
    Error: (e) => `Unexpected: ${e.message}`,
  })
  console.error(msg)
  return
}

console.log(result.todo) // TypeScript knows: { todo: any }
```

---

## 2. With Retries

### Before

```ts
function getTodo(
  id: number,
  {
    retries = 3,
    retryBaseDelay = 1000,
  }: { retries?: number; retryBaseDelay?: number },
): Promise<
  | { ok: true; todo: any }
  | { ok: false; error: 'InvalidJson' | 'RequestFailed' }
> {
  async function execute(
    attempt: number,
  ): Promise<
    | { ok: true; todo: any }
    | { ok: false; error: 'InvalidJson' | 'RequestFailed' }
  > {
    try {
      const response = await fetch(`/todos/${id}`)
      if (!response.ok) throw new Error('Not OK!')
      try {
        const todo = await response.json()
        return { ok: true, todo }
      } catch (jsonError) {
        if (attempt < retries) {
          throw jsonError // jump to retry
        }
        return { ok: false, error: 'InvalidJson' }
      }
    } catch (error) {
      if (attempt < retries) {
        const delayMs = retryBaseDelay * 2 ** attempt
        return new Promise((resolve) =>
          setTimeout(() => resolve(execute(attempt + 1)), delayMs),
        )
      }
      return { ok: false, error: 'RequestFailed' }
    }
  }

  return execute(0)
}
```

**Problems:**

- `throw jsonError` is used to jump from the inner catch to the outer catch for retry — spaghetti control flow
- Retry logic is tangled with error discrimination
- The type signature is duplicated for both `getTodo` and `execute`
- Hard to follow which errors are retried and which are final

### After

```ts
import * as errore from 'errore'

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

class InvalidJsonError extends errore.createTaggedError({
  name: 'InvalidJsonError',
  message: 'Failed to parse response for todo $id',
}) {}

class RequestFailedError extends errore.createTaggedError({
  name: 'RequestFailedError',
  message: 'Request failed for todo $id after $attempts attempts',
}) {}

async function getTodo(
  id: number,
  {
    retries = 3,
    retryBaseDelay = 1000,
  }: { retries?: number; retryBaseDelay?: number },
): Promise<InvalidJsonError | RequestFailedError | { todo: any }> {
  for (let attempt = 0; attempt <= retries; attempt++) {
    const response = await fetch(`/todos/${id}`).catch(
      (e) =>
        new RequestFailedError({
          id: String(id),
          attempts: String(attempt + 1),
          cause: e,
        }),
    )

    if (response instanceof Error) {
      if (attempt < retries) {
        await sleep(retryBaseDelay * 2 ** attempt)
        continue
      }
      return response
    }

    if (!response.ok) {
      if (attempt < retries) {
        await sleep(retryBaseDelay * 2 ** attempt)
        continue
      }
      return new RequestFailedError({
        id: String(id),
        attempts: String(attempt + 1),
      })
    }

    const body = await response
      .json()
      .catch((e) => new InvalidJsonError({ id: String(id), cause: e }))

    if (body instanceof Error) {
      if (attempt < retries) {
        await sleep(retryBaseDelay * 2 ** attempt)
        continue
      }
      return body
    }

    return { todo: body }
  }

  return new RequestFailedError({
    id: String(id),
    attempts: String(retries + 1),
  })
}
```

**What changed:**

- Retry is a plain `for` loop — no recursive `execute()`, no `throw` to jump between catch blocks
- Each failure point independently decides whether to retry or return
- The error includes `attempts` so callers know how many tries were made
- No control flow through exceptions — every path is visible and linear

---

## 3. With Retries + Timeout

### Before

```ts
function getTodo(
  id: number,
  {
    retries = 3,
    retryBaseDelay = 1000,
    signal,
  }: {
    retries?: number
    retryBaseDelay?: number
    signal?: AbortSignal
  },
): Promise<
  | { ok: true; todo: any }
  | {
      ok: false
      error: 'InvalidJson' | 'RequestFailed' | 'Timeout'
    }
> {
  async function execute(attempt: number): Promise<
    | { ok: true; todo: any }
    | {
        ok: false
        error: 'InvalidJson' | 'RequestFailed' | 'Timeout'
      }
  > {
    try {
      const controller = new AbortController()
      setTimeout(() => controller.abort(), 1000)
      signal?.addEventListener('abort', () => controller.abort())
      const response = await fetch(`/todos/${id}`, {
        signal: controller.signal,
      })
      if (!response.ok) throw new Error('Not OK!')
      try {
        const todo = await response.json()
        return { ok: true, todo }
      } catch (jsonError) {
        if (attempt < retries) {
          throw jsonError // jump to retry
        }
        return { ok: false, error: 'InvalidJson' }
      }
    } catch (error) {
      if ((error as Error).name === 'AbortError') {
        return { ok: false, error: 'Timeout' }
      } else if (attempt < retries) {
        const delayMs = retryBaseDelay * 2 ** attempt
        return new Promise((resolve) =>
          setTimeout(() => resolve(execute(attempt + 1)), delayMs),
        )
      }
      return { ok: false, error: 'RequestFailed' }
    }
  }

  return execute(0)
}
```

**Problems:**

- `(error as Error).name === "AbortError"` — stringly-typed runtime check with a type cast
- AbortError check is inside the same catch that handles network errors and JSON errors — timeout vs failure is ambiguous
- The outer catch now handles three different concerns: timeout, retry, and final failure
- Caller signal handling (`signal?.addEventListener`) has no cleanup — potential memory leak

### After

```ts
import * as errore from 'errore'

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

class InvalidJsonError extends errore.createTaggedError({
  name: 'InvalidJsonError',
  message: 'Failed to parse response for todo $id',
}) {}

class RequestFailedError extends errore.createTaggedError({
  name: 'RequestFailedError',
  message: 'Request failed for todo $id after $attempts attempts',
}) {}

class TimeoutError extends errore.createTaggedError({
  name: 'TimeoutError',
  message: 'Request timed out for todo $id',
  extends: errore.AbortError,
}) {}

async function getTodo(
  id: number,
  {
    retries = 3,
    retryBaseDelay = 1000,
    signal,
  }: {
    retries?: number
    retryBaseDelay?: number
    signal?: AbortSignal
  },
): Promise<InvalidJsonError | RequestFailedError | { todo: any }> {
  for (let attempt = 0; attempt <= retries; attempt++) {
    // Abort handling: combine caller signal with per-request timeout
    const controller = new AbortController()
    const timeout = setTimeout(
      () => controller.abort(new TimeoutError({ id: String(id) })),
      1000,
    )
    const onAbort = () => controller.abort()
    signal?.addEventListener('abort', onAbort, { once: true })

    const response = await fetch(`/todos/${id}`, {
      signal: controller.signal,
    }).catch(
      (e) =>
        new RequestFailedError({
          id: String(id),
          attempts: String(attempt + 1),
          cause: e,
        }),
    )

    clearTimeout(timeout)
    signal?.removeEventListener('abort', onAbort)

    // Abort errors (timeout) are never retried
    if (errore.isAbortError(response)) return response

    if (response instanceof Error) {
      if (attempt < retries) {
        await sleep(retryBaseDelay * 2 ** attempt)
        continue
      }
      return response
    }

    if (!response.ok) {
      if (attempt < retries) {
        await sleep(retryBaseDelay * 2 ** attempt)
        continue
      }
      return new RequestFailedError({
        id: String(id),
        attempts: String(attempt + 1),
      })
    }

    const body = await response
      .json()
      .catch((e) => new InvalidJsonError({ id: String(id), cause: e }))

    if (body instanceof Error) {
      if (attempt < retries) {
        await sleep(retryBaseDelay * 2 ** attempt)
        continue
      }
      return body
    }

    return { todo: body }
  }

  return new RequestFailedError({
    id: String(id),
    attempts: String(retries + 1),
  })
}
```

**What changed:**

- `TimeoutError extends errore.AbortError` — a typed abort reason instead of `(error as Error).name === "AbortError"` string checks
- `controller.abort(new TimeoutError(...))` passes a typed reason — the browser's `AbortError` wraps it as the cause, so `errore.isAbortError()` can detect it inside the `RequestFailedError` cause chain
- Timeout is explicitly never retried (`if (errore.isAbortError(response)) return response`) — this policy is visible, not buried in a conditional
- Signal listener cleanup with `removeEventListener` and `{ once: true }`
- `TimeoutError` doesn't appear in the return type — it's inside `RequestFailedError`'s cause chain, not returned directly

---

## 4. With Retries + Timeout + OpenTelemetry Tracing

### Before

```ts
const tracer = Otel.trace.getTracer('todos')

function getTodo(
  id: number,
  {
    retries = 3,
    retryBaseDelay = 1000,
    signal,
  }: {
    retries?: number
    retryBaseDelay?: number
    signal?: AbortSignal
  },
): Promise<
  | { ok: true; todo: any }
  | {
      ok: false
      error: 'InvalidJson' | 'RequestFailed' | 'Timeout'
    }
> {
  return tracer.startActiveSpan(
    'getTodo',
    { attributes: { id } },
    async (span) => {
      try {
        const result = await execute(0)
        if (result.ok) {
          span.setStatus({ code: Otel.SpanStatusCode.OK })
        } else {
          span.setStatus({
            code: Otel.SpanStatusCode.ERROR,
            message: result.error,
          })
        }
        return result
      } finally {
        span.end()
      }
    },
  )

  async function execute(attempt: number): Promise<
    | { ok: true; todo: any }
    | {
        ok: false
        error: 'InvalidJson' | 'RequestFailed' | 'Timeout'
      }
  > {
    try {
      const controller = new AbortController()
      setTimeout(() => controller.abort(), 1000)
      signal?.addEventListener('abort', () => controller.abort())
      const response = await fetch(`/todos/${id}`, {
        signal: controller.signal,
      })
      if (!response.ok) throw new Error('Not OK!')
      try {
        const todo = await response.json()
        return { ok: true, todo }
      } catch (jsonError) {
        if (attempt < retries) {
          throw jsonError
        }
        return { ok: false, error: 'InvalidJson' }
      }
    } catch (error) {
      if ((error as Error).name === 'AbortError') {
        return { ok: false, error: 'Timeout' }
      } else if (attempt < retries) {
        const delayMs = retryBaseDelay * 2 ** attempt
        return new Promise((resolve) =>
          setTimeout(() => resolve(execute(attempt + 1)), delayMs),
        )
      }
      return { ok: false, error: 'RequestFailed' }
    }
  }
}
```

**Problems:**

- The tracing wrapper adds another layer of nesting around already-complex code
- `span.setStatus` checks `result.ok` / `result.error` — duplicating the error discrimination logic
- The `result.error` string is the only info passed to the span — no structured error data, no cause chain
- `execute` is hoisted and separated from the span — the relationship between tracing and business logic is disconnected
- try/finally for `span.end()` adds yet another nesting level

### After

```ts
import * as errore from 'errore'

const tracer = Otel.trace.getTracer('todos')
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

class InvalidJsonError extends errore.createTaggedError({
  name: 'InvalidJsonError',
  message: 'Failed to parse response for todo $id',
}) {}

class RequestFailedError extends errore.createTaggedError({
  name: 'RequestFailedError',
  message: 'Request failed for todo $id after $attempts attempts',
}) {}

class TimeoutError extends errore.createTaggedError({
  name: 'TimeoutError',
  message: 'Request timed out for todo $id',
  extends: errore.AbortError,
}) {}

async function getTodo(
  id: number,
  {
    retries = 3,
    retryBaseDelay = 1000,
    signal,
  }: {
    retries?: number
    retryBaseDelay?: number
    signal?: AbortSignal
  },
): Promise<InvalidJsonError | RequestFailedError | { todo: any }> {
  return tracer.startActiveSpan(
    'getTodo',
    { attributes: { id } },
    async (span) => {
      const result = await execute()
      if (result instanceof Error) {
        span.setStatus({
          code: Otel.SpanStatusCode.ERROR,
          message: result.message,
        })
        span.recordException(result)
      } else {
        span.setStatus({ code: Otel.SpanStatusCode.OK })
      }
      span.end()
      return result
    },
  )

  async function execute(): Promise<
    InvalidJsonError | RequestFailedError | { todo: any }
  > {
    for (let attempt = 0; attempt <= retries; attempt++) {
      const controller = new AbortController()
      const timeout = setTimeout(
        () => controller.abort(new TimeoutError({ id: String(id) })),
        1000,
      )
      const onAbort = () => controller.abort()
      signal?.addEventListener('abort', onAbort, { once: true })

      const response = await fetch(`/todos/${id}`, {
        signal: controller.signal,
      }).catch(
        (e) =>
          new RequestFailedError({
            id: String(id),
            attempts: String(attempt + 1),
            cause: e,
          }),
      )

      clearTimeout(timeout)
      signal?.removeEventListener('abort', onAbort)

      // Abort errors (timeout) are never retried
      if (errore.isAbortError(response)) return response

      if (response instanceof Error) {
        if (attempt < retries) {
          await sleep(retryBaseDelay * 2 ** attempt)
          continue
        }
        return response
      }

      if (!response.ok) {
        if (attempt < retries) {
          await sleep(retryBaseDelay * 2 ** attempt)
          continue
        }
        return new RequestFailedError({
          id: String(id),
          attempts: String(attempt + 1),
        })
      }

      const body = await response
        .json()
        .catch((e) => new InvalidJsonError({ id: String(id), cause: e }))

      if (body instanceof Error) {
        if (attempt < retries) {
          await sleep(retryBaseDelay * 2 ** attempt)
          continue
        }
        return body
      }

      return { todo: body }
    }

    return new RequestFailedError({
      id: String(id),
      attempts: String(retries + 1),
    })
  }
}
```

**What changed:**

- The tracing wrapper is one `instanceof Error` check — no `result.ok` / `result.error` string matching
- `span.recordException(result)` works directly because errors are real `Error` instances with stack traces and cause chains — OpenTelemetry gets structured data for free
- No try/finally needed — since errors are values, `span.end()` is just the next line
- The execute function is still flat: a `for` loop with early returns
- Error classes carry all context (id, attempts, cause) — the span gets meaningful data without extra work

---

## Summary

| Concern                  | `{ ok, error }` pattern                      | errore                                          |
| ------------------------ | -------------------------------------------- | ----------------------------------------------- |
| Error types              | String literals (`"InvalidJson"`)            | Real classes with typed properties              |
| Type safety at call site | Manual `result.ok` check                     | `instanceof Error` narrows the union            |
| Exhaustive handling      | Not enforced                                 | `matchError` is compile-time exhaustive         |
| Control flow             | Nested try/catch, throw for jumps            | Flat: check, return, continue                   |
| Retries                  | Recursive `execute()` + throw to outer catch | `for` loop + `continue`                         |
| Error context            | Just a string                                | Structured properties + cause chain             |
| Resource cleanup         | Nested try/finally per resource              | `await using` + `DisposableStack.defer()`       |
| Tracing integration      | `result.error` string to span                | `span.recordException(error)` with full stack   |
| Composability            | Each layer adds nesting                      | Each layer is another `if (x instanceof Error)` |

---

## 5. Resource Cleanup: Database + Cache

Managing multiple resources that need cleanup — regardless of success or failure.

### Before

```ts
async function processOrder(
  orderId: string,
): Promise<
  | { ok: true; receipt: Receipt }
  | { ok: false; error: 'DbError' | 'CacheError' | 'ProcessingError' }
> {
  const db = await connectDb()
  try {
    const cache = await openCache()
    try {
      const order = await db.query(`SELECT * FROM orders WHERE id = $1`, [
        orderId,
      ])
      if (!order) return { ok: false, error: 'DbError' }

      const receipt = await processPayment(order)
      await cache.set(`receipt:${orderId}`, receipt)
      return { ok: true, receipt }
    } catch (e) {
      return { ok: false, error: 'ProcessingError' }
    } finally {
      await cache.flush()
    }
  } catch (e) {
    return { ok: false, error: 'DbError' }
  } finally {
    await db.close()
  }
}
```

**Problems:**

- Nested try/finally for each resource — deeper nesting with every new resource
- Error handling and cleanup are tangled together in the same blocks
- If `cache.flush()` throws, it masks the original error
- Adding a third resource (e.g. a lock) means another nesting level

### After

```ts
import * as errore from 'errore'

class DbError extends errore.createTaggedError({
  name: 'DbError',
  message: 'Database operation failed for order $orderId',
}) {}

class CacheError extends errore.createTaggedError({
  name: 'CacheError',
  message: 'Cache operation failed for order $orderId',
}) {}

class ProcessingError extends errore.createTaggedError({
  name: 'ProcessingError',
  message: 'Payment processing failed for order $orderId',
}) {}

async function processOrder(
  orderId: string,
): Promise<DbError | CacheError | ProcessingError | Receipt> {
  await using cleanup = new errore.AsyncDisposableStack()

  const db = await connectDb().catch((e) => new DbError({ orderId, cause: e }))
  if (db instanceof Error) return db
  cleanup.defer(() => db.close())

  const cache = await openCache().catch(
    (e) => new CacheError({ orderId, cause: e }),
  )
  if (cache instanceof Error) return cache
  cleanup.defer(() => cache.flush())

  const order = await db
    .query(`SELECT * FROM orders WHERE id = $1`, [orderId])
    .catch((e) => new DbError({ orderId, cause: e }))
  if (order instanceof Error) return order

  const receipt = await processPayment(order).catch(
    (e) => new ProcessingError({ orderId, cause: e }),
  )
  if (receipt instanceof Error) return receipt

  await cache.set(`receipt:${orderId}`, receipt)
  return receipt
  // cleanup runs automatically: cache.flush() → db.close()
}
```

**What changed:**

- `await using cleanup = new errore.AsyncDisposableStack()` replaces all nested try/finally blocks
- `cleanup.defer()` registers cleanup in the order resources are acquired — they run in reverse (LIFO), so cache flushes before db closes
- Cleanup runs on every exit path: normal return, early error return, or thrown exception
- Adding more resources is just another `cleanup.defer()` — no extra nesting
- Each error type is distinct and typed in the return signature

### Effect.ts equivalent

```ts
import { Effect } from 'effect'

const processOrder = (orderId: string) =>
  Effect.acquireRelease(connectDbEffect, (db) =>
    Effect.promise(() => db.close()),
  ).pipe(
    Effect.flatMap((db) =>
      Effect.acquireRelease(openCacheEffect, (cache) =>
        Effect.promise(() => cache.flush()),
      ).pipe(
        Effect.flatMap((cache) =>
          Effect.gen(function* () {
            const order = yield* Effect.tryPromise({
              try: () =>
                db.query(`SELECT * FROM orders WHERE id = $1`, [orderId]),
              catch: () => new DbError({ orderId }),
            })
            const receipt = yield* Effect.tryPromise({
              try: () => processPayment(order),
              catch: () => new ProcessingError({ orderId }),
            })
            yield* Effect.promise(() =>
              cache.set(`receipt:${orderId}`, receipt),
            )
            return receipt
          }),
        ),
      ),
    ),
    Effect.scoped,
  )
```

**Comparison:** Effect's `acquireRelease` + `Effect.scoped` provides the same guarantee — resources are always cleaned up. But it requires wrapping everything in the Effect system: `Effect.flatMap`, `Effect.gen`, `yield*`, and `Effect.scoped`. errore uses native `await using` + `DisposableStack` — the same cleanup guarantee with plain async/await.

---

## 6. From Effect.ts: React Server Component

A React server component that fetches a video with policy checks, handles password-protected videos, private videos, and missing videos — each with distinct UI.

### Before (Effect.ts)

```tsx
return Effect.gen(function* () {
  const videosPolicy = yield* VideosPolicy

  const [video] = yield* Effect.promise(() => fetchVideo(videoId)).pipe(
    Policy.withPublicPolicy(videosPolicy.canView(videoId)),
  )

  return Option.fromNullable(video)
}).pipe(
  Effect.flatten,
  Effect.map((video) => ({ needsPassword: false, video }) as const),
  Effect.catchTag('VerifyVideoPasswordError', () =>
    Effect.succeed({ needsPassword: true } as const),
  ),
  Effect.map((data) => (
    <div className='min-h-screen flex flex-col bg-[#F7F8FA]'>
      <PasswordOverlay isOpen={data.needsPassword} videoId={videoId} />
      {!data.needsPassword && (
        <AuthorizedContent video={data.video} searchParams={searchParams} />
      )}
    </div>
  )),
  Effect.catchTags({
    PolicyDenied: () =>
      Effect.succeed(
        <div className='flex flex-col justify-center items-center p-4 min-h-screen text-center'>
          <Logo className='size-32' />
          <h1 className='mb-2 text-2xl font-semibold'>This video is private</h1>
          <p className='text-gray-400'>
            If you own this video, please <Link href='/login'>sign in</Link> to
            manage sharing.
          </p>
        </div>,
      ),
    NoSuchElementException: () => {
      console.log('[ShareVideoPage] No video found for videoId:', videoId)
      return Effect.succeed(<p>No video found</p>)
    },
  }),
)
```

**Problems:**

- `Effect.gen` + `yield*` to do what `async/await` already does
- `Option.fromNullable` + `Effect.flatten` to turn `null` into `NoSuchElementException` — a roundabout way to check `if (!video)`
- `Effect.catchTag("VerifyVideoPasswordError")` mid-pipe transforms one error into a different data shape, then `Effect.map` renders JSX — two separate pipe stages for one concept
- `Effect.catchTags` at the end catches errors from anywhere in the pipe — the error source is disconnected from the handler
- JSX is buried inside `Effect.succeed(...)` wrappers
- Reading order is bottom-up: you see the error handlers last, far from where errors originate

### After (errore)

```tsx
import * as errore from 'errore'

class PolicyDeniedError extends errore.createTaggedError({
  name: 'PolicyDeniedError',
  message: 'Access denied for video $videoId',
}) {}

class VerifyVideoPasswordError extends errore.createTaggedError({
  name: 'VerifyVideoPasswordError',
  message: 'Video $videoId requires password verification',
}) {}
```

```tsx
const videoResult = await fetchVideoWithPolicy(videoId)

// PolicyDenied → private video page
if (videoResult instanceof PolicyDeniedError) {
  return (
    <div className='flex flex-col justify-center items-center p-4 min-h-screen text-center'>
      <Logo className='size-32' />
      <h1 className='mb-2 text-2xl font-semibold'>This video is private</h1>
      <p className='text-gray-400'>
        If you own this video, please <Link href='/login'>sign in</Link> to
        manage sharing.
      </p>
    </div>
  )
}

// Password required → show overlay only
if (videoResult instanceof VerifyVideoPasswordError) {
  return (
    <div className='min-h-screen flex flex-col bg-[#F7F8FA]'>
      <PasswordOverlay isOpen={true} videoId={videoId} />
    </div>
  )
}

// Unexpected errors bubble up
if (videoResult instanceof Error) return videoResult

const [video] = videoResult

// No video found
if (!video) {
  console.log('[ShareVideoPage] No video found for videoId:', videoId)
  return <p>No video found</p>
}

// Success
return (
  <div className='min-h-screen flex flex-col bg-[#F7F8FA]'>
    <PasswordOverlay isOpen={false} videoId={videoId} />
    <AuthorizedContent video={video} searchParams={searchParams} />
  </div>
)
```

**What changed:**

- No generators, no `yield*`, no `Option.fromNullable`, no `Effect.flatten` — just `await` and `if`
- Each error is handled right where you'd expect: `instanceof` check → early return with JSX
- Null check is `if (!video)` instead of `Option.fromNullable` + `Effect.flatten` + `NoSuchElementException`
- JSX is returned directly, not wrapped in `Effect.succeed(...)`
- Reading order is top-down: errors are handled first, happy path falls through to the bottom
- The password-protected case is a separate `return`, not a mid-pipe data shape transformation (`{ needsPassword: true }` → re-read later in `Effect.map`)
- No pipe chain to mentally unwind — each branch is self-contained
