# Add your first writing page locally

Create a practice article, inspect its local page, and remove the practice file.
This exercise teaches the writing model: the filename determines the URL,
frontmatter supplies metadata, and the body becomes the article. Keeping the
article as a draft lets you inspect it in development without making it public.

## Prerequisites

Complete [local setup](../operations/local-development.md) and work from the
repository root with a text editor and browser. The
[writings reference](../../reference/content/writings.md) describes the full
schema; the [metadata rules](../../reference/design/metadata.md) explain how
titles and descriptions appear across surfaces.

The instructions have been inspected against the template and loader. Their
browser steps have not been exercised for this documentation revision. This
exercise creates a writing page; a standalone application route has different
source and metadata requirements.

## 1. Create a practice draft

### Choose an unused filename

Check that `content/writings/tutorial-practice.mdx` does not exist. If it does,
choose another unused filename. Substitute that name in the copy command, the
file you edit, the URL, and the cleanup step throughout this exercise. Then
copy the template:

```sh
cp -n content/writings/_template.mdx content/writings/tutorial-practice.mdx
```

The filename supplies the slug. A leading underscore excludes the original
template from the writing catalog, so your copy needs a name without that prefix.
The copy command avoids overwriting a destination, but you still need to check
that you are editing the new practice file rather than an existing article.

### Give the example a complete body and metadata

Replace the copied file's contents with this practice article:

```mdx
---
title: Tutorial practice
description: A local practice article about adding a writing page.
published: 2026-10-12T09:00-0700
lastUpdated: 2026-10-12T09:00-0700
tags: []
draft: true
postType: article
---

This article exists so I can inspect a writing page locally. I will remove it
when the exercise is finished.
```

The dates are illustrative practice values. Replace both with the same current
ISO timestamp including your UTC offset. Leave out optional media, series, and
syndication fields for this exercise; those fields describe real relationships
and assets rather than decoration to fill in for every post.

Keep `draft: true`. A draft is visible through the development loader but
excluded from production and the search index. That difference is intentional:
previewing copy should not require making it eligible for public discovery.

## 2. Inspect the page

### Follow the filename to its route

Run `pnpm dev`, open its printed origin, and append
`/writings/tutorial-practice`. Expect the title, practice body, and date. If you
chose another filename, use that slug instead. Do not clear the draft flag to
make the practice article searchable.

A 404 calls for checking the filename, slug, and server mode: use the development
server rather than a production build. A parsing error calls for comparing the
frontmatter with the example and inspecting the terminal error. Those are
different failures and need different fixes.

### Inspect the reading experience

View the page at a phone width and navigate it with a keyboard. Disable
JavaScript, reload the direct article URL, and confirm the writing remains
readable. Review the affected page with the
[design checklist](../../concepts/design/design-principles.md#before-committing).

These checks inspect the experience generated from valid content. A schema can
accept a title and body without proving that they remain readable or usable in
the browser. Resolve a failed experience check rather than treating successful
parsing as the end of the exercise.

## 3. Validate and clean up

### Check the source contracts

Stop the server with Ctrl+C, then run:

```sh
pnpm content:check
pnpm typecheck
pnpm test
```

Each command must exit successfully. These checks validate content and source
contracts; retain the browser findings separately. A passing test suite does
not retroactively perform the keyboard or JavaScript-free checks.

### Remove only the practice work

Delete the practice file you created. Run `pnpm search:index` to refresh local
generated search output, then `git status --short`. Confirm the practice file
is gone and existing content is unchanged; preserve unrelated changes that were
already in the checkout.

For a real article, keep the draft and follow
[publication review](../../guides/publishing/publication-review.md) before
making it public. Finishing this exercise establishes how to create and inspect
an article, not permission to publish under Willie's name.
