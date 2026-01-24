# errore

Type-safe errors as values for TypeScript. Like Go, but with full type inference.

## Why?

Instead of wrapping values in a `Result<T, E>` type, functions simply return `E | T`. TypeScript's type narrowing handles the rest:

```ts
// Go-style: errors as values
const user = await fetchUser(id)
if (user instanceof Error) return user  // TypeScript narrows type
console.log(user.name)                  // user is now User, not Error | User
```

## Install

```sh
npm install errore
```

## Quick Start

```ts
import * as errore from 'errore'

// Define typed errors with $variable interpolation
class NotFoundError extends errore.createTaggedError({
  name: 'NotFoundError',
  message: 'User $id not found'
}) {}

class DbError extends errore.createTaggedError({
  name: 'DbError',
  message: 'Database query failed: $reason'
}) {}

// Function returns Error | Value (no wrapper!)
async function getUser(id: string): Promise<NotFoundError | DbError | User> {
  const result = await errore.tryAsync({
    try: () => db.query(id),
    catch: e => new DbError({ reason: e.message, cause: e })
  })
  
  if (result instanceof Error) return result
  if (!result) return new NotFoundError({ id })
  
  return result
}

// Caller handles errors explicitly
const user = await getUser('123')

if (user instanceof Error) {
  const message = errore.matchError(user, {
    NotFoundError: e => `User ${e.id} not found`,
    DbError: e => `Database error: ${e.reason}`,
    Error: e => `Unexpected error: ${e.message}`
  })
  console.log(message)
  return
}

// TypeScript knows: user is User
console.log(user.name)
```

## Example: API Error Handling

A complete example with custom base class, HTTP status codes, and error reporting:

```ts
import * as errore from 'errore'

// Base class with shared functionality
class AppError extends Error {
  statusCode: number = 500
  
  toResponse() {
    return { error: this.message, code: this.statusCode }
  }
}

// Specific errors with status codes and $variable interpolation
class NotFoundError extends errore.createTaggedError({
  name: 'NotFoundError',
  message: '$resource not found',
  extends: AppError
}) {}

class ValidationError extends errore.createTaggedError({
  name: 'ValidationError',
  message: 'Invalid $field: $reason',
  extends: AppError
}) {}

class UnauthorizedError extends errore.createTaggedError({
  name: 'UnauthorizedError',
  message: '$message',
  extends: AppError
}) {}

// Service function
async function updateUser(
  userId: string,
  data: { email?: string }
): Promise<NotFoundError | ValidationError | UnauthorizedError | User> {
  const session = await getSession()
  if (!session) {
    return new UnauthorizedError({ message: 'Not logged in' })
  }
  
  const user = await db.users.find(userId)
  if (!user) {
    return new NotFoundError({ resource: `User ${userId}` })
  }
  
  if (data.email && !isValidEmail(data.email)) {
    return new ValidationError({ field: 'email', reason: 'Invalid email format' })
  }
  
  return db.users.update(userId, data)
}

// API handler
app.post('/users/:id', async (req, res) => {
  const result = await updateUser(req.params.id, req.body)
  
  if (result instanceof Error) {
    // All errors have toResponse() from AppError base
    return res.status(result.statusCode).json(result.toResponse())
  }
  
  return res.json(result)
})
```

## API

### createTaggedError

Create typed errors with `$variable` interpolation in the message:

```ts
import * as errore from 'errore'

// Variables are extracted from the message and required in constructor
class NotFoundError extends errore.createTaggedError({
  name: 'NotFoundError',
  message: 'User $id not found in $database'
}) {}

const err = new NotFoundError({ id: '123', database: 'users' })
err.message   // 'User 123 not found in users'
err.id        // '123'
err.database  // 'users'
err._tag      // 'NotFoundError'

// Error without variables
class EmptyError extends errore.createTaggedError({
  name: 'EmptyError',
  message: 'Something went wrong'
}) {}
new EmptyError()  // no args required

// With cause for error chaining
class WrapperError extends errore.createTaggedError({
  name: 'WrapperError',
  message: 'Failed to process $item'
}) {}
new WrapperError({ item: 'data', cause: originalError })

// With custom base class
class AppError extends Error {
  statusCode = 500
}

class HttpError extends errore.createTaggedError({
  name: 'HttpError',
  message: 'HTTP $status error',
  extends: AppError
}) {}

const err = new HttpError({ status: 404 })
err.statusCode  // 500 (inherited from AppError)
err instanceof AppError  // true
```

### Type Guards

```ts
const result: NetworkError | User = await fetchUser(id)

if (result instanceof Error) {
  // result is NetworkError
  return result
}
// result is User
```

### Try Functions

```ts
import * as errore from 'errore'

// Sync - wraps exceptions in UnhandledError
const parsed = errore.tryFn(() => JSON.parse(input))

// Sync - with custom error type
const parsed = errore.tryFn({
  try: () => JSON.parse(input),
  catch: e => new ParseError({ reason: e.message, cause: e })
})

// Async
const response = await errore.tryAsync(() => fetch(url))

// Async - with custom error
const response = await errore.tryAsync({
  try: () => fetch(url),
  catch: e => new NetworkError({ url, cause: e })
})
```

### Transformations

```ts
import * as errore from 'errore'

// Transform value (if not error)
const name = errore.map(user, u => u.name)

// Transform error
const appError = errore.mapError(dbError, e => new AppError({ cause: e }))

// Chain operations
const posts = errore.andThen(user, u => fetchPosts(u.id))

// Side effects
const logged = errore.tap(user, u => console.log('Got user:', u.name))
```

