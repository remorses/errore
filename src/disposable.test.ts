import { describe, test, expect } from 'vitest'
import { DisposableStack, AsyncDisposableStack } from './index.js'

// ============================================================================
// DisposableStack
// ============================================================================

describe('DisposableStack', () => {
  test('defer runs callbacks in LIFO order', () => {
    const order: number[] = []
    const stack = new DisposableStack()
    stack.defer(() => {
      order.push(1)
    })
    stack.defer(() => {
      order.push(2)
    })
    stack.defer(() => {
      order.push(3)
    })
    stack[Symbol.dispose]()
    expect(order).toMatchInlineSnapshot(`
      [
        3,
        2,
        1,
      ]
    `)
  })

  test('dispose() is an alias for Symbol.dispose', () => {
    const order: number[] = []
    const stack = new DisposableStack()
    stack.defer(() => {
      order.push(1)
    })
    stack.dispose()
    expect(order).toMatchInlineSnapshot(`
      [
        1,
      ]
    `)
  })

  test('disposed property tracks state', () => {
    const stack = new DisposableStack()
    expect(stack.disposed).toBe(false)
    stack[Symbol.dispose]()
    expect(stack.disposed).toBe(true)
  })

  test('double dispose is a no-op', () => {
    let count = 0
    const stack = new DisposableStack()
    stack.defer(() => {
      count++
    })
    stack[Symbol.dispose]()
    stack[Symbol.dispose]()
    expect(count).toBe(1)
  })

  test('defer throws after disposal', () => {
    const stack = new DisposableStack()
    stack[Symbol.dispose]()
    expect(() => stack.defer(() => {})).toThrow('already disposed')
  })

  test('use() registers a Disposable and returns it', () => {
    const log: string[] = []
    const resource = {
      name: 'myResource',
      [Symbol.dispose]() {
        log.push('disposed')
      },
    }
    const stack = new DisposableStack()
    const returned = stack.use(resource)
    expect(returned).toBe(resource)
    stack[Symbol.dispose]()
    expect(log).toMatchInlineSnapshot(`
      [
        "disposed",
      ]
    `)
  })

  test('use() accepts null and undefined', () => {
    const stack = new DisposableStack()
    expect(stack.use(null)).toBe(null)
    expect(stack.use(undefined)).toBe(undefined)
    // should not throw on dispose
    stack[Symbol.dispose]()
  })

  test('adopt() registers a value with custom cleanup', () => {
    const log: string[] = []
    const stack = new DisposableStack()
    const handle = stack.adopt(42, (v) => {
      log.push(`cleaned ${v}`)
    })
    expect(handle).toBe(42)
    stack[Symbol.dispose]()
    expect(log).toMatchInlineSnapshot(`
      [
        "cleaned 42",
      ]
    `)
  })

  test('move() transfers ownership to a new stack', () => {
    const log: string[] = []
    const stack = new DisposableStack()
    stack.defer(() => {
      log.push('a')
    })
    stack.defer(() => {
      log.push('b')
    })

    const newStack = stack.move()
    expect(stack.disposed).toBe(true)
    expect(newStack.disposed).toBe(false)

    // Original stack dispose is a no-op
    stack[Symbol.dispose]()
    expect(log).toMatchInlineSnapshot(`[]`)

    // New stack owns the cleanup
    newStack[Symbol.dispose]()
    expect(log).toMatchInlineSnapshot(`
      [
        "b",
        "a",
      ]
    `)
  })

  test('move() throws if already disposed', () => {
    const stack = new DisposableStack()
    stack[Symbol.dispose]()
    expect(() => stack.move()).toThrow('already disposed')
  })

  test('errors in disposers: first error is thrown, all disposers still run', () => {
    const log: string[] = []
    const stack = new DisposableStack()
    stack.defer(() => {
      log.push('a')
    })
    stack.defer(() => {
      throw new Error('boom')
    })
    stack.defer(() => {
      log.push('c')
    })
    expect(() => stack[Symbol.dispose]()).toThrow('boom')
    // All disposers ran despite the error
    expect(log).toMatchInlineSnapshot(`
      [
        "c",
        "a",
      ]
    `)
  })

  test('multiple errors: all disposers run, errors are chained', () => {
    const stack = new DisposableStack()
    stack.defer(() => {
      throw new Error('first-deferred')
    })
    stack.defer(() => {
      throw new Error('second-deferred')
    })
    try {
      stack[Symbol.dispose]()
    } catch (e: any) {
      // LIFO: 'second-deferred' runs first, 'first-deferred' runs second.
      // SuppressedError wraps both: .error is first-deferred (latest),
      // .suppressed is second-deferred (previous).
      expect(e).toBeInstanceOf(Error)
      if ('error' in e) {
        // Native SuppressedError
        expect(e.error.message).toContain('first-deferred')
        expect(e.suppressed.message).toContain('second-deferred')
      } else {
        // Fallback: cause chain
        expect(e.message).toContain('first-deferred')
        expect(e.cause).toBeInstanceOf(Error)
        expect((e.cause as Error).message).toContain('second-deferred')
      }
    }
  })

  test('works with using keyword syntax', () => {
    const log: string[] = []
    function doWork() {
      using stack = new DisposableStack()
      stack.defer(() => {
        log.push('cleaned up')
      })
      log.push('working')
    }
    doWork()
    expect(log).toMatchInlineSnapshot(`
      [
        "working",
        "cleaned up",
      ]
    `)
  })

  test('using + early return still runs cleanup', () => {
    const log: string[] = []
    function doWork(shouldReturn: boolean): string {
      using stack = new DisposableStack()
      stack.defer(() => {
        log.push('cleanup')
      })
      if (shouldReturn) return 'early'
      return 'normal'
    }
    expect(doWork(true)).toBe('early')
    expect(log).toMatchInlineSnapshot(`
      [
        "cleanup",
      ]
    `)
  })

  test('using + thrown error still runs cleanup', () => {
    const log: string[] = []
    function doWork() {
      using stack = new DisposableStack()
      stack.defer(() => {
        log.push('cleanup')
      })
      throw new Error('oops')
    }
    expect(() => doWork()).toThrow('oops')
    expect(log).toMatchInlineSnapshot(`
      [
        "cleanup",
      ]
    `)
  })
})

