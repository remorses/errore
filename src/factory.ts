import { findCause } from './error.js'
import { serializeCause } from './serialize-cause.js'

/**
 * Factory API for creating tagged errors with $variable interpolation in messages.
 *
 * Extracts variable names from the message template and requires them in the constructor.
 * Use `class X extends createTaggedError({...}) {}` so X is both a value and a type.
 *
 * @example
 * class NotFoundError extends createTaggedError({
 *   name: 'NotFoundError',
 *   message: 'User $id not found in $database'
 * }) {}
 *
 * throw new NotFoundError({ id: '123', database: 'users' })
 * // err._tag = 'NotFoundError'
 * // err.message = 'User 123 not found in users'
 * // err.id = '123'
 * // err.database = 'users'
 */

// Valid identifier characters for variable names (a-z, A-Z, 0-9, _)
type Alpha =
  | 'a'
  | 'b'
  | 'c'
  | 'd'
  | 'e'
  | 'f'
  | 'g'
  | 'h'
  | 'i'
  | 'j'
  | 'k'
  | 'l'
  | 'm'
  | 'n'
  | 'o'
  | 'p'
  | 'q'
  | 'r'
  | 's'
  | 't'
  | 'u'
  | 'v'
  | 'w'
  | 'x'
  | 'y'
  | 'z'
  | 'A'
  | 'B'
  | 'C'
  | 'D'
  | 'E'
  | 'F'
  | 'G'
  | 'H'
  | 'I'
  | 'J'
  | 'K'
  | 'L'
  | 'M'
  | 'N'
  | 'O'
  | 'P'
  | 'Q'
  | 'R'
  | 'S'
  | 'T'
  | 'U'
  | 'V'
  | 'W'
  | 'X'
  | 'Y'
  | 'Z'
  | '_'
type Digit = '0' | '1' | '2' | '3' | '4' | '5' | '6' | '7' | '8' | '9'
type AlphaNum = Alpha | Digit

/**
 * Recursively consume valid identifier characters to extract a variable name.
 * Returns [extractedVar, remainingString] as a tuple encoded in an object.
 */
type ConsumeVar<
  S extends string,
  Acc extends string = '',
> = S extends `${infer C}${infer Rest}`
  ? C extends AlphaNum
    ? ConsumeVar<Rest, `${Acc}${C}`>
    : { var: Acc; rest: S }
  : { var: Acc; rest: '' }

/**
 * Extract variable names from a message template containing $variable placeholders.
 * Only extracts valid identifiers (alphanumeric + underscore).
 */
type ExtractVars<S extends string> = S extends `${string}$${infer AfterDollar}`
  ? AfterDollar extends `${Alpha}${string}`
    ? ConsumeVar<AfterDollar> extends {
        var: infer V extends string
        rest: infer R extends string
      }
      ? V extends ''
        ? ExtractVars<R>
        : V | ExtractVars<R>
      : never
    : ExtractVars<AfterDollar>
  : never

/**
 * Build props type from extracted variable names.
 * Each variable becomes a required property accepting string or number.
 */
type VarProps<Msg extends string> =
  ExtractVars<Msg> extends never
    ? {}
    : { [K in ExtractVars<Msg>]: string | number }

/**
 * Props with optional cause for error chaining.
 */
type PropsWithCause<Msg extends string> = VarProps<Msg> & { cause?: unknown }

/**
 * Any class that extends Error
 */
type ErrorClass = new (...args: any[]) => Error

/**
 * Instance type for factory-created tagged errors.
 */
export type FactoryTaggedErrorInstance<
  Tag extends string,
  Msg extends string,
  Base extends Error = Error,
> = Base & {
  readonly _tag: Tag
  readonly message: string
  /** The original message template with $variable placeholders (e.g. 'User $id not found') */
  readonly messageTemplate: Msg
  /** Stable fingerprint for error grouping in Sentry/logging. Returns [_tag, messageTemplate]. */
  readonly fingerprint: readonly [Tag, Msg]
  toJSON(): object
  /** Walk the .cause chain to find an ancestor matching a specific error class. */
  findCause<T extends Error>(
    ErrorClass: new (...args: any[]) => T,
  ): T | undefined
} & Readonly<VarProps<Msg>>

