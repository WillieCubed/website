import { site } from '@/lib/site';

export interface PlainPage {
  status?: number;
  title: string;
  /** One entry per line of body text; an empty string is a blank line. */
  lines: string[];
}

const ESCAPES: Record<string, string> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;',
};

function escapeHtml(text: string): string {
  return text.replace(/[&<>"']/g, (char) => ESCAPES[char]);
}

function wantsHtml(request: Request): boolean {
  return (request.headers.get('Accept') ?? '').includes('text/html');
}

// The colors are --color-ink and --color-accent from app/globals.css. These
// pages are route handlers, so they cannot load the app's stylesheet.
function htmlDocument({ title, lines }: PlainPage): string {
  return `<!doctype html>
<html lang="${site.language}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex, nofollow">
<meta name="theme-color" content="${site.themeColor}">
<title>${escapeHtml(title)} · ${escapeHtml(site.name)}</title>
<style>
body{margin:0;padding:40px 20px;background:${site.themeColor};color:#1c231e;font:16px/1.6 ui-monospace,SFMono-Regular,Menlo,Consolas,monospace}
main{max-width:840px;margin:0 auto}
h1{margin:0 0 1.5rem;font:600 1.5rem/1.3 system-ui,sans-serif}
pre{margin:0 0 2rem;white-space:pre-wrap}
a{color:#2f6f5e}
</style>
</head>
<body>
<main>
<h1>${escapeHtml(title)}</h1>
<pre>${lines.map(escapeHtml).join('\n')}</pre>
<a href="/">Back to the homepage</a>
</main>
</body>
</html>
`;
}

/**
 * A small page that reads well in a browser and in `curl`. Browsers that ask
 * for HTML get a styled document; everything else gets the lines as plain
 * text. It is never cached or indexed because these pages answer the
 * particular request that made them.
 */
export function plainPage(request: Request, page: PlainPage): Response {
  const html = wantsHtml(request);
  return new Response(
    html ? htmlDocument(page) : `${page.lines.join('\n')}\n`,
    {
      status: page.status ?? 200,
      headers: {
        'Content-Type': html
          ? 'text/html; charset=utf-8'
          : 'text/plain; charset=utf-8',
        'Cache-Control': 'no-store',
        'X-Robots-Tag': 'noindex, nofollow',
        Vary: 'Accept',
      },
    }
  );
}