// ============================================================================
// AsyncDisposableStack
// ============================================================================

describe('AsyncDisposableStack', () => {
  test('defer runs async callbacks in LIFO order', async () => {
    const order: number[] = []
    const stack = new AsyncDisposableStack()
    stack.defer(async () => {
      order.push(1)
    })
    stack.defer(async () => {
      order.push(2)
    })
    stack.defer(async () => {
      order.push(3)
    })
    await stack[Symbol.asyncDispose]()
    expect(order).toMatchInlineSnapshot(`
      [
        3,
        2,
        1,
      ]
    `)
  })

  test('disposeAsync() is an alias for Symbol.asyncDispose', async () => {
    const order: number[] = []
    const stack = new AsyncDisposableStack()
    stack.defer(async () => {
      order.push(1)
    })
    await stack.disposeAsync()
    expect(order).toMatchInlineSnapshot(`
      [
        1,
      ]
    `)
  })

  test('disposed property tracks state', async () => {
    const stack = new AsyncDisposableStack()
    expect(stack.disposed).toBe(false)
    await stack[Symbol.asyncDispose]()
    expect(stack.disposed).toBe(true)
  })

  test('double dispose is a no-op', async () => {
    let count = 0
    const stack = new AsyncDisposableStack()
    stack.defer(async () => {
      count++
    })
    await stack[Symbol.asyncDispose]()
    await stack[Symbol.asyncDispose]()
    expect(count).toBe(1)
  })

  test('defer throws after disposal', async () => {
    const stack = new AsyncDisposableStack()
    await stack[Symbol.asyncDispose]()
    expect(() => stack.defer(async () => {})).toThrow('already disposed')
  })

  test('defer accepts sync callbacks', async () => {
    const log: string[] = []
    const stack = new AsyncDisposableStack()
    stack.defer(() => {
      log.push('sync cleanup')
    })
    await stack[Symbol.asyncDispose]()
    expect(log).toMatchInlineSnapshot(`
      [
        "sync cleanup",
      ]
    `)
  })

  test('use() registers an AsyncDisposable', async () => {
    const log: string[] = []
    const resource = {
      async [Symbol.asyncDispose]() {
        log.push('async disposed')
      },
    }
    const stack = new AsyncDisposableStack()
    const returned = stack.use(resource)
    expect(returned).toBe(resource)
    await stack[Symbol.asyncDispose]()
    expect(log).toMatchInlineSnapshot(`
      [
        "async disposed",
      ]
    `)
  })

  test('use() registers a sync Disposable', async () => {
    const log: string[] = []
    const resource = {
      [Symbol.dispose]() {
        log.push('sync disposed')
      },
    }
    const stack = new AsyncDisposableStack()
    stack.use(resource)
    await stack[Symbol.asyncDispose]()
    expect(log).toMatchInlineSnapshot(`
      [
        "sync disposed",
      ]
    `)
  })

  test('use() accepts null and undefined', async () => {
    const stack = new AsyncDisposableStack()
    expect(stack.use(null)).toBe(null)
    expect(stack.use(undefined)).toBe(undefined)
    await stack[Symbol.asyncDispose]()
  })

  test('adopt() registers a value with async cleanup', async () => {
    const log: string[] = []
    const stack = new AsyncDisposableStack()
    const handle = stack.adopt('conn', async (v) => {
      log.push(`closed ${v}`)
    })
    expect(handle).toBe('conn')
    await stack[Symbol.asyncDispose]()
    expect(log).toMatchInlineSnapshot(`
      [
        "closed conn",
      ]
    `)
  })

  test('move() transfers ownership to a new stack', async () => {
    const log: string[] = []
    const stack = new AsyncDisposableStack()
    stack.defer(async () => {
      log.push('a')
    })
    stack.defer(async () => {
      log.push('b')
    })

    const newStack = stack.move()
    expect(stack.disposed).toBe(true)
    expect(newStack.disposed).toBe(false)

    await stack[Symbol.asyncDispose]()
    expect(log).toMatchInlineSnapshot(`[]`)

    await newStack[Symbol.asyncDispose]()
    expect(log).toMatchInlineSnapshot(`
      [
        "b",
        "a",
      ]
    `)
  })

  test('errors in async disposers: all disposers still run', async () => {
    const log: string[] = []
    const stack = new AsyncDisposableStack()
    stack.defer(async () => {
      log.push('a')
    })
    stack.defer(async () => {
      throw new Error('async boom')
    })
    stack.defer(async () => {
      log.push('c')
    })
    await expect(stack[Symbol.asyncDispose]()).rejects.toThrow('async boom')
    expect(log).toMatchInlineSnapshot(`
      [
        "c",
        "a",
      ]
    `)
  })

  test('works with await using keyword syntax', async () => {
    const log: string[] = []
    async function doWork() {
      await using stack = new AsyncDisposableStack()
      stack.defer(async () => {
        log.push('cleaned up')
      })
      log.push('working')
    }
    await doWork()
    expect(log).toMatchInlineSnapshot(`
      [
        "working",
        "cleaned up",
      ]
    `)
  })

  test('await using + early return still runs cleanup', async () => {
    const log: string[] = []
    async function doWork(shouldReturn: boolean): Promise<string> {
      await using stack = new AsyncDisposableStack()
      stack.defer(async () => {
        log.push('cleanup')
      })
      if (shouldReturn) return 'early'
      return 'normal'
    }
    expect(await doWork(true)).toBe('early')
    expect(log).toMatchInlineSnapshot(`
      [
        "cleanup",
      ]
    `)
  })

  test('await using + thrown error still runs cleanup', async () => {
    const log: string[] = []
    async function doWork() {
      await using stack = new AsyncDisposableStack()
      stack.defer(async () => {
        log.push('cleanup')
      })
      throw new Error('oops')
    }
    await expect(doWork()).rejects.toThrow('oops')
    expect(log).toMatchInlineSnapshot(`
      [
        "cleanup",
      ]
    `)
  })
})

