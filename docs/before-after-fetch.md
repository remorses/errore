# Before & After: Fetching a Todo

Four progressive examples showing how errore eliminates nested try/catch while keeping full type safety. Each step adds real-world complexity: retries, timeouts, and tracing.

---

## 1. Basic Fetch

### Before

```ts
async function getTodo(
  id: number
): Promise<
  | { ok: true; todo: any }
  | { ok: false; error: "InvalidJson" | "RequestFailed" }
> {
  try {
    const response = await fetch(`/todos/${id}`)
    if (!response.ok) throw new Error("Not OK!")
    try {
      const todo = await response.json()
      return { ok: true, todo }
    } catch (jsonError) {
      return { ok: false, error: "InvalidJson" }
    }
  } catch (error) {
    return { ok: false, error: "RequestFailed" }
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
import * as errore from "errore"

class InvalidJsonError extends errore.createTaggedError({
  name: "InvalidJsonError",
  message: "Failed to parse response for todo $id",
}) {}

class RequestFailedError extends errore.createTaggedError({
  name: "RequestFailedError",
  message: "Request failed for todo $id",
}) {}

async function getTodo(
  id: number
): Promise<InvalidJsonError | RequestFailedError | { todo: any }> {
  const response = await errore.tryAsync({
    try: () => fetch(`/todos/${id}`),
    catch: (e) => new RequestFailedError({ id: String(id), cause: e }),
  })
  if (response instanceof Error) return response

  if (!response.ok) {
    return new RequestFailedError({ id: String(id) })
  }

  const body = await errore.tryAsync({
    try: () => response.json(),
    catch: (e) => new InvalidJsonError({ id: String(id), cause: e }),
  })
  if (body instanceof Error) return body

  return { todo: body }
}
```

**What changed:**
- No try/catch at all — `errore.tryAsync` converts exceptions to values
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
  }: { retries?: number; retryBaseDelay?: number }
): Promise<
  | { ok: true; todo: any }
  | { ok: false; error: "InvalidJson" | "RequestFailed" }