/**
 * Class type returned by createTaggedError factory.
 */
export type FactoryTaggedErrorClass<
  Tag extends string,
  Msg extends string,
  Base extends Error = Error,
> = {
  new (
    ...args: ExtractVars<Msg> extends never
      ? [args?: { cause?: unknown }]
      : [args: PropsWithCause<Msg>]
  ): FactoryTaggedErrorInstance<Tag, Msg, Base>
  /** Type guard for this error class */
  is(value: unknown): value is FactoryTaggedErrorInstance<Tag, Msg, Base>
  /** The tag/name of this error class */
  readonly tag: Tag
}

/**
 * Compile a `$variable` message template into a reusable interpolator.
 *
 * This parses the template once when creating the error class, then each
 * constructor call uses a simple loop over pre-parsed segments.
 */
const compileMessageInterpolator = (
  template: string,
): {
  readonly variableNames: string[]
  readonly interpolate: (values?: Record<string, unknown>) => string
} => {
  const variableNames: string[] = []
  const seenVariables = new Set<string>()
  const staticParts: string[] = []
  const placeholders: string[] = []

  const regex = /\$([a-zA-Z_][a-zA-Z0-9_]*)/g
  let lastIndex = 0
  let match: RegExpExecArray | null

  while ((match = regex.exec(template)) !== null) {
    staticParts.push(template.slice(lastIndex, match.index))

    const varName = match[1]
    placeholders.push(varName)

    if (!seenVariables.has(varName)) {
      seenVariables.add(varName)
      variableNames.push(varName)
    }

    lastIndex = regex.lastIndex
  }

  staticParts.push(template.slice(lastIndex))

  if (placeholders.length === 0) {
    return {
      variableNames,
      interpolate: () => template,
    }
  }

  if (placeholders.length === 1) {
    const head = staticParts[0] ?? ''
    const tail = staticParts[1] ?? ''
    const varName = placeholders[0]!
    const varLiteral = `$${varName}`

    return {
      variableNames,
      interpolate: (values?: Record<string, unknown>) => {
        if (!values) return template
        const value = values[varName]
        return `${head}${value !== undefined ? String(value) : varLiteral}${tail}`
      },
    }
  }

  const placeholderLiterals = placeholders.map((varName) => `$${varName}`)

  const interpolate = (values?: Record<string, unknown>): string => {
    if (!values) {
      return template
    }

    let result = staticParts[0] ?? ''
    for (let i = 0; i < placeholders.length; i++) {
      const varName = placeholders[i]!
      const value = values[varName]
      result += value !== undefined ? String(value) : placeholderLiterals[i]!
      result += staticParts[i + 1] ?? ''
    }
    return result
  }

  return { variableNames, interpolate }
}

/**
 * Factory for creating tagged error classes with $variable message interpolation.
 *
 * Variables in the message template (prefixed with $) are automatically extracted
 * and required in the constructor. They are interpolated into the message and
 * also available as properties on the error instance.
 *
 * Use `class X extends createTaggedError({...}) {}` pattern so the error is both
 * a value and a type (no need for `InstanceType<typeof X>`).
 *
 * @example
 * class NotFoundError extends createTaggedError({
 *   name: 'NotFoundError',
 *   message: 'User $id not found in $database'
 * }) {}
 *
 * const err = new NotFoundError({ id: '123', database: 'users' })
 * err._tag      // 'NotFoundError'
 * err.message   // 'User 123 not found in users'
 * err.id        // '123'
 * err.database  // 'users'
 *
 * // Type guard
 * NotFoundError.is(err) // true
 *
 * @example
 * // Error without variables
 * class EmptyError extends createTaggedError({
 *   name: 'EmptyError',
 *   message: 'Something went wrong'
 * }) {}
 *
 * throw new EmptyError() // no args required
 *
 * @example
 * // Message omitted — caller provides message at construction time
 * class AppError extends createTaggedError({
 *   name: 'AppError',
 * }) {}
 *
 * throw new AppError({ message: 'something went wrong' })
 * // err.fingerprint is stable across different messages
 *
 * @example
 * // With cause for error chaining
 * class WrapperError extends createTaggedError({
 *   name: 'WrapperError',
 *   message: 'Failed to process $item'
 * }) {}
 *
 * try {
 *   // ...
 * } catch (e) {
 *   throw new WrapperError({ item: 'data', cause: e })
 * }
 *
 * @example
 * // With custom base class
 * class AppError extends Error {
 *   statusCode = 500
 *   report() { return `[${this.statusCode}] ${this.message}` }
 * }
 *
 * class NotFoundError extends createTaggedError({
 *   name: 'NotFoundError',
 *   message: 'Resource $id not found',
 *   extends: AppError
 * }) {}
 *
 * const err = new NotFoundError({ id: '123' })
 * err.statusCode  // 500 (inherited)
 * err.report()    // works
 */
