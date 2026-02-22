// Benchmark: Effect.gen (generators) vs errore (plain instanceof).
// Compares speed and memory for sync and async loops with typed error handling.
// Run: bun run bench
//
// Both sides do identical work: fetch user by ID → validate → collect results.
// Every 7th ID triggers NotFoundError, every 13th triggers ValidationError.
// Both sides do identical work: fetch user by ID → validate → collect results.
// Every 7th ID triggers NotFoundError, every 13th triggers ValidationError.
// Effect uses idiomatic Data.TaggedError + Effect.gen + yield*.
// errore uses TaggedError + instanceof checks.

import { run, bench, group, summary, do_not_optimize } from 'mitata'
import { Effect, Data } from 'effect'
import { TaggedError } from '../src/error.js'

// ── Types ────────────────────────────────────────────────────────────────────

interface User {
  id: number
  name: string
  email: string
  active: boolean
}

// ── Effect errors (Data.TaggedError — idiomatic Effect) ──────────────────────

class EffNotFound extends Data.TaggedError('NotFoundError')<{
  readonly id: number
}> {}

class EffValidation extends Data.TaggedError('ValidationError')<{
  readonly id: number
  readonly reason: string
}> {}

// ── errore errors (TaggedError — idiomatic errore) ───────────────────────────

class ErrNotFound extends TaggedError('NotFoundError')<{
  id: number
}>() {}

class ErrValidation extends TaggedError('ValidationError')<{
  id: number
  reason: string
}>() {}

// ── Shared logic ─────────────────────────────────────────────────────────────
// Every 7th ID → not found, every 13th → validation error, rest → success.
// This means ~14% errors from fetch, ~7% from validation on remaining items.

function makeUser(id: number): User {
  return {
    id,
    name: `user_${id}`,
    email: `user_${id}@test.com`,
    active: id % 3 !== 0,
  }
}

// ── Effect sync implementations ──────────────────────────────────────────────

function effFetchUser(id: number) {
  if (id % 7 === 0) return Effect.fail(new EffNotFound({ id }))
  return Effect.succeed(makeUser(id))
}

function effValidateUser(user: User) {
  if (user.id % 13 === 0)
    return Effect.fail(new EffValidation({ id: user.id, reason: 'inactive' }))
  return Effect.succeed(user)
}

// ── errore sync implementations ──────────────────────────────────────────────

function errFetchUser(id: number): User | ErrNotFound {
  if (id % 7 === 0) return new ErrNotFound({ id })
  return makeUser(id)
}

function errValidateUser(user: User): User | ErrValidation {
  if (user.id % 13 === 0)
    return new ErrValidation({ id: user.id, reason: 'inactive' })
  return user
}

// ── Effect async implementations ─────────────────────────────────────────────

function effFetchUserAsync(id: number) {
  return Effect.async<User, EffNotFound>((resume) => {
    Promise.resolve().then(() => {
      if (id % 7 === 0) resume(Effect.fail(new EffNotFound({ id })))
      else resume(Effect.succeed(makeUser(id)))
    })
  })
}

// ── errore async implementations ─────────────────────────────────────────────

async function errFetchUserAsync(id: number): Promise<User | ErrNotFound> {
  await Promise.resolve()
  if (id % 7 === 0) return new ErrNotFound({ id })
  return makeUser(id)
}

// ── Pre-generate test IDs ────────────────────────────────────────────────────

const SIZES = [10, 100, 1000]

// ═══════════════════════════════════════════════════════════════════════════════
//  SYNC BENCHMARKS
// ═══════════════════════════════════════════════════════════════════════════════

group('Sync loop — skip errors, collect successes', () => {
  summary(() => {
    // ── Effect.gen with yield* in a for loop ───────────────────────────────
    bench('Effect.gen (yield*)', function* (state) {
      const n = state.get('n')
      const ids = Array.from({ length: n }, (_, i) => i + 1)

      yield () => {
        const program = Effect.gen(function* () {
          const results: User[] = []
          for (const id of ids) {
            const result = yield* Effect.either(
              effFetchUser(id).pipe(Effect.flatMap(effValidateUser)),
            )
            if (result._tag === 'Right') results.push(result.right)
          }
          return results
        })
        do_not_optimize(Effect.runSync(program))
      }
    }).args('n', SIZES)

    // ── errore with instanceof in a for loop ───────────────────────────────
    bench('errore (instanceof)', function* (state) {
      const n = state.get('n')
      const ids = Array.from({ length: n }, (_, i) => i + 1)

      yield () => {
        const results: User[] = []
        for (const id of ids) {
          const user = errFetchUser(id)
          if (user instanceof Error) continue
          const validated = errValidateUser(user)
          if (validated instanceof Error) continue
          results.push(validated)
        }
        do_not_optimize(results)
      }
    }).args('n', SIZES)

    // ── Effect.forEach (idiomatic batch) ───────────────────────────────────
    bench('Effect.forEach', function* (state) {
      const n = state.get('n')
      const ids = Array.from({ length: n }, (_, i) => i + 1)

      yield () => {
        const program = Effect.forEach(ids, (id) =>
          effFetchUser(id).pipe(Effect.flatMap(effValidateUser), Effect.either),
        ).pipe(
          Effect.map((results) =>
            results.reduce<User[]>((acc, r) => {
              if (r._tag === 'Right') acc.push(r.right)
              return acc
            }, []),
          ),
        )
        do_not_optimize(Effect.runSync(program))
      }
    }).args('n', SIZES)
  })
})

