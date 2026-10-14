# Add your first writing page locally

Create a practice article, inspect its local page, and remove the practice file.
The filename determines its URL. At the top of the file, a block of fields
called frontmatter supplies the title, dates, and draft status; the text below
that block becomes the article. Keeping the article as a draft lets you inspect
it in development without making it public.

## Prerequisites

Complete [local setup](../operations/local-development.md) and work from the
repository root with a text editor and browser. The
[writings reference](../../reference/content/writings.md) describes the full
schema; the [metadata rules](../../reference/design/metadata.md) explain how
titles and descriptions appear across surfaces.

This is an article exercise, rather than an exercise in adding a standalone page
such as a contact page. The instructions were checked against the template and
the code that reads writings; the browser steps have not been run for this
revision.

## 1. Create a practice draft

### Choose an unused filename

Check that `content/writings/tutorial-practice.mdx` does not exist. If it does,
choose another unused filename. Substitute that name in the copy command, the
file you edit, the URL, and the cleanup step throughout this exercise. Then copy
the template:

```sh
cp -n content/writings/_template.mdx content/writings/tutorial-practice.mdx
```

The filename without `.mdx` is the slug, the last part of the article's URL. The
original template starts with an underscore so it stays out of the writing
catalog. Your practice copy needs a name without that prefix to get a page. The
copy command avoids overwriting a destination, but you still need to check that
you are editing the new practice file rather than an existing article.

### Give the example a complete body and metadata

The practice article below has a title, description, two dates, and one body
paragraph. It keeps optional relationships and media out of the exercise so you
can first see how a basic writing becomes a page. Replace your new copy's
contents with it:

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
ISO timestamp including your UTC offset.

Keep `draft: true`: the development server shows drafts, while production pages
and search exclude them. You can inspect unfinished copy locally without making
it available to public readers or subscribers.

## 2. Inspect the page

### Follow the filename to its route

Run `pnpm dev`, open its printed origin, and append
`/writings/tutorial-practice`. Expect the title, practice body, and date. If you
chose another filename, use that slug instead. Do not clear the draft flag to
make the practice article searchable.

If the page returns 404, check the filename and URL, then confirm you are using
`pnpm dev`; a production build excludes this draft. If the terminal reports a
parsing error, compare the frontmatter with the example, including its opening
and closing `---` lines.

### Inspect the reading experience

View the page at a phone width and check that the title and body fit. Navigate
with a keyboard and look for visible focus on links. Then disable JavaScript and
reload the direct article URL: the title and body should still be present and
readable.

Use the
[design checklist](../../concepts/design/design-principles.md#before-committing)
for the rest of the page review. These observations concern the reading
experience, which the source checks in the next step cannot inspect.

## 3. Validate and clean up

### Check the source contracts

Stop the server with Ctrl+C, then run:

```sh
pnpm content:check
pnpm typecheck
pnpm test
```

Each command must exit successfully. If one fails, inspect its first reported
error and inspect the file or condition it names. Fix errors introduced by the
practice file; investigate failures elsewhere before assuming the exercise
caused them. Keep any browser findings with those results; fixing a content
error may still leave a layout problem.

### Remove only the practice work

Delete the practice file you created. Run `pnpm search:index` to refresh local
generated search output, then `git status --short`. Confirm the practice file is
gone and existing content is unchanged; preserve unrelated changes that were
already in the checkout.

For a real article, keep the draft and follow
[publication review](../../guides/publishing/publication-review.md) before
making it public. The practice file is disposable; an article published under
Willie's name needs his approval of its text and dates.
