import { site } from '@/lib/site';
import { themeSchemes } from '@/lib/theme';
import { THEME_COLORS, THEME_STORAGE_KEY } from '@/lib/theme-transition';

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

// A scheme picked in the command palette holds here too: the pages share
// the site's storage, so this applies it before the page paints, toolbar
// color included (lib/theme-preference.ts).
const chosenSchemeScript = `try{var t=localStorage.getItem(${JSON.stringify(
  THEME_STORAGE_KEY
)});if(t==='light'||t==='dark'){document.documentElement.dataset.theme=t;document.querySelectorAll('meta[name=theme-color]').forEach(function(m){m.content=${JSON.stringify(
  THEME_COLORS
)}[t]})}}catch(e){}`;

// These route handlers cannot load app/globals.css, so they reproduce its
// semantic role boundary with the shared non-CSS theme values.
function htmlDocument({ title, lines }: PlainPage): string {
  return `<!doctype html>
<html lang="${site.language}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex, nofollow">
<meta name="theme-color" media="(prefers-color-scheme:light)" content="${site.themeColors.light}">
<meta name="theme-color" media="(prefers-color-scheme:dark)" content="${site.themeColors.dark}">
<title>${escapeHtml(title)} · ${escapeHtml(site.name)}</title>
<script>${chosenSchemeScript}</script>
<style>
:root{color-scheme:light dark;--color-primary:light-dark(${themeSchemes.light.primary},${themeSchemes.dark.primary});--color-surface:light-dark(${themeSchemes.light.surface},${themeSchemes.dark.surface});--color-on-surface:light-dark(${themeSchemes.light.onSurface},${themeSchemes.dark.onSurface})}
:root[data-theme=light]{color-scheme:light}:root[data-theme=dark]{color-scheme:dark}
body{margin:0;padding:40px 20px;background:var(--color-surface);color:var(--color-on-surface);font:16px/1.6 ui-monospace,SFMono-Regular,Menlo,Consolas,monospace}
main{max-width:840px;margin:0 auto}
h1{margin:0 0 1.5rem;font:600 1.5rem/1.3 system-ui,sans-serif}
pre{margin:0 0 2rem;white-space:pre-wrap}
a{color:var(--color-primary)}
@media(prefers-reduced-motion:no-preference){body,a{transition:background-color 520ms cubic-bezier(.22,1,.36,1),color 520ms cubic-bezier(.22,1,.36,1)}}
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
