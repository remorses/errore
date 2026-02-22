// Benchmark createTaggedError constructor interpolation performance.
import { bench, do_not_optimize, group, run, summary } from 'mitata'
import { createTaggedError } from '../src/factory.js'

const complexTemplate =
  'Failed $operation for $id at $path with $reason (code $code)'

const complexArgs = {
  operation: 'fetch',
  id: '123',
  path: '/users/123',
  reason: 'timeout',
  code: 504,
}

class RegexReplaceError extends Error {
  constructor(args: Record<string, unknown>) {
    const message = complexTemplate.replace(
      /\$([a-zA-Z_][a-zA-Z0-9_]*)/g,
      (_, varName: string) => {
        const value = args[varName]
        return value !== undefined ? String(value) : `$${varName}`
      },
    )
    super(message)
    Object.setPrototypeOf(this, new.target.prototype)
    this.name = 'RegexReplaceError'
  }
}

const CompiledError = createTaggedError({
  name: 'CompiledError',
  message: complexTemplate,
})

const SinglePlaceholderError = createTaggedError({
  name: 'SinglePlaceholderError',
  message: 'Request failed: $message',
})

const StaticMessageError = createTaggedError({
  name: 'StaticMessageError',
  message: 'Request failed',
})

group('createTaggedError interpolation', () => {
  summary(() => {
    bench('compiled interpolator (5 placeholders)', () => {
      do_not_optimize(new CompiledError(complexArgs))
    })

    bench('regex replace baseline (5 placeholders)', () => {
      do_not_optimize(new RegexReplaceError(complexArgs))
    })

    bench('compiled interpolator (1 placeholder)', () => {
      do_not_optimize(
        new SinglePlaceholderError({ message: 'upstream timeout' }),
      )
    })

    bench('compiled interpolator (0 placeholders)', () => {
      do_not_optimize(new StaticMessageError())
    })
  })
})

await run()
