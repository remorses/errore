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

After using type guards, narrowing completely breaks down:

```ts
const result = parseJSON('{"a": 1}')

if (isOk(result)) {
  // You expect: result is the parsed value (not Error)
  // Reality: result is still `unknown`
  
  // This is a type error - can't access properties on unknown!
  console.log(result.a)  // Error: 'result' is of type 'unknown'
}

if (isError(result)) {
  // You expect: result is Error
  // Reality: result is still `unknown`
  
  // This is a type error too!
  console.log(result.message)  // Error: 'result' is of type 'unknown'
}
```

The type guards use `Extract<V, Error>` and `Exclude<V, Error>`:
- `Extract<unknown, Error>` = `unknown` (not `Error`!)
- `Exclude<unknown, Error>` = `unknown` (not `never`!)

**You get zero type safety.** The code compiles but TypeScript can't help you at all.

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

if (isOk(result)) {
  // Now TypeScript correctly narrows to ParsedJSON
  console.log(result.a)  // Works!
}
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
if (isOk(result)) {
  console.log(result.a)  // Works! result is { a: number }
}
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
