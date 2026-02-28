import { describe, test, expect } from 'vitest'
import { gen, ok, createTaggedError, matchError } from './index.js'

class NotFoundError extends createTaggedError({
  name: 'NotFoundError',
  message: 'User $id not found',
}) { }

class DbError extends createTaggedError({
  name: 'DbError',
  message: 'Database failed: $reason',
}) { }

function mayFail1(ok: boolean): NotFoundError | number {
  if (!ok) return new NotFoundError({ id: '123' })
  return 2
}

function mayFail2(ok: boolean): DbError | number {
  if (!ok) return new DbError({ reason: 'timeout' })
  return 3
}

describe('gen', () => {
  test('sync: returns value when all ok', () => {
    const result = gen(function* () {
      const a = yield* ok(mayFail1(true))
      const b = yield* ok(mayFail2(true))
      return a + b
    })

    expect(result).toBe(5)
  })

  test('sync: returns first yielded error', () => {
    const result = gen(function* () {
      const first = yield* ok(mayFail1(false))
      const second = yield* ok(mayFail2(true))
      return first + second
    })

    expect(result).toBeInstanceOf(NotFoundError)
  })

  test('async: returns value when all ok', async () => {
    const result = await gen(async function* () {
      const a = yield* ok(await Promise.resolve(mayFail1(true)))
      const b = yield* ok(await Promise.resolve(mayFail2(true)))
      return a + b
    })

    expect(result).toBe(5)
  })

  test('async: returns first yielded error', async () => {
    const result = await gen(async function* () {
      const first = yield* ok(await Promise.resolve(mayFail1(false)))
      const second = yield* ok(await Promise.resolve(mayFail2(true)))
      return first + second
    })

    expect(result).toBeInstanceOf(NotFoundError)
  })

  test('matches error with matchError', () => {
    const result = gen(function* () {
      const first = yield* ok(mayFail1(false))
      const second = yield* ok(mayFail2(true))
      return first + second
    })

    if (result instanceof Error) {
      const message = matchError(result, {
        NotFoundError: (e) => `Missing ${e.id}`,
        DbError: (e) => `Db ${e.reason}`,
        Error: (e) => `Unknown ${e.message}`,
      })
      expect(message).toBe('Missing 123')
    }
  })
})
