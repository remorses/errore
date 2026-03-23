# lintcn: `no-unhandled-error`

[lintcn](https://github.com/remorses/lintcn) is the [shadcn](https://ui.shadcn.com) for type-aware TypeScript lint rules. Rules are Go files that use the TypeScript type checker — they see resolved types, not just syntax.

The `no-unhandled-error` rule catches discarded `Error | T` return values at lint time. Because it uses the type checker, it only flags calls returning Error-typed unions — zero false positives on `void`-returning functions like `console.log`.

## Install

```bash
npm install -D lintcn
npx lintcn add https://github.com/remorses/lintcn/tree/main/.lintcn/no_unhandled_error
npx lintcn lint
```

## What gets flagged

```ts
declare function getUser(id: string): Error | User

getUser("123")          // error: Error-typed return value is not handled
await fetchData("/api") // error: Promise<Error | Data> resolved but not checked
db.query("SELECT 1")   // error: Error | { rows: any[] } discarded
```

## What is NOT flagged

```ts
// Assigned to variable — you'll check it
const user = getUser("123")
if (user instanceof Error) return user

// Explicitly discarded with void
void getUser("123")

// void/undefined/never returns — nothing to handle
console.log("hello")
arr.push(1)

// Return statement — caller handles it
function wrapper() { return getUser("123") }
```

This closes the last gap where TypeScript can't enforce error handling — discarded return values. Every error must be either handled or explicitly discarded with `void`.
