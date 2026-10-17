# Tests

Start with [Testing](../docs/reference/operations/testing.md) to choose what to run for a change.
Test code is organized by the behavior it exercises:

```text
tests/
  unit/<domain>/         # Individual functions and module behavior
  integration/<domain>/  # Modules using an isolated database
  e2e/
    site/<domain>/       # Built website: navigation, UI, HTTP, accessibility
  support/               # Reusable helpers; no scenarios
    browser/
  fixtures/              # Static inputs and standalone test assets
```

## Adding or changing a test

Put a test with the suite that answers its question. Unit tests use
`*.test.mts`; website browser tests use `*.spec.mts`. Playwright is scoped to
`e2e/site/`.

Use the same domain name as the component or library being tested. The test
command discovers unit tests recursively, so a test belongs with its domain
rather than at the root of the suite.

Keep helpers used only by one scenario beside it. Share reusable helpers
through `support/`, and put input files in `fixtures/`. Support code can import
application libraries and other support code; it cannot import a scenario or a
command. ESLint enforces these boundaries.