// ═══════════════════════════════════════════════════════════════════════════════
//  SYNC SHORT-CIRCUIT — stop on first error
// ═══════════════════════════════════════════════════════════════════════════════

group('Sync loop — short-circuit on first error', () => {
  summary(() => {
    bench('Effect.gen (yield*)', function* (state) {
      const n = state.get('n')
      const ids = Array.from({ length: n }, (_, i) => i + 1)

      yield () => {
        const program = Effect.gen(function* () {
          const results: User[] = []
          for (const id of ids) {
            const user = yield* effFetchUser(id)
            const validated = yield* effValidateUser(user)
            results.push(validated)
          }
          return results
        }).pipe(
          Effect.catchTag('NotFoundError', () => Effect.succeed([] as User[])),
          Effect.catchTag('ValidationError', () =>
            Effect.succeed([] as User[]),
          ),
        )
        do_not_optimize(Effect.runSync(program))
      }
    }).args('n', SIZES)

    bench('errore (instanceof)', function* (state) {
      const n = state.get('n')
      const ids = Array.from({ length: n }, (_, i) => i + 1)

      yield () => {
        const results: User[] = []
        for (const id of ids) {
          const user = errFetchUser(id)
          if (user instanceof Error) {
            do_not_optimize([] as User[])
            return
          }
          const validated = errValidateUser(user)
          if (validated instanceof Error) {
            do_not_optimize([] as User[])
            return
          }
          results.push(validated)
        }
        do_not_optimize(results)
      }
    }).args('n', SIZES)
  })
})

// ═══════════════════════════════════════════════════════════════════════════════
//  ASYNC BENCHMARKS
// ═══════════════════════════════════════════════════════════════════════════════

group('Async loop — skip errors, collect successes', () => {
  summary(() => {
    // ── Effect.gen async with yield* ───────────────────────────────────────
    bench('Effect.gen async (yield*)', function* (state) {
      const n = state.get('n')
      const ids = Array.from({ length: n }, (_, i) => i + 1)

      yield async () => {
        const program = Effect.gen(function* () {
          const results: User[] = []
          for (const id of ids) {
            const result = yield* Effect.either(
              effFetchUserAsync(id).pipe(Effect.flatMap(effValidateUser)),
            )
            if (result._tag === 'Right') results.push(result.right)
          }
          return results
        })
        do_not_optimize(await Effect.runPromise(program))
      }
    }).args('n', SIZES)

    // ── errore async with instanceof ───────────────────────────────────────
    bench('errore async (instanceof)', function* (state) {
      const n = state.get('n')
      const ids = Array.from({ length: n }, (_, i) => i + 1)

      yield async () => {
        const results: User[] = []
        for (const id of ids) {
          const user = await errFetchUserAsync(id)
          if (user instanceof Error) continue
          const validated = errValidateUser(user)
          if (validated instanceof Error) continue
          results.push(validated)
        }
        do_not_optimize(results)
      }
    }).args('n', SIZES)

    // ── Effect.forEach async ───────────────────────────────────────────────
    bench('Effect.forEach async', function* (state) {
      const n = state.get('n')
      const ids = Array.from({ length: n }, (_, i) => i + 1)

      yield async () => {
        const program = Effect.forEach(ids, (id) =>
          effFetchUserAsync(id).pipe(
            Effect.flatMap(effValidateUser),
            Effect.either,
          ),
        ).pipe(
          Effect.map((results) =>
            results.reduce<User[]>((acc, r) => {
              if (r._tag === 'Right') acc.push(r.right)
              return acc
            }, []),
          ),
        )
        do_not_optimize(await Effect.runPromise(program))
      }
    }).args('n', SIZES)
  })
})

await run()
