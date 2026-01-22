# Changelog

## 0.8.2

- replace tsup with **tsc**
- add **declaration source maps**
- include **src** in package

## 0.8.1

- **ESM only** - remove CJS build

## 0.8.0

- Fix **npm exports** - correct ESM/CJS paths (`index.js`/`index.cjs` not `.mjs`)
- Add `createTaggedError` factory with `$variable` message interpolation
- Variables in message templates are automatically extracted and required in constructor
- Supports custom base class via `extends` option
- Recommended pattern: `class MyError extends createTaggedError({...}) {}`

## 0.7.1

- Export `tryFn` as `try` for cleaner API (`errore.try()` instead of `errore.tryFn()`)
- Update README and MIGRATION docs to use `import * as errore` (namespace import preferred over named imports)

## 0.7.0

- Bump to 0.7.0

## 0.6.0

- Switch to NodeNext module resolution
- Add API error handling example
- Add custom base class support to TaggedError