### Extraction

```ts
import * as errore from 'errore'

// Extract or throw
const user = errore.unwrap(result)
const user = errore.unwrap(result, 'Custom error message')

// Extract or fallback
const name = errore.unwrapOr(result, 'Anonymous')

// Pattern match
const message = errore.match(result, {
  ok: user => `Hello, ${user.name}`,
  err: error => `Failed: ${error.message}`
})

// Split array into [successes, errors]
const [users, errors] = errore.partition(results)
```

### Error Matching

Always assign `matchError` results to a variable. Keep callbacks pure (return values only) and move side effects outside:

```ts
import * as errore from 'errore'

class ValidationError extends errore.createTaggedError({
  name: 'ValidationError',
  message: 'Invalid $field'
}) {}

class NetworkError extends errore.createTaggedError({
  name: 'NetworkError',
  message: 'Failed to fetch $url'
}) {}

// Exhaustive matching - Error handler is always required
const message = errore.matchError(error, {
  ValidationError: e => `Invalid ${e.field}`,
  NetworkError: e => `Failed to fetch ${e.url}`,
  Error: e => `Unexpected: ${e.message}`  // required fallback for plain Error
})
console.log(message)  // side effects outside callbacks

// Partial matching with fallback
const fallbackMsg = errore.matchErrorPartial(error, {
  ValidationError: e => `Invalid ${e.field}`
}, e => `Unknown error: ${e.message}`)

// Type guards
ValidationError.is(value)  // specific class
```

## How Type Safety Works

TypeScript narrows types after `instanceof Error` checks:

```ts
function example(result: NetworkError | User): string {
  if (result instanceof Error) {
    // TypeScript knows: result is NetworkError
    return result.message
  }
  // TypeScript knows: result is User (Error excluded)
  return result.name
}
```

This works because:
1. `Error` is a built-in class TypeScript understands
2. Custom error classes extend `Error`
3. After an `instanceof Error` check, TS excludes all Error subtypes

## Result + Option Combined: `Error | T | null`

One of errore's best features: you can naturally combine error handling with optional values. No wrapper nesting needed!

```ts
import * as errore from 'errore'

class NotFoundError extends errore.createTaggedError({
  name: 'NotFoundError',
  message: 'Resource $id not found'
}) {}

// Result + Option in one natural type
function findUser(id: string): NotFoundError | User | null {
  if (id === 'bad') return new NotFoundError({ id })
  if (id === 'missing') return null
  return { id, name: 'Alice' }
}

const user = findUser('123')

// Handle error first
if (user instanceof Error) {
  return user.message  // TypeScript: user is NotFoundError
}

// Handle null/missing case - use ?. and ?? naturally!
const name = user?.name ?? 'Anonymous'

// Or check explicitly
if (user === null) {
  return 'User not found'
}

// TypeScript knows: user is User
console.log(user.name)
```

### Why this is better than Rust/Zig

| Language | Result + Option | Order matters? |
|----------|-----------------|----------------|
| Rust | `Result<Option<T>, E>` or `Option<Result<T, E>>` | Yes, must unwrap in order |
| Zig | `!?T` (error union + optional) | Yes, specific syntax |
| **errore** | `Error \| T \| null` | **No!** Check in any order |

With errore:
- Use `?.` and `??` naturally
- Check `instanceof Error` or `=== null` in any order
- No unwrapping ceremony
- TypeScript infers everything

## Why This Is Better Than Go

Go's error handling uses two separate return values:

```go
user, err := fetchUser(id)
// Oops! Forgot to check err
fmt.Println(user.Name)  // Compiles fine, crashes at runtime
```

The compiler can't save you here. You can ignore `err` entirely and use `user` directly.

With errore, **forgetting to check is impossible**:

```ts
const user = await fetchUser(id)  // type: NotFoundError | User

console.log(user.name)  // TS Error: Property 'name' does not exist on type 'NotFoundError'
```

Since errore uses a **single union variable** instead of two separate values, TypeScript forces you to narrow the type before accessing any properties. You literally cannot use the value without first doing an `instanceof Error` check.

### The Remaining Gap

There's still one case errore can't catch: when you call a function but ignore the result entirely:

```ts
// Oops! Completely ignoring the return value
updateUser(id, data)  // No error, but we should check!
```

For this, use **TypeScript's built-in checks** or a linter:

**TypeScript `tsconfig.json`:**
```json
{
  "compilerOptions": {
    "noUnusedLocals": true
  }
}
```

This catches unused variables, though not ignored return values directly.

**oxlint `no-unused-expressions`:**

`oxlint.json`:
```json
{
  "rules": {
    "no-unused-expressions": "error"
  }
}
```

Or via CLI:
```bash
oxlint --deny no-unused-expressions
```

Combined with errore's type safety, these tools give you near-complete protection against ignored errors.

## Comparison with Result Types

| Result Pattern | errore |
|---------------|--------|
| `Result.ok(value)` | just `return value` |
| `Result.err(error)` | just `return error` |
| `result.value` | direct access after guard |
| `result.map(fn)` | `map(result, fn)` |
| `Result<User, Error>` | `Error \| User` |
| `Result<Option<T>, E>` | `Error \| T \| null` |

## Import Style

> **Note:** Always use `import * as errore from 'errore'` instead of named imports. This makes code easier to move between files, and more readable for people unfamiliar with errore since every function call is clearly namespaced (e.g. `errore.isOk()` instead of just `isOk()`).

## License

MIT
