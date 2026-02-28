import { gen, ok } from './index.js'

type Equal<A, B> = (<T>() => T extends A ? 1 : 2) extends <T>() => T extends B
  ? 1
  : 2
  ? true
  : false
type Expect<T extends true> = T

class FirstError extends Error {
  name = 'FirstError'
}

class SecondError extends Error {
  name = 'SecondError'
}

function mayFail1(): FirstError | number {
  return 1
}

function mayFail2(): SecondError | number {
  return 2
}

const syncResult = gen(function* () {
  const a = yield* ok(mayFail1())
  const b = yield* ok(mayFail2())
  return a + b
})

type SyncExpected = FirstError | SecondError | number
type _Sync = Expect<Equal<typeof syncResult, SyncExpected>>

const asyncResult = gen(async function* () {
  const a = yield* ok(await Promise.resolve(mayFail1()))
  const b = yield* ok(await Promise.resolve(mayFail2()))
  return a + b
})

type AsyncExpected = Promise<FirstError | SecondError | number>
type _Async = Expect<Equal<typeof asyncResult, AsyncExpected>>
