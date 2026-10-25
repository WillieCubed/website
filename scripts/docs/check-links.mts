import type { Root } from 'mdast';
import { execFileSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { readFile, stat } from 'node:fs/promises';
import { dirname, extname, join, relative, resolve } from 'node:path';
import { parseFragment } from 'parse5';
import rehypeSlug from 'rehype-slug';
import remarkParse from 'remark-parse';
import remarkRehype from 'remark-rehype';
import { unified } from 'unified';
import { visit } from 'unist-util-visit';

import { isMain } from '../shared/command.mts';

export interface LinkIssue {
  file: string;
  line: number;
  message: string;
}

interface MarkdownLink {
  url: string;
  line: number;
}

interface MarkdownDocument {
  anchors: Set<string>;
  links: MarkdownLink[];
}

const parser = unified().use(remarkParse);
const headings = unified().use(remarkRehype).use(rehypeSlug);

function explicitAnchors(tree: Root, anchors: Set<string>) {
  visit(tree, 'html', ({ value }) => {
    const fragment = parseFragment(value);
    function collect(node: (typeof fragment.childNodes)[number]) {
      if ('attrs' in node) {
        for (const attribute of node.attrs) {
          if (
            attribute.name === 'id' ||
            (node.tagName === 'a' && attribute.name === 'name')
          )
            anchors.add(attribute.value);
        }
      }
      if ('childNodes' in node) node.childNodes.forEach(collect);
    }
    fragment.childNodes.forEach(collect);
  });
}

function parseMarkdown(source: string): MarkdownDocument {
  const tree = parser.parse(source);
  const anchors = new Set<string>();
  const links: MarkdownLink[] = [];
  const definitions = new Map<string, string>();
  visit(tree, 'definition', (node) => {
    const identifier = node.identifier.toLowerCase();
    if (!definitions.has(identifier)) definitions.set(identifier, node.url);
  });
  visit(headings.runSync(tree), 'element', (node) => {
    if (typeof node.properties.id === 'string') anchors.add(node.properties.id);
  });
  explicitAnchors(tree, anchors);
  visit(tree, (node) => {
    const line = node.position?.start.line ?? 1;
    if (node.type === 'link' || node.type === 'image')
      links.push({ url: node.url, line });
    if (node.type === 'linkReference' || node.type === 'imageReference') {
      const url = definitions.get(node.identifier.toLowerCase());
      if (url !== undefined) links.push({ url, line });
    }
  });
  return { anchors, links };
}

/** Only maintained Markdown participates; ignored build output and dated receipts do not. */
export function maintainedMarkdownFiles(root: string): string[] {
  return execFileSync(
    'git',
    ['ls-files', '--cached', '--others', '--exclude-standard', '-z'],
    { cwd: root, encoding: 'utf8' }
  )
    .split('\0')
    .filter((file) => file.endsWith('.md') && existsSync(join(root, file)))
    .filter(
      (file) =>
        !/(?:^|\/)(?:artifacts|scratch|evidence|plans|\.superpowers)(?:\/|$)/.test(
          file
        )
    )
    .filter((file) => !/(?:^|\/)\d{4}-\d{2}-\d{2}[^/]*\.md$/.test(file));
}

async function targetPath(
  root: string,
  file: string,
  pathname: string,
  anchor: string | undefined
): Promise<string> {
  const target = pathname.startsWith('/')
    ? resolve(root, `.${pathname}`)
    : resolve(dirname(join(root, file)), pathname);
  const info = await stat(target);
  return info.isDirectory() && anchor ? join(target, 'README.md') : target;
}

async function checkLink(
  root: string,
  file: string,
  link: MarkdownLink,
  documents: Map<string, MarkdownDocument>
): Promise<string | null> {
  if (/^(?:[a-z][a-z\d+.-]*:|\/\/)/i.test(link.url)) return null;
  const [location, fragment] = link.url.split('#', 2);
  const pathname = decodeURIComponent(location.split('?', 1)[0]);
  let target: string;
  try {
    target = pathname
      ? await targetPath(root, file, pathname, fragment)
      : join(root, file);
    await stat(target);
  } catch {
    return `Missing local target: ${link.url}`;
  }
  if (!fragment || extname(target).toLowerCase() !== '.md') return null;
  let document = documents.get(target);
  if (!document) {
    document = parseMarkdown(await readFile(target, 'utf8'));
    documents.set(target, document);
  }
  const anchor = decodeURIComponent(fragment);
  return document.anchors.has(anchor)
    ? null
    : `Missing anchor "${anchor}" in ${relative(root, target)}`;
}

export async function checkMarkdownLinks(
  root: string,
  files = maintainedMarkdownFiles(root)
): Promise<LinkIssue[]> {
  const issues: LinkIssue[] = [];
  const documents = new Map<string, MarkdownDocument>();
  for (const file of files) {
    const absolute = join(root, file);
    const document = parseMarkdown(await readFile(absolute, 'utf8'));
    documents.set(absolute, document);
    for (const link of document.links) {
      const message = await checkLink(root, file, link, documents);
      if (message) issues.push({ file, line: link.line, message });
    }
  }
  return issues;
}

if (isMain(import.meta.url)) {
  const selected = process.argv.slice(2);
  const issues = await checkMarkdownLinks(
    process.cwd(),
    selected.length > 0 ? selected : undefined
  );
  for (const issue of issues)
    console.error(`${issue.file}:${issue.line}: ${issue.message}`);
  if (issues.length > 0) process.exitCode = 1;
  else console.log('Markdown local links and anchors passed.');
}