// ============================================================================
// Integration: errore + DisposableStack
// ============================================================================

describe('errore + DisposableStack integration', () => {
  test('defer cleanup with errore error handling pattern', async () => {
    const log: string[] = []

    class DbError extends Error {
      readonly _tag = 'DbError' as const
    }

    async function processRequest(): Promise<DbError | string> {
      await using cleanup = new AsyncDisposableStack()

      // Simulate acquiring resources
      const db = { connected: true }
      cleanup.defer(async () => {
        log.push('db closed')
        db.connected = false
      })

      const cache = { open: true }
      cleanup.defer(async () => {
        log.push('cache flushed')
        cache.open = false
      })

      // Simulate an error mid-operation
      if (!db.connected) return new DbError('not connected')

      log.push('work done')
      return 'success'
      // cleanup runs automatically here
    }

    const result = await processRequest()
    expect(result).toBe('success')
    expect(log).toMatchInlineSnapshot(`
      [
        "work done",
        "cache flushed",
        "db closed",
      ]
    `)
  })

  test('cleanup runs even when returning error early', async () => {
    const log: string[] = []

    class ConnectionError extends Error {
      readonly _tag = 'ConnectionError' as const
    }

    async function riskyOp(): Promise<ConnectionError | string> {
      await using cleanup = new AsyncDisposableStack()

      const resource = { released: false }
      cleanup.defer(() => {
        resource.released = true
        log.push('released')
      })

      // Early return with error — cleanup still runs
      return new ConnectionError('failed')
    }

    const result = await riskyOp()
    expect(result).toBeInstanceOf(Error)
    expect(log).toMatchInlineSnapshot(`
      [
        "released",
      ]
    `)
  })
})
