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
  | 'a' | 'b' | 'c' | 'd' | 'e' | 'f' | 'g' | 'h' | 'i' | 'j' | 'k' | 'l' | 'm'
  | 'n' | 'o' | 'p' | 'q' | 'r' | 's' | 't' | 'u' | 'v' | 'w' | 'x' | 'y' | 'z'
  | 'A' | 'B' | 'C' | 'D' | 'E' | 'F' | 'G' | 'H' | 'I' | 'J' | 'K' | 'L' | 'M'
  | 'N' | 'O' | 'P' | 'Q' | 'R' | 'S' | 'T' | 'U' | 'V' | 'W' | 'X' | 'Y' | 'Z'
  | '_'
type Digit = '0' | '1' | '2' | '3' | '4' | '5' | '6' | '7' | '8' | '9'
type AlphaNum = Alpha | Digit

/**
 * Recursively consume valid identifier characters to extract a variable name.
 * Returns [extractedVar, remainingString] as a tuple encoded in an object.
 */
type ConsumeVar<S extends string, Acc extends string = ''> =
  S extends `${infer C}${infer Rest}`
    ? C extends AlphaNum
      ? ConsumeVar<Rest, `${Acc}${C}`>
      : { var: Acc; rest: S }
    : { var: Acc; rest: '' }

/**
 * Extract variable names from a message template containing $variable placeholders.
 * Only extracts valid identifiers (alphanumeric + underscore).
 */
type ExtractVars<S extends string> =
  S extends `${string}$${infer AfterDollar}`
    ? AfterDollar extends `${Alpha}${string}`
      ? ConsumeVar<AfterDollar> extends { var: infer V extends string; rest: infer R extends string }
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
type VarProps<Msg extends string> = ExtractVars<Msg> extends never
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
  toJSON(): object
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
    ...args: ExtractVars<Msg> extends never ? [args?: { cause?: unknown }] : [args: PropsWithCause<Msg>]
  ): FactoryTaggedErrorInstance<Tag, Msg, Base>
  /** Type guard for this error class */
  is(value: unknown): value is FactoryTaggedErrorInstance<Tag, Msg, Base>
  /** The tag/name of this error class */
  readonly tag: Tag
}

/**
 * Serialize cause for JSON output
 */
const serializeCause = (cause: unknown): unknown => {
  if (cause instanceof Error) {
    return { name: cause.name, message: cause.message, stack: cause.stack }
  }
  return cause
}

/**
 * Parse $variable placeholders from message template.
 * Returns array of variable names found.
 */
const parseVariables = (message: string): string[] => {
  const vars: string[] = []
  const regex = /\$([a-zA-Z_][a-zA-Z0-9_]*)/g
  let match
  while ((match = regex.exec(message)) !== null) {
    vars.push(match[1])
  }
  return vars
}

/**
 * Interpolate variables into message template.
 */
const interpolateMessage = (template: string, values: Record<string, unknown>): string => {
  return template.replace(/\$([a-zA-Z_][a-zA-Z0-9_]*)/g, (_, varName) => {
    const value = values[varName]
    return value !== undefined ? String(value) : `$${varName}`
  })
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
  Msg extends string,
  BaseClass extends ErrorClass = typeof Error,
>(opts: {
  name: Name
  message: Msg
  extends?: BaseClass
}): FactoryTaggedErrorClass<Name, Msg, InstanceType<BaseClass>> {
  const { name: tag, message: messageTemplate } = opts
  const BaseError = opts.extends ?? Error
  const varNames = parseVariables(messageTemplate)

  // Use a type assertion to help TypeScript understand the base class
  const TypedBase = BaseError as typeof Error

  class Tagged extends TypedBase {
    readonly _tag: Name = tag

    static readonly tag: Name = tag

    static is(value: unknown): value is Tagged {
      return value instanceof Tagged
    }

    constructor(args?: Record<string, unknown>) {
      const interpolatedMessage = args ? interpolateMessage(messageTemplate, args) : messageTemplate
      const cause = args && 'cause' in args ? args.cause : undefined

      super(interpolatedMessage, cause !== undefined ? { cause } : undefined)

      // Assign all variables as properties
      if (args) {
        for (const varName of varNames) {
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

    toJSON(): object {
      const json: Record<string, unknown> = {
        _tag: this._tag,
        name: this.name,
        message: this.message,
        cause: serializeCause(this.cause),
        stack: this.stack,
      }
      // Include variable properties
      for (const varName of varNames) {
        if (varName in this) {
          json[varName] = (this as Record<string, unknown>)[varName]
        }
      }
      return json
    }
  }

  return Tagged as unknown as FactoryTaggedErrorClass<Name, Msg, InstanceType<BaseClass>>
}