export function createTaggedError<
  Name extends string,
  Msg extends string = '$message',
  BaseClass extends ErrorClass = typeof Error,
>(opts: {
  name: Name
  message?: Msg
  extends?: BaseClass
}): FactoryTaggedErrorClass<Name, Msg, InstanceType<BaseClass>> {
  const { name: tag } = opts
  const messageTemplate = (opts.message ?? '$message') as Msg
  const BaseError = opts.extends ?? Error
  const { variableNames: varNames, interpolate } =
    compileMessageInterpolator(messageTemplate)

  // These variable names conflict with Error internals and would be confusing
  // if used as template variables (the interpolated value can't be read back
  // as a property because the internal property wins).
  const FORBIDDEN_VARS = ['_tag', 'name', 'stack', 'cause'] as const
  for (const forbidden of FORBIDDEN_VARS) {
    if (varNames.includes(forbidden)) {
      throw new Error(
        `createTaggedError(${tag}): template variable $${forbidden} is reserved and not allowed. ` +
          `Use a different variable name.`,
      )
    }
  }

  // Use a type assertion to help TypeScript understand the base class
  const TypedBase = BaseError as typeof Error

  // Keys that are managed internally and must not be overwritten by template variables
  const RESERVED_KEYS = new Set([
    '_tag',
    'messageTemplate',
    'fingerprint',
    'name',
    'stack',
    'message',
    'cause',
  ])
  const serializableVarNames = varNames.filter(
    (varName) => !RESERVED_KEYS.has(varName),
  )

  class Tagged extends TypedBase {
    readonly _tag: Name = tag
    readonly messageTemplate: Msg = messageTemplate

    get fingerprint(): readonly [Name, Msg] {
      return [this._tag, this.messageTemplate]
    }

    static readonly tag: Name = tag

    static is(value: unknown): value is Tagged {
      return value instanceof Tagged
    }

    constructor(args?: Record<string, unknown>) {
      const interpolatedMessage = interpolate(args)
      const cause = args && 'cause' in args ? args.cause : undefined

      super(interpolatedMessage, cause !== undefined ? { cause } : undefined)

      // Assign all variables as properties, skipping reserved internal keys
      if (args) {
        for (const varName of serializableVarNames) {
          if (varName in args) {
            ;(this as Record<string, unknown>)[varName] = args[varName]
          }
        }
      }

      Object.setPrototypeOf(this, new.target.prototype)
      this.name = tag

      if (cause instanceof Error && cause.stack) {
        const indented = cause.stack.replace(/\n/g, '\n  ')
        this.stack = `${this.stack}\nCaused by: ${indented}`
      }
    }

    findCause<T extends Error>(
      ErrorClass: new (...args: any[]) => T,
    ): T | undefined {
      return findCause(this, ErrorClass)
    }

    toJSON(): object {
      const json: Record<string, unknown> = {
        _tag: this._tag,
        name: this.name,
        message: this.message,
        messageTemplate: this.messageTemplate,
        fingerprint: this.fingerprint,
        cause: serializeCause(this.cause),
        stack: this.stack,
      }
      // Include variable properties
      for (const varName of serializableVarNames) {
        if (varName in this) {
          json[varName] = (this as Record<string, unknown>)[varName]
        }
      }
      return json
    }
  }

  return Tagged as unknown as FactoryTaggedErrorClass<
    Name,
    Msg,
    InstanceType<BaseClass>
  >
}
