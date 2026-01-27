# errore: Pitfalls to Avoid

## Never use `unknown | Error` return types

The `A | Error` union representation is **lossy** when `A = unknown`.

### The Problem

When you have a function that returns `Error | unknown`:

```ts
// BAD: unknown absorbs Error in the union
function parseJSON(input: string): Error | unknown {
  try {
    return JSON.parse(input)  // returns unknown
  } catch (e) {
    return e instanceof Error ? e : new Error(String(e))
  }
}
```

The type `Error | unknown` **collapses to just `unknown`** because `unknown` is the top type that already includes `Error`. TypeScript simplifies the union automatically.

### The Big Surprise

TypeScript simplifies `Error | unknown` to just `unknown`. The `instanceof Error` check works inside the block, but **after the early return you still have `unknown`**:

```ts
const result = parseJSON('{"a": 1}')

// Go-style early return
if (result instanceof Error) {
  // GOOD: instanceof Error narrows to Error inside the block
  console.log(result.message)  // Works!
  return
}

// THE SURPRISE: After early return, result is still `unknown`!
// TypeScript can't narrow `unknown` to "unknown minus Error"

// This is a type error - can't access properties on unknown!
console.log(result.a)  // Error: 'result' is of type 'unknown'
```

**You lose type safety on the success path.** Error handling works, but you can't use the value without casting.

### The Fix

Always use **explicit types** instead of `unknown`:

```ts
// GOOD: Use a specific type
interface ParsedJSON {
  [key: string]: unknown
}

function parseJSON(input: string): Error | ParsedJSON {
  try {
    return JSON.parse(input) as ParsedJSON
  } catch (e) {
    return e instanceof Error ? e : new Error(String(e))
  }
}

const result = parseJSON('{"a": 1}')

// Go-style early return
if (result instanceof Error) {
  console.log(result.message)  // Works! result is Error
  return
}

// Now TypeScript correctly narrows to ParsedJSON
console.log(result.a)  // Works!
```

Or use generic types to preserve the caller's type:

```ts
// GOOD: Generic preserves caller's type
function parseJSON<T>(input: string): Error | T {
  try {
    return JSON.parse(input) as T
  } catch (e) {
    return e instanceof Error ? e : new Error(String(e))
  }
}

const result = parseJSON<{ a: number }>('{"a": 1}')

// Go-style early return
if (result instanceof Error) return

console.log(result.a)  // Works! result is { a: number }
```

## Never use `CustomError | Error` when CustomError extends Error

If your success type is a subtype of `Error`, the union becomes ambiguous:

```ts
// BAD: MyCustomError extends Error, so the union is confusing
class MyCustomError extends Error {
  code: string
  constructor(code: string) {
    super(`Error: ${code}`)
    this.code = code
  }
}

// What does this even mean?
function weird(): MyCustomError | Error {
  // Both branches return something that `instanceof Error` is true for
}
```

After `instanceof Error`, TypeScript can't distinguish between "this is the error case" vs "this is the success case" because both are Errors.

### Why would anyone do this?

Usually by accident:
- Wrapping another library's error type as a "result"
- Misunderstanding the pattern

### The Fix

Success values should **never extend Error**. If you need to return error-like data as a success, use a plain object:

```ts
// GOOD: Success type is a plain object, not an Error
interface ErrorReport {
  code: string
  message: string
  resolved: boolean
}

function getErrorReport(id: string): NotFoundError | ErrorReport {
  // Now instanceof Error clearly means "failure"
  // and !instanceof Error clearly means "success with ErrorReport"
}
```

## Summary

| Pattern | Problem | Fix |
|---------|---------|-----|
| `unknown \| Error` | Union collapses to `unknown`, no narrowing | Use explicit types like `T \| Error` |
| `CustomError \| Error` where CustomError extends Error | Can't distinguish success from failure | Success types should never extend Error |

## Error Wrapping with `cause`

Use `cause` to wrap errors with additional context while preserving the original:

```ts
async function processUser(id: string): Promise<ServiceError | ProcessedUser> {
  const user = await getUser(id)  // returns NotFoundError | User
  
  if (user instanceof Error) {
    // Wrap in ServiceError, preserve original in cause
    return new ServiceError({ id, cause: user })
  }
  
  return process(user)
}

// Access original via cause
const result = await processUser('123')
if (result instanceof Error) {
  if (result.cause instanceof NotFoundError) {
    console.log(result.cause.id)  // original error's properties
  }
}
```

This is equivalent to Go's `fmt.Errorf("context: %w", err)` pattern.

## findCause: Walking the Cause Chain

Checking `result.cause instanceof MyError` only inspects one level deep. For deep chains (A -> B -> C), use `findCause` to walk the entire `.cause` chain. This is equivalent to Go's `errors.As`:

```ts
import * as errore from 'errore'

class DbError extends errore.createTaggedError({
  name: 'DbError',
  message: 'Connection to $host failed'
}) {}

class ServiceError extends errore.createTaggedError({
  name: 'ServiceError',
  message: 'Service $name failed'
}) {}

const db = new DbError({ host: 'db.example.com' })
const svc = new ServiceError({ name: 'user-service', cause: db })

// Instance method — available on all tagged errors
const found = svc.findCause(DbError)
found?.host  // 'db.example.com' — type-safe access

// Standalone function — works on any Error
const found2 = errore.findCause(svc, DbError)
found2?.host  // 'db.example.com'
```

- Checks the error itself first, then walks `.cause` recursively
- Returns the matched error with full type inference, or `undefined` if not found
- Safe against circular `.cause` references

## Custom Base Class with `extends`

Use `extends` to inherit from a custom base class with shared functionality:

```ts
class AppError extends Error {
  statusCode = 500
  toResponse() { return { error: this.message, code: this.statusCode } }
}

class NotFoundError extends errore.createTaggedError({
  name: 'NotFoundError',
  message: 'Resource $id not found',
  extends: AppError
}) {
  statusCode = 404
}

const err = new NotFoundError({ id: '123' })
err instanceof NotFoundError  // true
err instanceof AppError       // true
err instanceof Error          // true
```

This is useful for shared error handling logic (e.g., HTTP status codes, logging methods).
