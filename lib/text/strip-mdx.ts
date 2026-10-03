/**
 * Strips MDX/Markdown syntax from content to get plain text. The result feeds
 * both the search index and the `textContent` of published standard.site
 * documents.
 */
export function stripMdxSyntax(content: string): string {
  return (
    content
      // Remove code first, so `Promise<Response>` in a code span is never read
      // as a component tag
      .replace(/```[\s\S]*?```/g, '')
      .replace(/`[^`]+`/g, '')
      // Remove import statements
      .replace(/^import\s+.*$/gm, '')
      // Remove export statements
      .replace(/^export\s+.*$/gm, '')
      // Remove JSX component tags but keep the text between them, so a
      // component's children stay searchable. An attribute value may hold a
      // `>` inside quotes or braces.
      .replace(
        /<\/?[A-Z][a-zA-Z]*(?:\s(?:"[^"]*"|'[^']*'|\{[^}]*\}|[^>"'{])*)?\/?>/g,
        ''
      )
      // Remove HTML tags
      .replace(/<[^>]+>/g, '')
      // Remove markdown images but keep the alt text. Before links, or the
      // link pattern would match inside the image and leave its `!` behind.
      .replace(/!\[([^\]]*)\]\([^)]+\)/g, '$1')
      // Remove markdown links but keep text
      .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
      // Remove headings markers
      .replace(/^#{1,6}\s+/gm, '')
      // Remove bold/italic markers
      .replace(/\*\*([^*]+)\*\*/g, '$1')
      .replace(/\*([^*]+)\*/g, '$1')
      // Underscore emphasis only at word edges, so snake_case_names survive
      .replace(/(^|\W)__([^_]+)__(?=\W|$)/g, '$1$2')
      .replace(/(^|\W)_([^_]+)_(?=\W|$)/g, '$1$2')
      // Remove blockquotes
      .replace(/^>\s+/gm, '')
      // Remove horizontal rules
      .replace(/^---+$/gm, '')
      // Remove list markers
      .replace(/^[\s]*[-*+]\s+/gm, '')
      .replace(/^[\s]*\d+\.\s+/gm, '')
      // Normalize whitespace
      .replace(/\n{3,}/g, '\n\n')
      .trim()
  );
}
