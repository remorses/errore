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