> {
  async function execute(
    attempt: number
  ): Promise<
    | { ok: true; todo: any }
    | { ok: false; error: "InvalidJson" | "RequestFailed" }
  > {
    try {
      const response = await fetch(`/todos/${id}`)
      if (!response.ok) throw new Error("Not OK!")
      try {
        const todo = await response.json()
        return { ok: true, todo }
      } catch (jsonError) {
        if (attempt < retries) {
          throw jsonError // jump to retry
        }
        return { ok: false, error: "InvalidJson" }
      }
    } catch (error) {
      if (attempt < retries) {
        const delayMs = retryBaseDelay * 2 ** attempt
        return new Promise((resolve) =>
          setTimeout(() => resolve(execute(attempt + 1)), delayMs)
        )
      }
      return { ok: false, error: "RequestFailed" }
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
import * as errore from "errore"

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

class InvalidJsonError extends errore.createTaggedError({
  name: "InvalidJsonError",
  message: "Failed to parse response for todo $id",
}) {}

class RequestFailedError extends errore.createTaggedError({
  name: "RequestFailedError",
  message: "Request failed for todo $id after $attempts attempts",
}) {}

async function getTodo(
  id: number,
  {
    retries = 3,
    retryBaseDelay = 1000,
  }: { retries?: number; retryBaseDelay?: number }
): Promise<InvalidJsonError | RequestFailedError | { todo: any }> {
  for (let attempt = 0; attempt <= retries; attempt++) {
    const response = await errore.tryAsync({
      try: () => fetch(`/todos/${id}`),
      catch: (e) =>
        new RequestFailedError({
          id: String(id),
          attempts: String(attempt + 1),
          cause: e,
        }),
    })

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

    const body = await errore.tryAsync({
      try: () => response.json(),
      catch: (e) =>
        new InvalidJsonError({ id: String(id), cause: e }),
    })

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
  }
): Promise<
  | { ok: true; todo: any }
  | {
      ok: false
      error: "InvalidJson" | "RequestFailed" | "Timeout"
    }
> {
  async function execute(attempt: number): Promise<
    | { ok: true; todo: any }
    | {
        ok: false
        error: "InvalidJson" | "RequestFailed" | "Timeout"
      }
  > {
    try {
      const controller = new AbortController()
      setTimeout(() => controller.abort(), 1000)
      signal?.addEventListener("abort", () => controller.abort())
      const response = await fetch(`/todos/${id}`, {
        signal: controller.signal,
      })
      if (!response.ok) throw new Error("Not OK!")
      try {
        const todo = await response.json()
        return { ok: true, todo }
      } catch (jsonError) {
        if (attempt < retries) {
          throw jsonError // jump to retry
        }
        return { ok: false, error: "InvalidJson" }
      }
    } catch (error) {
      if ((error as Error).name === "AbortError") {
        return { ok: false, error: "Timeout" }
      } else if (attempt < retries) {
        const delayMs = retryBaseDelay * 2 ** attempt
        return new Promise((resolve) =>
          setTimeout(() => resolve(execute(attempt + 1)), delayMs)
        )
      }
      return { ok: false, error: "RequestFailed" }
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
import * as errore from "errore"

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

class InvalidJsonError extends errore.createTaggedError({
  name: "InvalidJsonError",
  message: "Failed to parse response for todo $id",
}) {}

class RequestFailedError extends errore.createTaggedError({
  name: "RequestFailedError",
  message: "Request failed for todo $id after $attempts attempts",
}) {}

class TimeoutError extends errore.createTaggedError({
  name: "TimeoutError",
  message: "Request timed out for todo $id",
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
  }
): Promise<
  InvalidJsonError | RequestFailedError | TimeoutError | { todo: any }
> {
  for (let attempt = 0; attempt <= retries; attempt++) {
    // Abort handling: combine caller signal with per-request timeout
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 1000)
    const onAbort = () => controller.abort()
    signal?.addEventListener("abort", onAbort, { once: true })

    const response = await errore.tryAsync({
      try: () => fetch(`/todos/${id}`, { signal: controller.signal }),
      catch: (e) => {
        if (e.name === "AbortError") {
          return new TimeoutError({ id: String(id), cause: e })
        }
        return new RequestFailedError({
          id: String(id),
          attempts: String(attempt + 1),
          cause: e,
        })
      },
    })

    clearTimeout(timeout)
    signal?.removeEventListener("abort", onAbort)

    // Timeout is never retried
    if (response instanceof TimeoutError) return response

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

    const body = await errore.tryAsync({
      try: () => response.json(),
      catch: (e) =>
        new InvalidJsonError({ id: String(id), cause: e }),
    })

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
- `TimeoutError` is its own class — no more `(error as Error).name === "AbortError"` string checks
- Timeout detection happens in the `catch` mapper, close to where it originates
- Timeout is explicitly never retried (`if (response instanceof TimeoutError) return response`) — this policy is visible, not buried in a conditional
- Signal listener cleanup with `removeEventListener` and `{ once: true }`
- The return type `InvalidJsonError | RequestFailedError | TimeoutError | { todo: any }` tells the full story

---

## 4. With Retries + Timeout + OpenTelemetry Tracing

### Before

```ts
const tracer = Otel.trace.getTracer("todos")

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
  }
): Promise<
  | { ok: true; todo: any }
  | {
      ok: false
      error: "InvalidJson" | "RequestFailed" | "Timeout"
    }
> {
  return tracer.startActiveSpan(
    "getTodo",
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
    }
  )

  async function execute(attempt: number): Promise<
    | { ok: true; todo: any }
    | {
        ok: false
        error: "InvalidJson" | "RequestFailed" | "Timeout"
      }
  > {
    try {
      const controller = new AbortController()
      setTimeout(() => controller.abort(), 1000)
      signal?.addEventListener("abort", () => controller.abort())
      const response = await fetch(`/todos/${id}`, {
        signal: controller.signal,
      })
      if (!response.ok) throw new Error("Not OK!")
      try {
        const todo = await response.json()
        return { ok: true, todo }
      } catch (jsonError) {
        if (attempt < retries) {
          throw jsonError
        }
        return { ok: false, error: "InvalidJson" }
      }
    } catch (error) {
      if ((error as Error).name === "AbortError") {
        return { ok: false, error: "Timeout" }
      } else if (attempt < retries) {
        const delayMs = retryBaseDelay * 2 ** attempt
        return new Promise((resolve) =>
          setTimeout(() => resolve(execute(attempt + 1)), delayMs)
        )
      }
      return { ok: false, error: "RequestFailed" }
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
import * as errore from "errore"

const tracer = Otel.trace.getTracer("todos")
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

class InvalidJsonError extends errore.createTaggedError({
  name: "InvalidJsonError",
  message: "Failed to parse response for todo $id",
}) {}

class RequestFailedError extends errore.createTaggedError({
  name: "RequestFailedError",
  message: "Request failed for todo $id after $attempts attempts",
}) {}

class TimeoutError extends errore.createTaggedError({
  name: "TimeoutError",
  message: "Request timed out for todo $id",
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
  }
): Promise<
  InvalidJsonError | RequestFailedError | TimeoutError | { todo: any }
> {
  return tracer.startActiveSpan(
    "getTodo",
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
    }
  )

  async function execute(): Promise<
    InvalidJsonError | RequestFailedError | TimeoutError | { todo: any }
  > {
    for (let attempt = 0; attempt <= retries; attempt++) {
      const controller = new AbortController()
      const timeout = setTimeout(() => controller.abort(), 1000)
      const onAbort = () => controller.abort()
      signal?.addEventListener("abort", onAbort, { once: true })

      const response = await errore.tryAsync({
        try: () =>
          fetch(`/todos/${id}`, { signal: controller.signal }),
        catch: (e) => {
          if (e.name === "AbortError") {
            return new TimeoutError({ id: String(id), cause: e })
          }
          return new RequestFailedError({
            id: String(id),
            attempts: String(attempt + 1),
            cause: e,
          })
        },
      })

      clearTimeout(timeout)
      signal?.removeEventListener("abort", onAbort)

      if (response instanceof TimeoutError) return response

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

      const body = await errore.tryAsync({
        try: () => response.json(),
        catch: (e) =>
          new InvalidJsonError({ id: String(id), cause: e }),
      })

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

| Concern | `{ ok, error }` pattern | errore |
|---|---|---|
| Error types | String literals (`"InvalidJson"`) | Real classes with typed properties |
| Type safety at call site | Manual `result.ok` check | `instanceof Error` narrows the union |
| Exhaustive handling | Not enforced | `matchError` is compile-time exhaustive |
| Control flow | Nested try/catch, throw for jumps | Flat: check, return, continue |
| Retries | Recursive `execute()` + throw to outer catch | `for` loop + `continue` |
| Error context | Just a string | Structured properties + cause chain |
| Tracing integration | `result.error` string to span | `span.recordException(error)` with full stack |
| Composability | Each layer adds nesting | Each layer is another `if (x instanceof Error)` |
