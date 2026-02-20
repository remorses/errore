/**
 * Shared helper to serialize unknown `cause` values to JSON-safe data.
 */
export const serializeCause = (cause: unknown): unknown => {
  if (cause instanceof Error) {
    return { name: cause.name, message: cause.message, stack: cause.stack }
  }
  return cause
}
