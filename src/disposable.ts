/**
 * Polyfills for DisposableStack and AsyncDisposableStack.
 * These provide Go-like `defer` cleanup semantics using the TC39 Explicit
 * Resource Management proposal (TypeScript 5.2+ `using` / `await using`).
 *
 * Works in every runtime — no native DisposableStack support required.
 * Only needs Symbol.dispose / Symbol.asyncDispose to exist (polyfilled here).
 */

// Polyfill Symbol.dispose and Symbol.asyncDispose if missing
// @ts-ignore — Symbol.dispose may not exist yet
Symbol.dispose ??= Symbol('Symbol.dispose')
// @ts-ignore — Symbol.asyncDispose may not exist yet
Symbol.asyncDispose ??= Symbol('Symbol.asyncDispose')

type DisposeMethod = () => void
type AsyncDisposeMethod = () => void | Promise<void>

/**
 * A stack of cleanup functions that run in LIFO order when disposed.
 * Go-like `defer` semantics for synchronous resource management.
 *
 * @example
 * import * as errore from 'errore'
 *
 * function processFile(path: string) {
 *   using cleanup = new errore.DisposableStack()
 *
 *   const file = openFileSync(path)
 *   cleanup.defer(() => file.closeSync())
 *
 *   const lock = acquireLock(path)
 *   cleanup.defer(() => lock.release())
 *
 *   // ... use file and lock ...
 *   // cleanup runs in reverse order when scope exits:
 *   // 1. lock.release()
 *   // 2. file.closeSync()
 * }
 */
export class DisposableStack implements Disposable {
  #stack: DisposeMethod[] = []
  #disposed = false

  /**
   * Whether this stack has already been disposed.
   */
  get disposed(): boolean {
    return this.#disposed
  }

  /**
   * Schedule a cleanup function to run when this stack is disposed.
   * Functions run in LIFO (last-in, first-out) order — like Go's defer.
   */
  defer(onDispose: DisposeMethod): void {
    if (this.#disposed) {
      throw new ReferenceError('DisposableStack already disposed')
    }
    this.#stack.push(onDispose)
  }

  /**
   * Register a Disposable resource. Its [Symbol.dispose]() will be called
   * when this stack is disposed. Returns the resource for convenience.
   */
  use<T extends Disposable | null | undefined>(value: T): T {
    if (value != null) {
      this.defer(() => value[Symbol.dispose]())
    }
    return value
  }

  /**
   * Register a non-disposable value with a custom cleanup callback.
   * Returns the value for convenience.
   */
  adopt<T>(value: T, onDispose: (value: T) => void): T {
    this.defer(() => onDispose(value))
    return value
  }

  /**
   * Move all registered disposables to a new stack, leaving this one empty.
   * The returned stack owns the cleanup responsibilities.
   */
  move(): DisposableStack {
    if (this.#disposed) {
      throw new ReferenceError('DisposableStack already disposed')
    }
    const newStack = new DisposableStack()
    newStack.#stack = this.#stack
    this.#stack = []
    this.#disposed = true
    return newStack
  }

  /**
   * Dispose all resources in LIFO order. If multiple disposers throw,
   * later errors are attached via SuppressedError (or cause chain fallback).
   */
  [Symbol.dispose](): void {
    if (this.#disposed) return
    this.#disposed = true

    let firstError: unknown = undefined
    for (let i = this.#stack.length - 1; i >= 0; i--) {
      try {
        this.#stack[i]!()
      } catch (err) {
        if (firstError === undefined) {
          firstError = err
        } else {
          firstError = buildSuppressedError(err, firstError)
        }
      }
    }
    this.#stack = []
    if (firstError !== undefined) throw firstError
  }

  dispose(): void {
    this[Symbol.dispose]()
  }
}

/**
 * A stack of async cleanup functions that run in LIFO order when disposed.
 * Go-like `defer` semantics for async resource management.
 *
 * @example
 * import * as errore from 'errore'
 *
 * async function handleRequest(id: string) {
 *   await using cleanup = new errore.AsyncDisposableStack()
 *
 *   const db = await connectDb()
 *   cleanup.defer(async () => await db.close())
 *
 *   const cache = await openCache()
 *   cleanup.defer(async () => await cache.flush())
 *
 *   // ... use db and cache ...
 *   // cleanup runs in reverse order when scope exits
 * }
 */
export class AsyncDisposableStack implements AsyncDisposable {
  #stack: AsyncDisposeMethod[] = []
  #disposed = false

  /**
   * Whether this stack has already been disposed.
   */
  get disposed(): boolean {
    return this.#disposed
  }

  /**
   * Schedule an async cleanup function to run when this stack is disposed.
   * Functions run in LIFO (last-in, first-out) order — like Go's defer.
   */
  defer(onDispose: AsyncDisposeMethod): void {
    if (this.#disposed) {
      throw new ReferenceError('AsyncDisposableStack already disposed')
    }
    this.#stack.push(onDispose)
  }

  /**
   * Register a Disposable or AsyncDisposable resource. Its dispose method
   * will be called when this stack is disposed. Returns the resource.
   */
  use<T extends AsyncDisposable | Disposable | null | undefined>(value: T): T {
    if (value != null) {
      if (Symbol.asyncDispose in (value as object)) {
        this.defer(
          async () => await (value as AsyncDisposable)[Symbol.asyncDispose](),
        )
      } else {
        this.defer(() => (value as Disposable)[Symbol.dispose]())
      }
    }
    return value
  }

  /**
   * Register a non-disposable value with a custom async cleanup callback.
   * Returns the value for convenience.
   */
  adopt<T>(value: T, onDispose: (value: T) => void | Promise<void>): T {
    this.defer(() => onDispose(value))
    return value
  }

  /**
   * Move all registered disposables to a new stack, leaving this one empty.
   * The returned stack owns the cleanup responsibilities.
   */
  move(): AsyncDisposableStack {
    if (this.#disposed) {
      throw new ReferenceError('AsyncDisposableStack already disposed')
    }
    const newStack = new AsyncDisposableStack()
    newStack.#stack = this.#stack
    this.#stack = []
    this.#disposed = true
    return newStack
  }

  /**
   * Dispose all resources in LIFO order. If multiple disposers throw,
   * later errors are attached via SuppressedError (or cause chain fallback).
   */
  async [Symbol.asyncDispose](): Promise<void> {
    if (this.#disposed) return
    this.#disposed = true

    let firstError: unknown = undefined
    for (let i = this.#stack.length - 1; i >= 0; i--) {
      try {
        await this.#stack[i]!()
      } catch (err) {
        if (firstError === undefined) {
          firstError = err
        } else {
          firstError = buildSuppressedError(err, firstError)
        }
      }
    }
    this.#stack = []
    if (firstError !== undefined) throw firstError
  }

  async disposeAsync(): Promise<void> {
    await this[Symbol.asyncDispose]()
  }
}

/**
 * Build a SuppressedError if the global exists (newer runtimes),
 * otherwise fall back to cause chain.
 */
function buildSuppressedError(
  latestError: unknown,
  previousError: unknown,
): Error {
  if (typeof globalThis.SuppressedError === 'function') {
    return new globalThis.SuppressedError(
      latestError,
      previousError,
      'An error was suppressed during disposal',
    )
  }
  // Fallback: attach previous error as cause
  const err =
    latestError instanceof Error ? latestError : new Error(String(latestError))
  if (!err.cause) {
    err.cause = previousError
  }
  return err
}
