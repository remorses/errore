import { isError } from './core.js'

export function* ok<V>(
  value: V,
): Generator<Extract<V, Error>, Exclude<V, Error>> {
  if (isError(value)) {
    yield value as Extract<V, Error>
    throw new Error('ok must be used with gen')
  }

  return value as Exclude<V, Error>
}

export function gen<Y extends Error, R>(
  body: () => Generator<Y, R>,
): R | Y
export function gen<Y extends Error, R>(
  body: () => AsyncGenerator<Y, R>,
): Promise<R | Y>
export function gen(
  body: () => Generator<Error, unknown> | AsyncGenerator<Error, unknown>,
): unknown {
  const result = body().next()

  if (result instanceof Promise) {
    return result.then((step) => step.value)
  }

  return result.value
}
