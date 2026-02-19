// Type declarations for non-TS module imports in the worker.

declare module '*.md' {
  const content: string
  export default content
}
