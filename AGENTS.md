# Agent Instructions

## Effect docs

Effect provides LLM-friendly documentation files:

- **Index**: https://effect.website/llms.txt — lists all doc pages with short descriptions
- **Full docs**: https://effect.website/llms-full.txt — entire documentation in a single text file (very large, will be truncated; save to a file and grep/read with offset)
- **Browsable**: https://effect.website/docs — sidebar with all sections

To read Effect docs as markdown, fetch individual pages with the WebFetch tool:

```
https://effect.website/docs/error-management/expected-errors/
https://effect.website/docs/error-management/retrying/
https://effect.website/docs/requirements-management/services/
https://effect.website/docs/resource-management/scope/
https://effect.website/docs/getting-started/using-generators/
```

For bulk reading, fetch `llms-full.txt`, save it to a temp file, then use grep/read with offset to find specific sections.

## SKILL.md editing

SKILL.md is injected into every agent session as context. Keep it compressed and short to save context window:

- **Only good examples** — SKILL.md should only show the correct errore pattern, never "bad" or "before" examples
- **Bad/before examples go in MIGRATION.md** — that file is not loaded into context automatically, so verbosity there is fine
- **Minimal code snippets** — show the smallest snippet that demonstrates the pattern, not full functions with boilerplate
- **Dense prose** — combine related points, avoid repeating what's obvious from the code
- **No redundancy** — if a pattern is already shown elsewhere in SKILL.md, reference it instead of showing it again
