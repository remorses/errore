import { UnhandledError } from './error.js'

/**
 * Type guard: checks if value is an Error.
 * After this check, TypeScript narrows the type to the error types in the union.
 *
 * @example
 * const result = await fetchUser(id)
 * if (isError(result)) {
 *   // result is narrowed to the error type
 *   return result
 * }
 * // result is narrowed to User
 * console.log(result.name)
 */
export function isError<V>(value: V): value is Extract<V, Error> {
  return value instanceof Error
}

/**
 * Type guard: checks if value is NOT an Error.
 * Inverse of isError for convenience.
 *
 * @example
 * const result = await fetchUser(id)
 * if (isOk(result)) {
 *   console.log(result.name) // result is User
 * }
 */
export function isOk<V>(value: V): value is Exclude<V, Error> {
  return !(value instanceof Error)
}

/**
 * Execute a sync function and return either the value or an error.
 *
 * @overload Simple form - wraps exceptions in UnhandledError
 * @example
 * const result = tryFn(() => JSON.parse(input))
 * // result: UnhandledError | unknown
 *
 * @overload With custom catch - you control the error type
 * @example
 * const result = tryFn({
 *   try: () => JSON.parse(input),
 *   catch: (e) => new ParseError({ cause: e })
 * })
 * // result: ParseError | unknown
 */
export function tryFn<T>(fn: () => T): UnhandledError | T
export function tryFn<T, E extends Error>(opts: {
  try: () => T
  catch: (e: Error) => E
}): E | T
export function tryFn<T, E extends Error>(
  fnOrOpts: (() => T) | { try: () => T; catch: (e: Error) => E },
): UnhandledError | E | T {
  if (typeof fnOrOpts === 'function') {
    try {
      return fnOrOpts()
    } catch (cause) {
      if (!(cause instanceof Error)) {
        throw cause
      }
      return new UnhandledError({ cause })
    }
  }

  try {
    return fnOrOpts.try()
  } catch (cause) {
    if (!(cause instanceof Error)) {
      throw cause
    }
    return fnOrOpts.catch(cause)
  }
}

/**
 * Execute an async function and return either the value or an error.
 *
 * @deprecated Use `.catch()` directly on the promise instead. It's simpler,
 * composes naturally with async/await, and TypeScript infers the union
 * automatically. `tryAsync` adds an unnecessary wrapper around what `.catch()`
 * already does.
 *
 * @example Migration from tryAsync to .catch()
 * ```ts
 * // Before (tryAsync):
 * const result = await tryAsync({
 *   try: () => fetch(url),
 *   catch: (e) => new NetworkError({ url, cause: e }),
 * })
 *
 * // After (.catch):
 * const result = await fetch(url)
 *   .catch((e) => new NetworkError({ url, cause: e }))
 * ```
 *
 * @example Simple form migration
 * ```ts
 * // Before:
 * const result = await tryAsync(() => fetch(url).then(r => r.json()))
 *
 * // After:
 * const result = await fetch(url).then(r => r.json())
 *   .catch((e) => new NetworkError({ url, cause: e }))
 * ```
 */
export function tryAsync<T>(fn: () => Promise<T>): Promise<UnhandledError | T>
export function tryAsync<T, E extends Error>(opts: {
  try: () => Promise<T>
  catch: (e: Error) => E | Promise<E>
}): Promise<E | T>
export async function tryAsync<T, E extends Error>(
  fnOrOpts:
    | (() => Promise<T>)
    | { try: () => Promise<T>; catch: (e: Error) => E | Promise<E> },
): Promise<UnhandledError | E | T> {
  if (typeof fnOrOpts === 'function') {
    try {
      return await fnOrOpts()
    } catch (cause) {
      if (!(cause instanceof Error)) {
        throw cause
      }
      return new UnhandledError({ cause })
    }
  }

  try {
    return await fnOrOpts.try()
  } catch (cause) {
    if (!(cause instanceof Error)) {
      throw cause
    }
    return await fnOrOpts.catch(cause)
  }
}
